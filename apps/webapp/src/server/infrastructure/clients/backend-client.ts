import type {
  CacheVideoResponse,
  ComposeVideoAcceptedResponse,
  ComposeVideoRequest,
  ComposeVideoResponse,
  CreateReferenceCharacterResponse,
  CreateShortsProjectRequest,
  CreateShortsProjectResponse,
  DeleteReferenceCharacterResponse,
  ExtractAudioResponse,
  ExtractClipsRequest,
  ExtractClipsResponse,
  GeneratePublishTextRequest,
  GeneratePublishTextResponse,
  GetAllClipsQuery,
  GetAllClipsResponse,
  GetClipsResponse,
  GetComposedVideoResponse,
  GetPublishTextResponse,
  GetReferenceCharactersResponse,
  GetRefinedTranscriptionResponse,
  GetShortsImagesResponse,
  GetShortsPlanningResponse,
  GetShortsProjectResponse,
  GetShortsProjectsResponse,
  GetShortsScriptResponse,
  GetShortsSubtitlesResponse,
  GetShortsVoiceResponse,
  GetTranscriptionResponse,
  GetVideoResponse,
  GetVideosQuery,
  GetVideosResponse,
  RefineTranscriptResponse,
  SubmitVideoRequest,
  SubmitVideoResponse,
  TranscribeAudioResponse,
  TranscribeVideoResponse,
  UpdatePublishTextRequest,
} from '@video-processor/shared';

const BACKEND_URL = process.env.BACKEND_URL || '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

class BackendApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}

type FetchOptions = Omit<RequestInit, 'cache'> & {
  revalidate?: number | false;
};

