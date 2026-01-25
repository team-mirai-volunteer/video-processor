import type { AiGateway } from '../../domain/gateways/ai.gateway.js';
import type { ClipRepositoryGateway } from '../../domain/gateways/clip-repository.gateway.js';
import type { ProcessingJobRepositoryGateway } from '../../domain/gateways/processing-job-repository.gateway.js';
import type { StorageGateway } from '../../domain/gateways/storage.gateway.js';
import type { TranscriptionGateway } from '../../domain/gateways/transcription.gateway.js';
import type { VideoRepositoryGateway } from '../../domain/gateways/video-repository.gateway.js';
import { Clip } from '../../domain/models/clip.js';
import { ClipAnalysisPromptService } from '../../domain/services/clip-analysis-prompt.service.js';
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
  transcriptionGateway: TranscriptionGateway;
  generateId: () => string;
  /** Optional: Default output folder ID for clips (shared drive folder recommended) */
  outputFolderId?: string;
}

export class ProcessVideoUseCase {
  private readonly videoRepository: VideoRepositoryGateway;
  private readonly clipRepository: ClipRepositoryGateway;
  private readonly processingJobRepository: ProcessingJobRepositoryGateway;
  private readonly storageGateway: StorageGateway;
  private readonly aiGateway: AiGateway;
  private readonly videoProcessingService: VideoProcessingService;
  private readonly transcriptionGateway: TranscriptionGateway;
  private readonly timestampExtractor: TimestampExtractorService;
  private readonly clipAnalysisPromptService: ClipAnalysisPromptService;
  private readonly generateId: () => string;
  private readonly outputFolderId?: string;

  constructor(deps: ProcessVideoUseCaseDeps) {
    this.videoRepository = deps.videoRepository;
    this.clipRepository = deps.clipRepository;
    this.processingJobRepository = deps.processingJobRepository;
    this.storageGateway = deps.storageGateway;
    this.aiGateway = deps.aiGateway;
    this.videoProcessingService = deps.videoProcessingService;
    this.transcriptionGateway = deps.transcriptionGateway;
    this.timestampExtractor = new TimestampExtractorService();
    this.clipAnalysisPromptService = new ClipAnalysisPromptService();
    this.generateId = deps.generateId;
    this.outputFolderId = deps.outputFolderId;
  }

  private log(message: string, data?: Record<string, unknown>): void {
    const timestamp = new Date().toISOString();
    const logData = data ? ` ${JSON.stringify(data)}` : '';
    console.log(`[ProcessVideoUseCase] [${timestamp}] ${message}${logData}`);
  }

