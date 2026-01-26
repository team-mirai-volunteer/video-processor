import type { AiGateway } from '../../domain/gateways/ai.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '../../domain/gateways/refined-transcription-repository.gateway.js';
import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import {
  type RefinedSentence,
  RefinedTranscription,
} from '../../domain/models/refined-transcription.js';
import type { TranscriptionSegment } from '../../domain/models/transcription.js';
import {
  CHUNK_OVERLAP,
  type ProperNounDictionary,
  type SegmentChunk,
  TranscriptRefinementPromptService,
} from '../../domain/services/transcript-refinement-prompt.service.js';
import { createLogger } from '../../infrastructure/logging/logger.js';
import { NotFoundError } from '../errors.js';

const log = createLogger('RefineTranscriptUseCase');

export interface RefineTranscriptUseCaseDeps {
  transcriptionRepository: TranscriptionRepositoryGateway;
  refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  videoRepository: VideoRepositoryGateway;
  storageGateway: StorageGateway;
  aiGateway: AiGateway;
  generateId: () => string;
  loadDictionary: () => Promise<ProperNounDictionary>;
  transcriptOutputFolderId?: string;
}

export interface RefineTranscriptResult {
  id: string;
  transcriptionId: string;
  fullText: string;
  sentenceCount: number;
  dictionaryVersion: string;
}

/**
 * Raw response from LLM (start/end indices only)
 */
interface LlmChunkResponse {
  sentences: Array<{
    text: string;
    start: number;
    end: number;
  }>;
}

export class RefineTranscriptUseCase {
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly aiGateway: AiGateway;
  private readonly generateId: () => string;
  private readonly loadDictionary: () => Promise<ProperNounDictionary>;
  private readonly promptService: TranscriptRefinementPromptService;
  private readonly transcriptOutputFolderId?: string;

  constructor(deps: RefineTranscriptUseCaseDeps) {
    this.transcriptionRepository = deps.transcriptionRepository;
    this.refinedTranscriptionRepository = deps.refinedTranscriptionRepository;
    this.videoRepository = deps.videoRepository;
    this.storageGateway = deps.storageGateway;
    this.aiGateway = deps.aiGateway;
    this.generateId = deps.generateId;
    this.loadDictionary = deps.loadDictionary;
    this.promptService = new TranscriptRefinementPromptService();
    this.transcriptOutputFolderId = deps.transcriptOutputFolderId;
  }

  /**
   * Update progress message in DB (non-blocking)
   */
  private async updateProgress(videoId: string, message: string | null): Promise<void> {
    try {
      const video = await this.videoRepository.findById(videoId);
      if (video) {
        await this.videoRepository.save(video.withProgressMessage(message));
      }
    } catch (e) {
      // Ignore progress update errors
      log.warn('Failed to update progress', { error: e instanceof Error ? e.message : 'Unknown' });
    }
  }

  async execute(videoId: string): Promise<RefineTranscriptResult> {
    log.info('Starting execution', { videoId });

    // 1. Get raw transcription by videoId
    const transcription = await this.transcriptionRepository.findByVideoId(videoId);
    if (!transcription) {
      throw new NotFoundError('Transcription', videoId);
    }
    log.info('Found transcription', {
      transcriptionId: transcription.id,
      segmentCount: transcription.segments.length,
    });

    // 2. Load proper noun dictionary
    log.info('Loading proper noun dictionary...');
    await this.updateProgress(videoId, '辞書を読み込み中...');
    const dictionary = await this.loadDictionary();
    log.info('Dictionary loaded', {
      version: dictionary.version,
      entryCount: dictionary.entries.length,
    });

    // 3. Split segments into chunks
    const chunks = this.promptService.splitIntoChunks(transcription.segments);
    log.info('Segments split into chunks', {
      chunkCount: chunks.length,
      segmentCount: transcription.segments.length,
    });

    // 4. Process each chunk
    const allSentences = await this.processChunks(
      videoId,
      chunks,
      transcription.segments,
      dictionary
    );
    log.info('All chunks processed', { totalSentences: allSentences.length });

    // Clear progress message
    await this.updateProgress(videoId, null);

    // 5. Generate fullText from sentences
    const fullText = allSentences.map((s) => s.text).join('');

    // 6. Create RefinedTranscription entity
    const refinedTranscriptionResult = RefinedTranscription.create(
      {
        transcriptionId: transcription.id,
        fullText,
        sentences: allSentences,
        dictionaryVersion: dictionary.version,
      },
      this.generateId
    );

    if (!refinedTranscriptionResult.success) {
      throw new Error(refinedTranscriptionResult.error.message);
    }

    const refinedTranscription = refinedTranscriptionResult.value;

    // 7. Save to repository
    await this.refinedTranscriptionRepository.save(refinedTranscription);
    log.info('Refined transcription saved', { id: refinedTranscription.id });

    // 8. Upload refined transcript to Google Drive (best effort)
    await this.uploadRefinedTranscriptToDrive(videoId, refinedTranscription);

    // 9. Return result
    return {
      id: refinedTranscription.id,
      transcriptionId: refinedTranscription.transcriptionId,
      fullText: refinedTranscription.fullText,
      sentenceCount: refinedTranscription.sentences.length,
      dictionaryVersion: refinedTranscription.dictionaryVersion,
    };
  }

