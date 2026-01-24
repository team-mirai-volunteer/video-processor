import type { ProcessingJob } from '../models/processing-job.js';

export interface ProcessingJobRepositoryGateway {
  /**
   * Save a processing job (create or update)
   */
  save(job: ProcessingJob): Promise<void>;

  /**
   * Find a processing job by ID
   */
  findById(id: string): Promise<ProcessingJob | null>;

  /**
   * Find all processing jobs for a video
   */
  findByVideoId(videoId: string): Promise<ProcessingJob[]>;

  /**
   * Find pending jobs that need processing
   */
  findPending(): Promise<ProcessingJob[]>;
}
