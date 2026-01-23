import type { ProcessingJob } from '../../domain/models/processing-job.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { AIGateway } from '../../domain/gateways/ai.gateway.js';
import { TimestampExtractorService } from '../../domain/services/timestamp-extractor.service.js';
import { VideoRepository } from '../../infrastructure/repositories/video.repository.js';
import { ClipRepository } from '../../infrastructure/repositories/clip.repository.js';
import { ProcessingJobRepository } from '../../infrastructure/repositories/processing-job.repository.js';
import { GoogleDriveClient } from '../../infrastructure/clients/google-drive.client.js';
import { GeminiClient } from '../../infrastructure/clients/gemini.client.js';
import { FFmpegClient } from '../../infrastructure/clients/ffmpeg.client.js';

/**
 * Process video input
 */
export interface ProcessVideoInput {
  processingJobId: string;
}

/**
 * Process video use case
 * Orchestrates the video processing workflow:
 * 1. Get file metadata from Google Drive
 * 2. Analyze video with AI to extract timestamps
 * 3. Create clip records
 * 4. Download video and extract clips
 * 5. Upload clips to Google Drive
 */
export class ProcessVideoUseCase {
  private videoRepository: VideoRepositoryGateway;
  private clipRepository: ClipRepositoryGateway;
  private processingJobRepository: ProcessingJobRepository;
  private storageGateway: StorageGateway;
  private aiGateway: AIGateway;
  private timestampExtractor: TimestampExtractorService;

  constructor(
    videoRepository?: VideoRepositoryGateway,
    clipRepository?: ClipRepositoryGateway,
    processingJobRepository?: ProcessingJobRepository,
    storageGateway?: StorageGateway,
    aiGateway?: AIGateway,
    _ffmpegClient?: FFmpegClient // Will be used for actual video extraction
  ) {
    this.videoRepository = videoRepository ?? new VideoRepository();
    this.clipRepository = clipRepository ?? new ClipRepository();
    this.processingJobRepository = processingJobRepository ?? new ProcessingJobRepository();
    this.storageGateway = storageGateway ?? new GoogleDriveClient();
    this.aiGateway = aiGateway ?? new GeminiClient();
    this.timestampExtractor = new TimestampExtractorService();
  }

  async execute(input: ProcessVideoInput): Promise<ProcessingJob> {
    const job = await this.processingJobRepository.findById(input.processingJobId);
    if (!job) {
      throw new Error('Processing job not found');
    }

    const video = await this.videoRepository.findById(job.videoId);
    if (!video) {
      throw new Error('Video not found');
    }

    try {
      // Update job status to analyzing
      await this.processingJobRepository.update(job.id, {
        status: 'analyzing',
        startedAt: new Date(),
      });

      // Update video status to processing
      await this.videoRepository.update(video.id, {
        status: 'processing',
      });

      // Step 1: Get file metadata from Google Drive
      const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      await this.videoRepository.update(video.id, {
        title: metadata.name,
        fileSizeBytes: BigInt(metadata.size),
      });

      // Step 2: Analyze video with AI
      const aiResponse = await this.aiGateway.analyzeVideo({
        googleDriveUrl: video.googleDriveUrl,
        videoTitle: metadata.name,
        clipInstructions: job.clipInstructions,
      });

      // Store AI response
      await this.processingJobRepository.update(job.id, {
        aiResponse: JSON.stringify(aiResponse),
        status: 'extracting',
      });

      // Step 3: Validate and convert timestamps
      const validationErrors = this.timestampExtractor.validateTimestamps(aiResponse.clips);
      if (validationErrors.length > 0) {
        throw new Error(`Invalid timestamps: ${validationErrors.join(', ')}`);
      }

      const clipParams = this.timestampExtractor.extractClipParams(video.id, aiResponse.clips);

      // Step 4: Create clip records
      const clips = await this.clipRepository.createMany(clipParams);

      // Step 5: Process each clip (in a real implementation, this would:
      // - Download the video
      // - Use FFmpeg to extract each clip
      // - Upload each clip to Google Drive
      // - Update clip records with Google Drive URLs)

      // Update job status to uploading
      await this.processingJobRepository.update(job.id, {
        status: 'uploading',
      });

      // For now, just mark clips as completed (stub)
      for (const clip of clips) {
        await this.clipRepository.update(clip.id, {
          status: 'completed',
          googleDriveFileId: `clip-${clip.id}`,
          googleDriveUrl: `https://drive.google.com/file/d/clip-${clip.id}/view`,
        });
      }

      // Step 6: Mark job and video as completed
      await this.processingJobRepository.update(job.id, {
        status: 'completed',
        completedAt: new Date(),
      });

      await this.videoRepository.update(video.id, {
        status: 'completed',
      });

      return await this.processingJobRepository.findById(job.id) as ProcessingJob;
    } catch (error) {
      // Handle errors
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await this.processingJobRepository.update(job.id, {
        status: 'failed',
        errorMessage,
        completedAt: new Date(),
      });

      await this.videoRepository.update(video.id, {
        status: 'failed',
        errorMessage,
      });

      throw error;
    }
  }
}
