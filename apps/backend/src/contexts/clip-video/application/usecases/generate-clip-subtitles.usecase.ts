import type { AiGateway } from '@clip-video/domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '@clip-video/domain/gateways/clip-repository.gateway.js';
import type { ClipSubtitleRepositoryGateway } from '@clip-video/domain/gateways/clip-subtitle-repository.gateway.js';
import type { RefinedTranscriptionRepositoryGateway } from '@clip-video/domain/gateways/refined-transcription-repository.gateway.js';
import type { TranscriptionRepositoryGateway } from '@clip-video/domain/gateways/transcription-repository.gateway.js';
import { ClipSubtitle, type ClipSubtitleSegment } from '@clip-video/domain/models/clip-subtitle.js';
import { SubtitleSegmentationPromptService } from '@clip-video/domain/services/subtitle-segmentation-prompt.service.js';
import { createLogger } from '@shared/infrastructure/logging/logger.js';
import type { GenerateClipSubtitlesResponse } from '@video-processor/shared';
import {
  ClipNotFoundError,
  RefinedTranscriptionNotFoundError,
  SubtitleGenerationError,
  SubtitleValidationError,
  TranscriptionNotFoundError,
} from '../errors/clip-subtitle.errors.js';

const log = createLogger('GenerateClipSubtitlesUseCase');

export interface GenerateClipSubtitlesUseCaseDeps {
  clipRepository: ClipRepositoryGateway;
  clipSubtitleRepository: ClipSubtitleRepositoryGateway;
  transcriptionRepository: TranscriptionRepositoryGateway;
  refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  aiGateway: AiGateway;
  generateId: () => string;
}

export class GenerateClipSubtitlesUseCase {
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly clipSubtitleRepository: ClipSubtitleRepositoryGateway;
  private readonly transcriptionRepository: TranscriptionRepositoryGateway;
  private readonly refinedTranscriptionRepository: RefinedTranscriptionRepositoryGateway;
  private readonly aiGateway: AiGateway;
  private readonly generateId: () => string;
  private readonly promptService: SubtitleSegmentationPromptService;

  constructor(deps: GenerateClipSubtitlesUseCaseDeps) {
    this.clipRepository = deps.clipRepository;
    this.clipSubtitleRepository = deps.clipSubtitleRepository;
    this.transcriptionRepository = deps.transcriptionRepository;
    this.refinedTranscriptionRepository = deps.refinedTranscriptionRepository;
    this.aiGateway = deps.aiGateway;
    this.generateId = deps.generateId;
    this.promptService = new SubtitleSegmentationPromptService();
  }

  async execute(clipId: string): Promise<GenerateClipSubtitlesResponse> {
    log.info('Generating subtitles for clip', { clipId });

    // 1. Get clip
    const clip = await this.clipRepository.findById(clipId);
    if (!clip) {
      throw new ClipNotFoundError(clipId);
    }

    // 2. Get transcription (needed to find refinedTranscription)
    const transcription = await this.transcriptionRepository.findByVideoId(clip.videoId);
    if (!transcription) {
      throw new TranscriptionNotFoundError(clip.videoId);
    }

    // 3. Get refined transcription
    const refinedTranscription = await this.refinedTranscriptionRepository.findByTranscriptionId(
      transcription.id
    );
    if (!refinedTranscription) {
      throw new RefinedTranscriptionNotFoundError(clip.videoId);
    }

    // 4. Filter sentences for clip range
    const filteredSentences = this.promptService.filterSentencesForClip(
      refinedTranscription.sentences,
      clip.startTimeSeconds,
      clip.endTimeSeconds
    );

    if (filteredSentences.length === 0) {
      throw new SubtitleGenerationError('No sentences found for clip time range');
    }

    // 5. Build lightweight prompt and call AI
    const prompt = this.promptService.buildPrompt({
      clipStartSeconds: clip.startTimeSeconds,
      clipEndSeconds: clip.endTimeSeconds,
      refinedSentences: filteredSentences,
    });

    log.info('Calling AI for subtitle segmentation (lightweight)', { clipId });
    let aiResponse: string;
    try {
      aiResponse = await this.aiGateway.generate(prompt);
    } catch (error) {
      log.error('AI generation failed', error instanceof Error ? error : undefined, { clipId });
      throw new SubtitleGenerationError(
        error instanceof Error ? error.message : 'AI generation failed'
      );
    }

    // 6. Build normalized full text for keyword position resolution
    const fullText = this.promptService.buildNormalizedFullText(filteredSentences);

    // 7. Parse AI response (chunk lines → keyword search → slice restoration)
    log.info('AI response received', { clipId, aiResponse: aiResponse.substring(0, 500) });

    let builtSegments: Array<{ lines: string[] }>;
    try {
      builtSegments = this.promptService.parseResponse(aiResponse, fullText);
      log.info('Parsed segments from chunks', {
        clipId,
        segmentCount: builtSegments.length,
        segments: builtSegments.slice(0, 3),
      });
    } catch (error) {
      log.error('Failed to parse AI response', error instanceof Error ? error : undefined, {
        clipId,
      });
      throw new SubtitleGenerationError(
        error instanceof Error ? error.message : 'Failed to parse AI response'
      );
    }

    // 8. Split long lines (fallback for lines exceeding 16 chars)
    builtSegments = this.promptService.splitLongLines(builtSegments);
    log.info('Segments after splitLongLines', { clipId, segmentCount: builtSegments.length });

    // 9. Assign timestamps using character-based interpolation
    let segments: ClipSubtitleSegment[];
    try {
      segments = this.promptService.assignTimestamps(
        builtSegments,
        filteredSentences,
        clip.startTimeSeconds
      );
      log.info('Timestamps assigned (relative time)', { clipId, segments: segments.slice(0, 3) });
    } catch (error) {
      log.error('Failed to assign timestamps', error instanceof Error ? error : undefined, {
        clipId,
      });
      throw new SubtitleGenerationError(
        error instanceof Error ? error.message : 'Failed to assign timestamps'
      );
    }

    // 8. Create ClipSubtitle entity
    const subtitleResult = ClipSubtitle.create(
      {
        clipId,
        segments,
      },
      this.generateId
    );

    if (!subtitleResult.success) {
      throw new SubtitleValidationError(subtitleResult.error.message);
    }

    const subtitle = subtitleResult.value;

    // 9. Save to repository
    await this.clipSubtitleRepository.save(subtitle);
    log.info('Subtitle saved successfully', { clipId, segmentCount: segments.length });

    return {
      clipId,
      subtitle: {
        id: subtitle.id,
        clipId: subtitle.clipId,
        segments: subtitle.segments,
        status: subtitle.status,
        createdAt: subtitle.createdAt,
        updatedAt: subtitle.updatedAt,
      },
    };
  }
}
