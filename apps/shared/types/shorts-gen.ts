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
