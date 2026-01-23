// Video types
export {
  VideoStatus,
  type Video,
  type CreateVideoInput,
  type VideoWithRelations,
  type VideoListItem,
} from './video.js';

// Clip types
export {
  ClipStatus,
  type Clip,
  type CreateClipInput,
  type ClipTimestamp,
  type AIClipExtractionResponse,
} from './clip.js';

// Processing job types
export {
  ProcessingJobStatus,
  type ProcessingJob,
  type CreateProcessingJobInput,
} from './processing-job.js';

// API types
export type {
  // Request types
  CreateVideoRequest,
  GetVideosQuery,
  // Response types
  PaginationMeta,
  PaginatedResponse,
  CreateVideoResponse,
  GetVideosResponse,
  GetVideoDetailResponse,
  GetVideoClipsResponse,
  GetClipDetailResponse,
  HealthCheckResponse,
  // Error types
  ApiErrorResponse,
} from './api.js';
