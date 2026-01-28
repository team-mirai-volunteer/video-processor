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
