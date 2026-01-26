import type {
  ExtractClipsRequest,
  ExtractClipsResponse,
  GetClipsResponse,
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  GetVideoResponse,
  GetVideosQuery,
  GetVideosResponse,
  RefineTranscriptResponse,
  SubmitVideoRequest,
  SubmitVideoResponse,
  TranscribeVideoResponse,
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

async function fetchBackend<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${BACKEND_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': BACKEND_API_KEY,
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new BackendApiError(response.status, error.error || 'Request failed');
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

  async getVideo(id: string): Promise<GetVideoResponse> {
    return fetchBackend<GetVideoResponse>(`/api/videos/${id}`);
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

  async getTranscription(videoId: string): Promise<GetTranscriptionResponse> {
    return fetchBackend<GetTranscriptionResponse>(`/api/videos/${videoId}/transcription`);
  },

  async refineTranscript(videoId: string): Promise<RefineTranscriptResponse> {
    return fetchBackend<RefineTranscriptResponse>(`/api/videos/${videoId}/refine-transcript`, {
      method: 'POST',
    });
  },

  async getRefinedTranscription(videoId: string): Promise<GetRefinedTranscriptionResponse | null> {
    try {
      return await fetchBackend<GetRefinedTranscriptionResponse>(
        `/api/videos/${videoId}/transcription/refined`
      );
    } catch (error) {
      if (error instanceof BackendApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
};

export { BackendApiError };
