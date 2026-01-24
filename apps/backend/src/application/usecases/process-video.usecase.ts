import type { AiGateway } from '../../domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import type { ProcessingJobRepositoryGateway } from '../../domain/gateways/processing-job-repository.gateway.js';
import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Clip } from '../../domain/models/clip.js';
import { TimestampExtractorService } from '../../domain/services/timestamp-extractor.service.js';
import { NotFoundError } from '../errors.js';
import type { VideoProcessingService } from '../services/video-processing.service.js';

export interface ProcessVideoUseCaseDeps {
  videoRepository: VideoRepositoryGateway;
  clipRepository: ClipRepositoryGateway;
  processingJobRepository: ProcessingJobRepositoryGateway;
  storageGateway: StorageGateway;
  aiGateway: AiGateway;
  videoProcessingService: VideoProcessingService;
  generateId: () => string;
}

export class ProcessVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly processingJobRepository: ProcessingJobRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly aiGateway: AiGateway;
  private readonly videoProcessingService: VideoProcessingService;
  private readonly timestampExtractor: TimestampExtractorService;
  private readonly generateId: () => string;

  constructor(deps: ProcessVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.clipRepository = deps.clipRepository;
    this.processingJobRepository = deps.processingJobRepository;
    this.storageGateway = deps.storageGateway;
    this.aiGateway = deps.aiGateway;
    this.videoProcessingService = deps.videoProcessingService;
    this.timestampExtractor = new TimestampExtractorService();
    this.generateId = deps.generateId;
  }

  async execute(processingJobId: string): Promise<void> {
    // Get processing job
    const job = await this.processingJobRepository.findById(processingJobId);
    if (!job) {
      throw new NotFoundError('ProcessingJob', processingJobId);
    }

    // Get video
    const video = await this.videoRepository.findById(job.videoId);
    if (!video) {
      throw new NotFoundError('Video', job.videoId);
    }

    try {
      // Update status to analyzing
      const analyzingJobResult = job.withStatus('analyzing');
      if (!analyzingJobResult.success) {
        throw new Error(analyzingJobResult.error.message);
      }
      await this.processingJobRepository.save(analyzingJobResult.value);
      await this.videoRepository.save(video.withStatus('processing'));

      // Get video metadata from Google Drive
      const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      const videoWithMetadataResult = video.withMetadata({
        title: metadata.name,
        fileSizeBytes: metadata.size,
      });
      if (videoWithMetadataResult.success) {
        await this.videoRepository.save(videoWithMetadataResult.value);
      }

      // Analyze video with AI
      const aiResponse = await this.aiGateway.analyzeVideo({
        googleDriveUrl: video.googleDriveUrl,
        videoTitle: metadata.name,
        clipInstructions: job.clipInstructions,
      });

      // Save AI response
      const jobWithResponse = analyzingJobResult.value.withAiResponse(JSON.stringify(aiResponse));
      await this.processingJobRepository.save(jobWithResponse);

      // Extract timestamps
      const timestamps = this.timestampExtractor.extractTimestamps(aiResponse.clips);

      // Create clips
      const clips: Clip[] = [];
      for (const ts of timestamps) {
        const clipResult = Clip.createWithFlexibleDuration(
          {
            videoId: video.id,
            title: ts.title,
            startTimeSeconds: ts.startTimeSeconds,
            endTimeSeconds: ts.endTimeSeconds,
            transcript: ts.transcript,
          },
          this.generateId
        );

        if (clipResult.success) {
          clips.push(clipResult.value);
        }
      }

      await this.clipRepository.saveMany(clips);

      // Update status to extracting
      const extractingJobResult = jobWithResponse.withStatus('extracting');
      if (!extractingJobResult.success) {
        throw new Error(extractingJobResult.error.message);
      }
      await this.processingJobRepository.save(extractingJobResult.value);

      // Download video
      const videoBuffer = await this.storageGateway.downloadFile(video.googleDriveFileId);

      // Get or create output folder
      const parentFolder = metadata.parents?.[0];
      const shortsFolder = await this.storageGateway.findOrCreateFolder('ショート用', parentFolder);

      // Update status to uploading
      const uploadingJobResult = extractingJobResult.value.withStatus('uploading');
      if (!uploadingJobResult.success) {
        throw new Error(uploadingJobResult.error.message);
      }
      await this.processingJobRepository.save(uploadingJobResult.value);

      // Process each clip
      for (const clip of clips) {
        try {
          // Update clip status
          await this.clipRepository.save(clip.withStatus('processing'));

          // Extract clip using FFmpeg
          const clipBuffer = await this.videoProcessingService.extractClip(
            videoBuffer,
            clip.startTimeSeconds,
            clip.endTimeSeconds
          );

          // Upload clip
          const fileName = `${clip.title ?? clip.id}.mp4`;
          const uploadedFile = await this.storageGateway.uploadFile({
            name: fileName,
            mimeType: 'video/mp4',
            content: clipBuffer,
            parentFolderId: shortsFolder.id,
          });

          // Update clip with Google Drive info
          const completedClip = clip
            .withGoogleDriveInfo(uploadedFile.id, uploadedFile.webViewLink)
            .withStatus('completed');
          await this.clipRepository.save(completedClip);
        } catch (clipError) {
          const errorMessage =
            clipError instanceof Error ? clipError.message : 'Unknown error processing clip';
          await this.clipRepository.save(clip.withStatus('failed', errorMessage));
        }
      }

      // Create metadata file
      const metadataContent = {
        videoId: video.id,
        videoTitle: metadata.name,
        clips: clips.map((c) => ({
          id: c.id,
          title: c.title,
          startTimeSeconds: c.startTimeSeconds,
          endTimeSeconds: c.endTimeSeconds,
          transcript: c.transcript,
        })),
        processedAt: new Date().toISOString(),
      };

      await this.storageGateway.uploadFile({
        name: `${video.id}_metadata.json`,
        mimeType: 'application/json',
        content: Buffer.from(JSON.stringify(metadataContent, null, 2)),
        parentFolderId: shortsFolder.id,
      });

      // Update job to completed
      const completedJobResult = uploadingJobResult.value.withStatus('completed');
      if (!completedJobResult.success) {
        throw new Error(completedJobResult.error.message);
      }
      await this.processingJobRepository.save(completedJobResult.value);

      // Update video to completed
      const updatedVideo = videoWithMetadataResult.success ? videoWithMetadataResult.value : video;
      await this.videoRepository.save(updatedVideo.withStatus('completed'));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Update job to failed
      const failedJobResult = job.withStatus('failed', errorMessage);
      if (failedJobResult.success) {
        await this.processingJobRepository.save(failedJobResult.value);
      }

      // Update video to failed
      await this.videoRepository.save(video.withStatus('failed', errorMessage));

      throw error;
    }
  }
}
