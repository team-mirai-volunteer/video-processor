// ShortsProject types
export interface ShortsProject {
  id: string;
  title: string;
  aspectRatio: string;
  resolutionWidth: number;
  resolutionHeight: number;
  createdAt: string;
  updatedAt: string;
}

export interface ShortsProjectSummary {
  id: string;
  title: string;
  aspectRatio: string;
  createdAt: string;
  updatedAt: string;
  hasPlan: boolean;
  hasScript: boolean;
  hasComposedVideo: boolean;
}

// API Request/Response types
export interface CreateShortsProjectRequest {
  title: string;
  aspectRatio?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
}

export interface CreateShortsProjectResponse {
  data: ShortsProject;
}

export interface GetShortsProjectsResponse {
  data: ShortsProjectSummary[];
}

export interface GetShortsProjectResponse {
  data: ShortsProject;
}

export interface UpdateShortsProjectRequest {
  title?: string;
  aspectRatio?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
}

export interface UpdateShortsProjectResponse {
  data: ShortsProject;
}

export interface DeleteShortsProjectResponse {
  success: boolean;
}

// Planning types
export interface ShortsPlanning {
  id: string;
  projectId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GetShortsPlanningResponse {
  id: string;
  projectId: string;
  content: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// ComposedVideo types
export type ComposedVideoStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ComposedVideo {
  id: string;
  projectId: string;
  scriptId: string;
  fileUrl: string | null;
  durationSeconds: number | null;
  status: ComposedVideoStatus;
  errorMessage: string | null;
  bgmKey: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ComposeVideoRequest {
  projectId: string;
  scriptId: string;
  bgmKey?: string | null;
}

export interface ComposeVideoResponse {
  composedVideoId: string;
  fileUrl: string;
  durationSeconds: number;
}

export interface ComposeVideoAcceptedResponse {
  message: string;
  projectId: string;
  scriptId: string;
}

export interface GetComposedVideoResponse {
  id: string;
  projectId: string;
  scriptId: string;
  fileUrl: string | null;
  durationSeconds: number | null;
  status: string;
  errorMessage: string | null;
  bgmKey: string | null;
  createdAt: string;
  updatedAt: string;
}

// PublishText types
export interface PublishText {
  id: string;
  projectId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePublishTextRequest {
  projectId: string;
}

export interface GeneratePublishTextResponse {
  publishTextId: string;
  title: string;
  description: string;
}

export interface UpdatePublishTextRequest {
  title?: string;
  description?: string;
}

export interface GetPublishTextResponse {
  id: string;
  projectId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

// Script types
export type VisualType = 'image_gen' | 'stock_video' | 'solid_color';

export interface ShortsScene {
  id: string;
  order: number;
  summary: string;
  visualType: VisualType;
  voiceText: string | null;
  subtitles: string[];
  silenceDurationMs: number | null;
  stockVideoKey: string | null;
  solidColor: string | null;
  imagePrompt: string | null;
  imageStyleHint: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ShortsScript {
  id: string;
  projectId: string;
  planningId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface GetShortsScriptResponse {
  id: string;
  projectId: string;
  planningId: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  scenes: ShortsScene[];
}

// Asset types
export interface SceneVoiceAsset {
  sceneId: string;
  sceneOrder: number;
  hasVoice: boolean;
  hasVoiceText: boolean;
  asset: {
    assetId: string;
    fileUrl: string;
    durationMs: number;
  } | null;
}

export interface GetShortsVoiceResponse {
  scriptId: string;
  totalScenes: number;
  scenesWithVoice: number;
  sceneVoices: SceneVoiceAsset[];
}

export interface SceneSubtitleAsset {
  assetId: string;
  fileUrl: string;
  subtitleIndex: number;
  subtitleText: string;
}

export interface SceneSubtitles {
  sceneId: string;
  sceneOrder: number;
  subtitleCount: number;
  hasSubtitles: boolean;
  assetsGenerated: number;
  assets: SceneSubtitleAsset[];
}

export interface GetShortsSubtitlesResponse {
  scriptId: string;
  totalScenes: number;
  scenesWithSubtitles: number;
  totalAssetsGenerated: number;
  sceneSubtitles: SceneSubtitles[];
}

export interface SceneImage {
  sceneId: string;
  sceneOrder: number;
  visualType: VisualType;
  hasImagePrompt: boolean;
  imagePrompt: string | null;
  imageStyleHint: string | null;
  hasImage: boolean;
  asset: {
    assetId: string;
    fileUrl: string;
  } | null;
}

export interface GetShortsImagesResponse {
  scriptId: string;
  totalScenes: number;
  imageGenScenes: number;
  scenesWithPrompt: number;
  scenesWithImage: number;
  sceneImages: SceneImage[];
}
