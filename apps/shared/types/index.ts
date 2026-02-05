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

// ClipSubtitle types
export type {
  ClipSubtitle,
  ClipSubtitleSegment,
  ClipSubtitleStatus,
} from './clip-subtitle.js';

// ClipSubtitle constants
export { SUBTITLE_MAX_CHARS_PER_LINE, SUBTITLE_MAX_LINES } from './clip-subtitle.js';

// ProcessingJob types
export type {
  ProcessingJob,
  ProcessingJobStatus,
  ProcessingJobSummary,
} from './processing-job.js';

// API types
export type {
  AllClipSummary,
  CacheVideoResponse,
  ComposeSubtitledClipRequest,
  ComposeSubtitledClipResponse,
  ConfirmClipSubtitleResponse,
  ErrorResponse,
  ExtractAudioResponse,
  ExtractClipByTimeRequest,
  ExtractClipByTimeResponse,
  ExtractClipsRequest,
  ExtractClipsResponse,
  GenerateClipSubtitlesResponse,
  GetAllClipsQuery,
  GetAllClipsResponse,
  GetClipResponse,
  GetClipsResponse,
  GetClipSubtitleResponse,
  GetClipVideoUrlResponse,
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  GetVideoResponse,
  GetVideosQuery,
  GetVideosResponse,
  HealthResponse,
  OutputFormat,
  PaddingColor,
  Pagination,
  PaginatedResponse,
  RefinedSentence,
  RefineTranscriptResponse,
  SubmitVideoRequest,
  SubmitVideoResponse,
  TranscribeAudioResponse,
  TranscribeVideoResponse,
  UpdateClipSubtitleRequest,
  UpdateClipSubtitleResponse,
  UploadSubtitledClipResponse,
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