async function fetchBackend<T>(endpoint: string, options?: FetchOptions): Promise<T> {
  const { revalidate, ...fetchOptions } = options ?? {};
  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    ...fetchOptions,
    ...(revalidate === false ? { cache: 'no-store' as const } : {}),
    ...(typeof revalidate === 'number' ? { next: { revalidate } } : {}),
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BACKEND_API_KEY,
      ...fetchOptions?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new BackendApiError(response.status, error.error || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const backendClient = {
  // Videos
  async getVideos(query?: GetVideosQuery): Promise<GetVideosResponse> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', query.page.toString());
    if (query?.limit) params.set('limit', query.limit.toString());
    if (query?.status) params.set('status', query.status);

    const queryString = params.toString();
    return fetchBackend<GetVideosResponse>(`/api/videos${queryString ? `?${queryString}` : ''}`, {
      revalidate: 10,
    });
  },

  async getVideo(id: string, options?: { revalidate?: number | false }): Promise<GetVideoResponse> {
    return fetchBackend<GetVideoResponse>(`/api/videos/${id}`, options);
  },

  async submitVideo(request: SubmitVideoRequest): Promise<SubmitVideoResponse> {
    return fetchBackend<SubmitVideoResponse>('/api/videos', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async deleteVideo(id: string): Promise<void> {
    await fetchBackend(`/api/videos/${id}`, {
      method: 'DELETE',
    });
  },

  async resetVideo(
    videoId: string,
    step?: 'cache' | 'audio' | 'transcribe' | 'refine' | 'all'
  ): Promise<{ videoId: string; status: string; resetStep: string }> {
    const query = step ? `?step=${step}` : '';
    return fetchBackend<{ videoId: string; status: string; resetStep: string }>(
      `/api/videos/${videoId}/reset${query}`,
      { method: 'POST' }
    );
  },

  // Clips
  async getClips(videoId: string): Promise<GetClipsResponse> {
    return fetchBackend<GetClipsResponse>(`/api/videos/${videoId}/clips`);
  },

  async getAllClips(query?: GetAllClipsQuery): Promise<GetAllClipsResponse> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', query.page.toString());
    if (query?.limit) params.set('limit', query.limit.toString());

    const queryString = params.toString();
    return fetchBackend<GetAllClipsResponse>(`/api/clips${queryString ? `?${queryString}` : ''}`, {
      revalidate: 10,
    });
  },

  async deleteClip(id: string): Promise<void> {
    await fetchBackend(`/api/clips/${id}`, {
      method: 'DELETE',
    });
  },

  async extractClips(videoId: string, request: ExtractClipsRequest): Promise<ExtractClipsResponse> {
    return fetchBackend<ExtractClipsResponse>(`/api/videos/${videoId}/extract-clips`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  // Transcription
  async transcribeVideo(videoId: string): Promise<TranscribeVideoResponse> {
    return fetchBackend<TranscribeVideoResponse>(`/api/videos/${videoId}/transcribe`, {
      method: 'POST',
    });
  },

  async getTranscription(
    videoId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetTranscriptionResponse> {
    return fetchBackend<GetTranscriptionResponse>(`/api/videos/${videoId}/transcription`, options);
  },

  async refineTranscript(videoId: string): Promise<RefineTranscriptResponse> {
    return fetchBackend<RefineTranscriptResponse>(`/api/videos/${videoId}/refine-transcript`, {
      method: 'POST',
    });
  },

  async getRefinedTranscription(
    videoId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetRefinedTranscriptionResponse | null> {
    try {
      return await fetchBackend<GetRefinedTranscriptionResponse>(
        `/api/videos/${videoId}/transcription/refined`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Pipeline Steps
  async cacheVideo(videoId: string): Promise<CacheVideoResponse> {
    return fetchBackend<CacheVideoResponse>(`/api/videos/${videoId}/cache`, {
      method: 'POST',
    });
  },

  async extractAudio(videoId: string): Promise<ExtractAudioResponse> {
    return fetchBackend<ExtractAudioResponse>(`/api/videos/${videoId}/extract-audio`, {
      method: 'POST',
    });
  },

  async transcribeAudio(videoId: string): Promise<TranscribeAudioResponse> {
    return fetchBackend<TranscribeAudioResponse>(`/api/videos/${videoId}/transcribe-audio`, {
      method: 'POST',
    });
  },

  async getTranscriptionSrt(videoId: string): Promise<string> {
    const url = `${BACKEND_URL}/api/videos/${videoId}/transcription/srt`;
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'X-API-Key': BACKEND_API_KEY,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new BackendApiError(response.status, error.error || 'Request failed');
    }

    return response.text();
  },

  // Shorts Gen - Projects
  async getShortsProjects(): Promise<GetShortsProjectsResponse> {
    return fetchBackend<GetShortsProjectsResponse>('/api/shorts-gen/projects', {
      revalidate: false,
    });
  },

  async getShortsProject(
    id: string,
    options?: { revalidate?: number | false }
  ): Promise<GetShortsProjectResponse> {
    return fetchBackend<GetShortsProjectResponse>(`/api/shorts-gen/projects/${id}`, options);
  },

  async createShortsProject(
    request: CreateShortsProjectRequest
  ): Promise<CreateShortsProjectResponse> {
    return fetchBackend<CreateShortsProjectResponse>('/api/shorts-gen/projects', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async deleteShortsProject(id: string): Promise<void> {
    await fetchBackend(`/api/shorts-gen/projects/${id}`, {
      method: 'DELETE',
    });
  },

  // Shorts Gen - Planning
  async getShortsPlanning(
    projectId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetShortsPlanningResponse | null> {
    try {
      return await fetchBackend<GetShortsPlanningResponse>(
        `/api/shorts-gen/projects/${projectId}/planning`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Shorts Gen - Script
  async getShortsScript(
    projectId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetShortsScriptResponse | null> {
    try {
      return await fetchBackend<GetShortsScriptResponse>(
        `/api/shorts-gen/projects/${projectId}/script`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Shorts Gen - Compose
  async composeVideo(request: ComposeVideoRequest): Promise<ComposeVideoAcceptedResponse> {
    return fetchBackend<ComposeVideoAcceptedResponse>('/api/shorts-gen/compose', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async composeVideoSync(request: ComposeVideoRequest): Promise<ComposeVideoResponse> {
    return fetchBackend<ComposeVideoResponse>('/api/shorts-gen/compose/sync', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async getComposedVideoByProject(
    projectId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetComposedVideoResponse | null> {
    try {
      return await fetchBackend<GetComposedVideoResponse>(
        `/api/shorts-gen/compose/project/${projectId}`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getComposedVideo(
    id: string,
    options?: { revalidate?: number | false }
  ): Promise<GetComposedVideoResponse | null> {
    try {
      return await fetchBackend<GetComposedVideoResponse>(`/api/shorts-gen/compose/${id}`, options);
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async deleteComposedVideo(id: string): Promise<void> {
    await fetchBackend(`/api/shorts-gen/compose/${id}`, {
      method: 'DELETE',
    });
  },

  // Shorts Gen - Publish Text
  async generatePublishText(
    request: GeneratePublishTextRequest
  ): Promise<GeneratePublishTextResponse> {
    return fetchBackend<GeneratePublishTextResponse>('/api/shorts-gen/publish', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async getPublishTextByProject(
    projectId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetPublishTextResponse | null> {
    try {
      return await fetchBackend<GetPublishTextResponse>(
        `/api/shorts-gen/publish/project/${projectId}`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getPublishText(
    id: string,
    options?: { revalidate?: number | false }
  ): Promise<GetPublishTextResponse | null> {
    try {
      return await fetchBackend<GetPublishTextResponse>(`/api/shorts-gen/publish/${id}`, options);
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async updatePublishText(
    id: string,
    request: UpdatePublishTextRequest
  ): Promise<GetPublishTextResponse> {
    return fetchBackend<GetPublishTextResponse>(`/api/shorts-gen/publish/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  async deletePublishText(id: string): Promise<void> {
    await fetchBackend(`/api/shorts-gen/publish/${id}`, {
      method: 'DELETE',
    });
  },

  // Shorts Gen - Assets
  async getShortsVoice(
    scriptId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetShortsVoiceResponse | null> {
    try {
      return await fetchBackend<GetShortsVoiceResponse>(
        `/api/shorts-gen/scripts/${scriptId}/voice`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getShortsSubtitles(
    scriptId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetShortsSubtitlesResponse | null> {
    try {
      return await fetchBackend<GetShortsSubtitlesResponse>(
        `/api/shorts-gen/scripts/${scriptId}/subtitles`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  async getShortsImages(
    scriptId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetShortsImagesResponse | null> {
    try {
      return await fetchBackend<GetShortsImagesResponse>(
        `/api/shorts-gen/scripts/${scriptId}/images`,
        options
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },

  // Shorts Gen - Reference Characters
  async getReferenceCharacters(
    projectId: string,
    options?: { revalidate?: number | false }
  ): Promise<GetReferenceCharactersResponse> {
    return fetchBackend<GetReferenceCharactersResponse>(
      `/api/shorts-gen/projects/${projectId}/reference-characters`,
      options
    );
  },

  async createReferenceCharacter(
    projectId: string,
    formData: FormData
  ): Promise<CreateReferenceCharacterResponse> {
    const url = `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/reference-characters`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-API-Key': BACKEND_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new BackendApiError(response.status, error.error || 'Request failed');
    }

    return response.json();
  },

  async deleteReferenceCharacter(
    projectId: string,
    characterId: string
  ): Promise<DeleteReferenceCharacterResponse> {
    return fetchBackend<DeleteReferenceCharacterResponse>(
      `/api/shorts-gen/projects/${projectId}/reference-characters/${characterId}`,
      { method: 'DELETE' }
    );
  },
};

export { BackendApiError };
