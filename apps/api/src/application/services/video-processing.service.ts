import { ProcessVideoUseCase } from '../usecases/process-video.usecase.js';
import { ProcessingJobRepository } from '../../infrastructure/repositories/processing-job.repository.js';

/**
 * Video processing service
 * Handles background processing of video jobs
 */
export class VideoProcessingService {
  private processingJobRepository: ProcessingJobRepository;
  private processVideoUseCase: ProcessVideoUseCase;
  private isRunning = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.processingJobRepository = new ProcessingJobRepository();
    this.processVideoUseCase = new ProcessVideoUseCase();
  }

  /**
   * Start the background processing service
   */
  start(intervalMs = 10000): void {
    if (this.isRunning) {
      console.log('[VideoProcessingService] Already running');
      return;
    }

    this.isRunning = true;
    console.log('[VideoProcessingService] Starting background processor');

    // Process immediately on start
    this.processNextJob().catch(console.error);

    // Then process on interval
    this.processingInterval = setInterval(() => {
      this.processNextJob().catch(console.error);
    }, intervalMs);
  }

  /**
   * Stop the background processing service
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    console.log('[VideoProcessingService] Stopped background processor');
  }

  /**
   * Process the next pending job
   */
  private async processNextJob(): Promise<void> {
    try {
      const pendingJobs = await this.processingJobRepository.findPending();

      if (pendingJobs.length === 0) {
        return;
      }

      const job = pendingJobs[0];
      console.log(`[VideoProcessingService] Processing job: ${job.id}`);

      await this.processVideoUseCase.execute({ processingJobId: job.id });

      console.log(`[VideoProcessingService] Completed job: ${job.id}`);
    } catch (error) {
      console.error('[VideoProcessingService] Error processing job:', error);
    }
  }

  /**
   * Manually trigger processing of a specific job
   */
  async processJob(processingJobId: string): Promise<void> {
    console.log(`[VideoProcessingService] Manually processing job: ${processingJobId}`);
    await this.processVideoUseCase.execute({ processingJobId });
  }
}

// Singleton instance
let videoProcessingService: VideoProcessingService | null = null;

/**
 * Get the video processing service instance
 */
export function getVideoProcessingService(): VideoProcessingService {
  if (!videoProcessingService) {
    videoProcessingService = new VideoProcessingService();
  }
  return videoProcessingService;
}
