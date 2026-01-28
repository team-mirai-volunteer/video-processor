import type {
  CacheVideoResponse,
  CreateShortsProjectRequest,
  CreateShortsProjectResponse,
  DeleteShortsProjectResponse,
  ExtractAudioResponse,
  ExtractClipsRequest,
  ExtractClipsResponse,
  GetClipsResponse,
  GetRefinedTranscriptionResponse,
  GetShortsProjectResponse,
  GetShortsProjectsQuery,
  GetShortsProjectsResponse,
  GetTranscriptionResponse,
  GetVideoResponse,
  GetVideosQuery,
  GetVideosResponse,
  RefineTranscriptResponse,
  SubmitVideoRequest,
  SubmitVideoResponse,
  TranscribeAudioResponse,
  TranscribeVideoResponse,
  UpdateShortsProjectRequest,
  UpdateShortsProjectResponse,
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
    return fetchBackend<GetVideosResponse>(`/api/videos${queryString ? `?${queryString}` : ''}`);
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

  // Clips
  async getClips(videoId: string): Promise<GetClipsResponse> {
    return fetchBackend<GetClipsResponse>(`/api/videos/${videoId}/clips`);
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

  // Shorts Generation
  async getShortsProjects(query?: GetShortsProjectsQuery): Promise<GetShortsProjectsResponse> {
    const params = new URLSearchParams();
    if (query?.page) params.set('page', query.page.toString());
    if (query?.limit) params.set('limit', query.limit.toString());

    const queryString = params.toString();
    return fetchBackend<GetShortsProjectsResponse>(
      `/api/shorts-gen/projects${queryString ? `?${queryString}` : ''}`
    );
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

  async updateShortsProject(
    id: string,
    request: UpdateShortsProjectRequest
  ): Promise<UpdateShortsProjectResponse> {
    return fetchBackend<UpdateShortsProjectResponse>(`/api/shorts-gen/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(request),
    });
  },

  async deleteShortsProject(id: string): Promise<DeleteShortsProjectResponse> {
    return fetchBackend<DeleteShortsProjectResponse>(`/api/shorts-gen/projects/${id}`, {
      method: 'DELETE',
    });
  },
};

export { BackendApiError };