  /**
   * Process all chunks with limited concurrency and merge results
   * Handles overlap between chunks to avoid duplicate or incomplete sentences
   */
  private async processChunks(
    videoId: string,
    chunks: SegmentChunk[],
    segments: TranscriptionSegment[],
    dictionary: ProperNounDictionary
  ): Promise<RefinedSentence[]> {
    const concurrencyLimit = 3;
    log.info('Processing chunks with limited concurrency', {
      chunkCount: chunks.length,
      concurrencyLimit,
    });

    // Initial progress update (force)
    await this.updateProgress(videoId, `AI校正中... 0/${chunks.length} チャンク (0%)`);

    // Process chunks with limited concurrency
    type RawSentence = { text: string; start: number; end: number };
    const chunkResults: { chunk: SegmentChunk; rawSentences: RawSentence[] }[] = [];
    let completedChunks = 0;

    for (let i = 0; i < chunks.length; i += concurrencyLimit) {
      const batch = chunks.slice(i, i + concurrencyLimit);
      log.info('Processing batch', {
        batchStart: i,
        batchSize: batch.length,
        totalChunks: chunks.length,
      });

      const batchResults = await Promise.all(
        batch.map(async (chunk) => {
          log.debug('Processing chunk', {
            chunkIndex: chunk.chunkIndex,
            totalChunks: chunk.totalChunks,
            startIndex: chunk.startIndex,
            endIndex: chunk.endIndex,
          });

          const prompt = this.promptService.buildChunkPrompt(chunk, segments, dictionary);
          const aiResponse = await this.aiGateway.generate(prompt);
          const parsedResponse = this.parseResponse(aiResponse);

          log.debug('Chunk processed', {
            chunkIndex: chunk.chunkIndex,
            sentenceCount: parsedResponse.sentences.length,
          });

          return { chunk, rawSentences: parsedResponse.sentences };
        })
      );

      chunkResults.push(...batchResults);

      // Update progress after each batch (force update)
      completedChunks += batchResults.length;
      const percent = Math.floor((completedChunks / chunks.length) * 100);
      await this.updateProgress(
        videoId,
        `AI校正中... ${completedChunks}/${chunks.length} チャンク (${percent}%)`
      );
    }

    // Sort by chunk index and merge results
    chunkResults.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);

    const allSentences: RefinedSentence[] = [];
    let lastProcessedSegmentIndex = -1;

    for (const { chunk, rawSentences } of chunkResults) {
      // Determine cutoff index for this chunk
      const isLastChunk = chunk.chunkIndex === chunk.totalChunks - 1;
      const cutoffIndex = isLastChunk ? chunk.endIndex : chunk.endIndex - CHUNK_OVERLAP;

      // Filter sentences:
      // 1. Sentence must start at or after the last processed segment (avoid duplicates)
      // 2. Sentence must end before the cutoff (avoid incomplete sentences at boundary)
      const filteredRawSentences = rawSentences.filter((sentence) => {
        return sentence.start >= lastProcessedSegmentIndex && sentence.end <= cutoffIndex;
      });

      // Convert to RefinedSentence with calculated timestamps
      const newSentences = this.convertToRefinedSentences(
        { sentences: filteredRawSentences },
        segments
      );

      log.debug('Filtered sentences for overlap', {
        chunkIndex: chunk.chunkIndex,
        originalCount: rawSentences.length,
        filteredCount: newSentences.length,
        cutoffIndex,
        lastProcessedSegmentIndex,
      });

      allSentences.push(...newSentences);

      const lastSentence = newSentences[newSentences.length - 1];
      if (lastSentence) {
        lastProcessedSegmentIndex = Math.max(...lastSentence.originalSegmentIndices);
      }
    }

