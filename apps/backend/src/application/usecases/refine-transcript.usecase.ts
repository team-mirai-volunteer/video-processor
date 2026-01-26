import type { AiGateway } from '../../domain/gateways/ai.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '../../domain/gateways/refined-transcription-repository.gateway.js';
import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TranscriptionRepositoryGateway } from '../../domain/gateways/transcription-repository.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import {
  type RefinedSentence,
  RefinedTranscription,
} from '../../domain/models/refined-transcription.js';
import {
  CHUNK_OVERLAP,
  type ProperNounDictionary,
  type SegmentChunk,
  TranscriptRefinementPromptService,
} from '../../domain/services/transcript-refinement-prompt.service.js';
import { NotFoundError } from '../errors.js';

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

interface LlmResponse {
  sentences: RefinedSentence[];
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

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[RefineTranscriptUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(videoId: string): Promise<RefineTranscriptResult> {
    this.log('Starting execution', { videoId });

    // 1. Get raw transcription by videoId
    const transcription = await this.transcriptionRepository.findByVideoId(videoId);
    if (!transcription) {
      throw new NotFoundError('Transcription', videoId);
    }
    this.log('Found transcription', {
      transcriptionId: transcription.id,
      segmentCount: transcription.segments.length,
    });

    // 2. Load proper noun dictionary
    this.log('Loading proper noun dictionary...');
    const dictionary = await this.loadDictionary();
    this.log('Dictionary loaded', {
      version: dictionary.version,
      entryCount: dictionary.entries.length,
    });

    // 3. Split segments into chunks
    const chunks = this.promptService.splitIntoChunks(transcription.segments);
    this.log('Segments split into chunks', {
      chunkCount: chunks.length,
      segmentCount: transcription.segments.length,
    });

    // 4. Process each chunk
    const allSentences = await this.processChunks(chunks, dictionary);
    this.log('All chunks processed', { totalSentences: allSentences.length });

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
    this.log('Refined transcription saved', { id: refinedTranscription.id });

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
   * Process all chunks in parallel and merge results
   * Handles overlap between chunks to avoid duplicate or incomplete sentences
   */
  private async processChunks(
    chunks: SegmentChunk[],
    dictionary: ProperNounDictionary
  ): Promise<RefinedSentence[]> {
    this.log('Processing chunks in parallel', { chunkCount: chunks.length });

    // Process all chunks in parallel
    const chunkResults = await Promise.all(
      chunks.map(async (chunk) => {
        this.log('Processing chunk', {
          chunkIndex: chunk.chunkIndex,
          totalChunks: chunk.totalChunks,
          startIndex: chunk.startIndex,
          endIndex: chunk.endIndex,
        });

        const prompt = this.promptService.buildChunkPrompt(chunk, dictionary);
        const aiResponse = await this.aiGateway.generate(prompt);
        const parsedResponse = this.parseResponse(aiResponse);

        this.log('Chunk processed', {
          chunkIndex: chunk.chunkIndex,
          sentenceCount: parsedResponse.sentences.length,
        });

        return { chunk, sentences: parsedResponse.sentences };
      })
    );

    // Sort by chunk index and merge results
    chunkResults.sort((a, b) => a.chunk.chunkIndex - b.chunk.chunkIndex);

    const allSentences: RefinedSentence[] = [];
    let lastProcessedSegmentIndex = -1;

    for (const { chunk, sentences } of chunkResults) {
      // Determine cutoff index for this chunk
      const isLastChunk = chunk.chunkIndex === chunk.totalChunks - 1;
      const cutoffIndex = isLastChunk ? chunk.endIndex : chunk.endIndex - CHUNK_OVERLAP;

      // Filter sentences:
      // 1. Sentence must start after the last processed segment (avoid duplicates)
      // 2. Sentence must end before the cutoff (avoid incomplete sentences at boundary)
      const newSentences = sentences.filter((sentence) => {
        const minSegmentIndex = Math.min(...sentence.originalSegmentIndices);
        const maxSegmentIndex = Math.max(...sentence.originalSegmentIndices);
        return minSegmentIndex > lastProcessedSegmentIndex && maxSegmentIndex <= cutoffIndex;
      });

      this.log('Filtered sentences for overlap', {
        chunkIndex: chunk.chunkIndex,
        originalCount: sentences.length,
        filteredCount: newSentences.length,
        cutoffIndex,
        lastProcessedSegmentIndex,
      });

      allSentences.push(...newSentences);

      if (newSentences.length > 0) {
        const lastSentence = newSentences[newSentences.length - 1];
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
        this.log(
          'Warning: TRANSCRIPT_OUTPUT_FOLDER_ID not set, skipping refined transcript upload'
        );
        return;
      }

      // Get video to get googleDriveFileId
      const video = await this.videoRepository.findById(videoId);
      if (!video) {
        this.log('Warning: Video not found, skipping refined transcript upload');
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

      this.log('Refined transcript files uploaded to Google Drive', {
        folderId: videoFolder.id,
        files: [`${videoName}_整形済み.txt`, `${videoName}_整形済み.json`],
      });
    } catch (uploadError) {
      // Log but don't fail - file upload is optional
      this.log('Warning: Failed to upload refined transcript files to Google Drive', {
        error: uploadError instanceof Error ? uploadError.message : 'Unknown error',
      });
    }
  }

  private parseResponse(response: string): LlmResponse {
    // Try to extract JSON from the response
    // The LLM might include extra text before/after the JSON
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse AI response: No valid JSON found');
    }

    try {
      const parsed = JSON.parse(jsonMatch[0]) as LlmResponse;

      if (!parsed.sentences || !Array.isArray(parsed.sentences)) {
        throw new Error('Invalid response format: missing sentences array');
      }

      // Validate each sentence
      for (const sentence of parsed.sentences) {
        if (typeof sentence.text !== 'string') {
          throw new Error('Invalid sentence: missing text');
        }
        if (typeof sentence.startTimeSeconds !== 'number') {
          throw new Error('Invalid sentence: missing startTimeSeconds');
        }
        if (typeof sentence.endTimeSeconds !== 'number') {
          throw new Error('Invalid sentence: missing endTimeSeconds');
        }
        if (!Array.isArray(sentence.originalSegmentIndices)) {
          throw new Error('Invalid sentence: missing originalSegmentIndices');
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
}