  async execute(processingJobId: string): Promise<void> {
    this.log('Starting execution', { processingJobId, outputFolderId: this.outputFolderId });

    // Get processing job
    const job = await this.processingJobRepository.findById(processingJobId);
    if (!job) {
      throw new NotFoundError('ProcessingJob', processingJobId);
    }
    this.log('Found processing job', { jobId: job.id, videoId: job.videoId });

    // Get video
    const video = await this.videoRepository.findById(job.videoId);
    if (!video) {
      throw new NotFoundError('Video', job.videoId);
    }
    this.log('Found video', { videoId: video.id, googleDriveFileId: video.googleDriveFileId });

    try {
      // Update status to analyzing
      const analyzingJobResult = job.withStatus('analyzing');
      if (!analyzingJobResult.success) {
        throw new Error(analyzingJobResult.error.message);
      }
      await this.processingJobRepository.save(analyzingJobResult.value);
      await this.videoRepository.save(video.withStatus('processing'));
      this.log('Status updated to analyzing');

      // Get video metadata from Google Drive
      this.log('Fetching video metadata from Google Drive...');
      const metadata = await this.storageGateway.getFileMetadata(video.googleDriveFileId);
      this.log('Got video metadata', {
        name: metadata.name,
        size: metadata.size,
        parents: metadata.parents,
      });
      const videoWithMetadataResult = video.withMetadata({
        title: metadata.name,
        fileSizeBytes: metadata.size,
      });
      if (videoWithMetadataResult.success) {
        await this.videoRepository.save(videoWithMetadataResult.value);
      }

      // Download video for audio extraction
      this.log('Downloading video from Google Drive...');
      const videoBuffer = await this.storageGateway.downloadFile(video.googleDriveFileId);
      this.log('Video downloaded', { sizeBytes: videoBuffer.length });

      // Extract audio from video (FLAC is smaller than WAV)
      this.log('Extracting audio from video...');
      const audioBuffer = await this.videoProcessingService.extractAudio(videoBuffer, 'flac');
      this.log('Audio extracted', { sizeBytes: audioBuffer.length });

      // Transcribe audio using Speech-to-Text (Batch API for long audio support)
      this.log('Starting transcription (Batch API)...');
      const transcription = await this.transcriptionGateway.transcribeLongAudio({
        audioBuffer,
        mimeType: 'audio/flac',
      });
      this.log('Transcription completed', {
        fullTextLength: transcription.fullText.length,
        segmentsCount: transcription.segments.length,
        durationSeconds: transcription.durationSeconds,
      });

      // Build prompt and analyze with AI
      this.log('Building prompt and calling AI...');
      const prompt = this.clipAnalysisPromptService.buildPrompt({
        transcription,
        videoTitle: metadata.name,
        clipInstructions: job.clipInstructions,
      });
      const aiResponseText = await this.aiGateway.generate(prompt);
      this.log('AI response received', { responseLength: aiResponseText.length });
      const aiResponse = this.clipAnalysisPromptService.parseResponse(aiResponseText);
      this.log('AI response parsed', { clipsCount: aiResponse.clips.length });

      // Save AI response
      const jobWithResponse = analyzingJobResult.value.withAiResponse(aiResponseText);
      await this.processingJobRepository.save(jobWithResponse);

      // Extract timestamps
      const timestamps = this.timestampExtractor.extractTimestamps(aiResponse.clips);
      this.log('Timestamps extracted', { timestampsCount: timestamps.length });

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
      this.log('Clips created', { clipsCount: clips.length });

      await this.clipRepository.saveMany(clips);

      // Update status to extracting
      const extractingJobResult = jobWithResponse.withStatus('extracting');
      if (!extractingJobResult.success) {
        throw new Error(extractingJobResult.error.message);
      }
      await this.processingJobRepository.save(extractingJobResult.value);
      this.log('Status updated to extracting');

      // Get or create output folder
      // Use configured output folder (shared drive) if available, otherwise fall back to video's parent
      const parentFolder = this.outputFolderId ?? metadata.parents?.[0];
      this.log('Determining output folder', {
        configuredOutputFolderId: this.outputFolderId,
        videoParentFolder: metadata.parents?.[0],
        selectedParentFolder: parentFolder,
      });
      const shortsFolder = await this.storageGateway.findOrCreateFolder('ショート用', parentFolder);
      this.log('Output folder ready', {
        shortsFolderId: shortsFolder.id,
        shortsFolderName: shortsFolder.name,
      });

      // Update status to uploading
      const uploadingJobResult = extractingJobResult.value.withStatus('uploading');
      if (!uploadingJobResult.success) {
        throw new Error(uploadingJobResult.error.message);
      }
      await this.processingJobRepository.save(uploadingJobResult.value);
      this.log('Status updated to uploading');

      // Process each clip
      for (const [i, clip] of clips.entries()) {
        this.log(`Processing clip ${i + 1}/${clips.length}`, {
          clipId: clip.id,
          title: clip.title,
          startTime: clip.startTimeSeconds,
          endTime: clip.endTimeSeconds,
        });
        try {
          // Update clip status
          await this.clipRepository.save(clip.withStatus('processing'));

          // Extract clip using FFmpeg
          this.log(`Extracting clip ${i + 1}...`);
          const clipBuffer = await this.videoProcessingService.extractClip(
            videoBuffer,
            clip.startTimeSeconds,
            clip.endTimeSeconds
          );
          this.log(`Clip ${i + 1} extracted`, { sizeBytes: clipBuffer.length });

          // Upload clip
          const fileName = `${clip.title ?? clip.id}.mp4`;
          this.log(`Uploading clip ${i + 1}...`, { fileName, parentFolderId: shortsFolder.id });
          const uploadedFile = await this.storageGateway.uploadFile({
            name: fileName,
            mimeType: 'video/mp4',
            content: clipBuffer,
            parentFolderId: shortsFolder.id,
          });
          this.log(`Clip ${i + 1} uploaded`, {
            fileId: uploadedFile.id,
            webViewLink: uploadedFile.webViewLink,
          });

          // Update clip with Google Drive info
          const completedClip = clip
            .withGoogleDriveInfo(uploadedFile.id, uploadedFile.webViewLink)
            .withStatus('completed');
          await this.clipRepository.save(completedClip);
          this.log(`Clip ${i + 1} completed`);
        } catch (clipError) {
          const errorMessage =
            clipError instanceof Error ? clipError.message : 'Unknown error processing clip';
          this.log(`Clip ${i + 1} failed`, { error: errorMessage });
          await this.clipRepository.save(clip.withStatus('failed', errorMessage));
        }
      }

      // Create metadata file
      this.log('Creating metadata file...');
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
      this.log('Metadata file uploaded');

      // Update job to completed
      const completedJobResult = uploadingJobResult.value.withStatus('completed');
      if (!completedJobResult.success) {
        throw new Error(completedJobResult.error.message);
      }
      await this.processingJobRepository.save(completedJobResult.value);

      // Update video to completed
      const updatedVideo = videoWithMetadataResult.success ? videoWithMetadataResult.value : video;
      await this.videoRepository.save(updatedVideo.withStatus('completed'));
      this.log('Processing completed successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('Processing failed', { error: errorMessage });

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
