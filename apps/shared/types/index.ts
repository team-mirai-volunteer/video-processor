// Video types
export type {
  Transcription,
  TranscriptionPhase,
  TranscriptionSegment,
  Video,
  VideoStatus,
  VideoSummary,
  VideoWithRelations,
} from './video.js';

// Clip types
export type {
  Clip,
  ClipExtractionData,
  ClipExtractionResponse,
  ClipStatus,
  ClipSummary,
} from './clip.js';

// ProcessingJob types
export type {
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingJobSummary,
} from './processing-job.js';

// API types
export type {
  CacheVideoResponse,
  ErrorResponse,
  ExtractAudioResponse,
  ExtractClipsRequest,
  ExtractClipsResponse,
  GetClipResponse,
  GetClipsResponse,
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  GetVideoResponse,
  GetVideosQuery,
  GetVideosResponse,
  HealthResponse,
  Pagination,
  PaginatedResponse,
  RefinedSentence,
  RefineTranscriptResponse,
  SubmitVideoRequest,
  SubmitVideoResponse,
  TranscribeAudioResponse,
  TranscribeVideoResponse,
} from './api.js';

// Shorts-gen types
export type {
  AssetSourceType,
  MediaType,
  MediaValidationConfig,
  ShortsProject,
  ShortsProjectSummary,
  CreateShortsProjectRequest,
  CreateShortsProjectResponse,
  GetShortsProjectsResponse,
  GetShortsProjectResponse,
  UpdateShortsProjectRequest,
  UpdateShortsProjectResponse,
  DeleteShortsProjectResponse,
  // Planning types
  ShortsPlanning,
  GetShortsPlanningResponse,
  // ComposedVideo types
  ComposedVideo,
  ComposedVideoStatus,
  ComposeVideoRequest,
  ComposeVideoResponse,
  ComposeVideoAcceptedResponse,
  GetComposedVideoResponse,
  // PublishText types
  PublishText,
  GeneratePublishTextRequest,
  GeneratePublishTextResponse,
  UpdatePublishTextRequest,
  GetPublishTextResponse,
  // Script types
  VisualType,
  ShortsScene,
  ShortsScript,
  GetShortsScriptResponse,
  // Asset types
  SceneVoiceAsset,
  GetShortsVoiceResponse,
  SceneSubtitleAsset,
  SceneSubtitles,
  GetShortsSubtitlesResponse,
  SceneImage,
  GetShortsImagesResponse,
  // ReferenceCharacter types
  ReferenceCharacter,
  GetReferenceCharactersResponse,
  CreateReferenceCharacterResponse,
  DeleteReferenceCharacterResponse,
} from './shorts-gen.js';

// Re-export const values
export { MEDIA_VALIDATION } from './shorts-gen.js';