    return allSentences;
  }

  private async uploadRefinedTranscriptToDrive(
    videoId: string,
    refinedTranscription: RefinedTranscription
  ): Promise<void> {
    try {
      if (!this.transcriptOutputFolderId) {
        log.warn('TRANSCRIPT_OUTPUT_FOLDER_ID not set, skipping refined transcript upload');
        return;
      }

      // Get video to get googleDriveFileId
      const video = await this.videoRepository.findById(videoId);
      if (!video) {
        log.warn('Video not found, skipping refined transcript upload');
        return;
      }

      const videoMetadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      const videoName = videoMetadata.name.replace(/\.[^/.]+$/, '');

      // Create folder with video name under the output folder
      const videoFolder = await this.storageGateway.findOrCreateFolder(
        videoName,
        this.transcriptOutputFolderId
      );

      // Upload PlainText version
      await this.storageGateway.uploadFile({
        name: `${videoName}_整形済み.txt`,
        mimeType: 'text/plain; charset=utf-8',
        content: Buffer.from(refinedTranscription.fullText, 'utf-8'),
        parentFolderId: videoFolder.id,
      });

      // Upload JSON version
      const jsonContent = JSON.stringify(
        {
          sentences: refinedTranscription.sentences,
          dictionaryVersion: refinedTranscription.dictionaryVersion,
        },
        null,
        2
      );
      await this.storageGateway.uploadFile({
        name: `${videoName}_整形済み.json`,
        mimeType: 'application/json',
        content: Buffer.from(jsonContent, 'utf-8'),
        parentFolderId: videoFolder.id,
      });

      log.info('Refined transcript files uploaded to Google Drive', {
        folderId: videoFolder.id,
        files: [`${videoName}_整形済み.txt`, `${videoName}_整形済み.json`],
      });
    } catch (uploadError) {
      // Log but don't fail - file upload is optional
      log.warn('Failed to upload refined transcript files to Google Drive', {
        error: uploadError instanceof Error ? uploadError.message : 'Unknown error',
      });
    }
  }

  /**
   * Parse LLM response (without timestamps)
   */
  private parseResponse(response: string): LlmChunkResponse {
    // Try to extract JSON from the response
    // The LLM might include extra text before/after the JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response: No valid JSON found');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as LlmChunkResponse;

      if (!parsed.sentences || !Array.isArray(parsed.sentences)) {
        throw new Error('Invalid response format: missing sentences array');
      }

      // Validate each sentence
      for (const sentence of parsed.sentences) {
        if (typeof sentence.text !== 'string') {
          throw new Error('Invalid sentence: missing text');
        }
        if (typeof sentence.start !== 'number') {
          throw new Error('Invalid sentence: missing start');
        }
        if (typeof sentence.end !== 'number') {
          throw new Error('Invalid sentence: missing end');
        }
      }

      return parsed;
    } catch (e) {
      if (e instanceof SyntaxError) {
        throw new Error(`Failed to parse AI response as JSON: ${e.message}`);
      }
      throw e;
    }
  }

  /**
   * Convert LLM response to RefinedSentence with calculated timestamps
   */
  private convertToRefinedSentences(
    llmResponse: LlmChunkResponse,
    segments: TranscriptionSegment[]
  ): RefinedSentence[] {
    return llmResponse.sentences.map((sentence) => {
      const { start, end } = sentence;

      // Calculate timestamps from original segments
      const startTimeSeconds = segments[start]?.startTimeSeconds ?? 0;
      const endTimeSeconds = segments[end]?.endTimeSeconds ?? 0;

      // Generate indices array for originalSegmentIndices
      const indices: number[] = [];
      for (let i = start; i <= end; i++) {
        indices.push(i);
      }

      return {
        text: sentence.text,
        startTimeSeconds,
        endTimeSeconds,
        originalSegmentIndices: indices,
      };
    });
  }
}
