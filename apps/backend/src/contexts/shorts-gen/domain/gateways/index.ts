// Asset Registry Gateway
export type {
  AssetRegistryGateway,
  AssetRegistryError,
  VideoAssetInfo,
  BgmAssetInfo,
} from './asset-registry.gateway.js';

// Asset Storage Gateway
export type {
  AssetStorageGateway,
  AssetStorageUploadParams,
  AssetStorageUploadResult,
} from './asset-storage.gateway.js';

// TTS Gateway
export type {
  TtsGateway,
  TtsGatewayError,
  TtsSynthesizeParams,
  TtsSynthesizeResult,
} from './tts.gateway.js';

// Image Generation Gateway
export type {
  ImageGenGateway,
  ImageGenGatewayError,
  ImageGenParams,
  ImageGenResult,
} from './image-gen.gateway.js';

// Agentic AI Gateway
export type {
  AgenticAiGateway,
  AgenticAiGatewayError,
  ChatMessage,
  ChatParams,
  ChatCompletionResult,
  MessageRole,
  ToolDefinition,
  ToolParameterSchema,
  ToolCall,
  StreamChunk,
  StreamChunkType,
} from './agentic-ai.gateway.js';

// Video Compose Gateway
export type {
  VideoComposeGateway,
  VideoComposeGatewayError,
  VideoComposeParams,
  VideoComposeResult,
  ComposeSceneInput,
  SceneVisual,
  SceneVisualType,
  SubtitleOverlay,
} from './video-compose.gateway.js';

// Subtitle Generator Gateway
export type {
  SubtitleGeneratorGateway,
  SubtitleGeneratorGatewayError,
  SubtitleGenerateParams,
  SubtitleGenerateResult,
  SubtitleBatchGenerateParams,
  SubtitleBatchGenerateResult,
  SubtitleStyle,
} from './subtitle-generator.gateway.js';

// Repository Gateways
export type {
  ShortsProjectRepositoryGateway,
  FindProjectsOptions,
  FindProjectsResult,
} from './project-repository.gateway.js';

export type { ShortsPlanningRepositoryGateway } from './planning-repository.gateway.js';

export type { ShortsScriptRepositoryGateway } from './script-repository.gateway.js';

export type { ShortsSceneRepositoryGateway } from './scene-repository.gateway.js';

export type { ShortsSceneAssetRepositoryGateway } from './scene-asset-repository.gateway.js';

export type { ShortsComposedVideoRepositoryGateway } from './composed-video-repository.gateway.js';

export type { ShortsPublishTextRepositoryGateway } from './publish-text-repository.gateway.js';
