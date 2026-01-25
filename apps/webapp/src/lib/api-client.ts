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

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function fetchApi<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(response.status, error.error || 'Request failed');
  }

  return response.json();
}

// Mock data
const mockVideos: GetVideosResponse = {
  data: [
    {
      id: '1',
      googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
      title: 'チームみらい紹介動画',
      status: 'completed',
      clipCount: 3,
      createdAt: new Date('2024-01-15T10:00:00Z'),
    },
    {
      id: '2',
      googleDriveUrl: 'https://drive.google.com/file/d/def456/view',
      title: '政策説明ライブ配信',
      status: 'transcribing',
      clipCount: 0,
      createdAt: new Date('2024-01-16T14:30:00Z'),
    },
    {
      id: '3',
      googleDriveUrl: 'https://drive.google.com/file/d/ghi789/view',
      title: '質疑応答セッション',
      status: 'pending',
      clipCount: 0,
      createdAt: new Date('2024-01-17T09:00:00Z'),
    },
  ],
  pagination: {
    page: 1,
    limit: 20,
    total: 3,
    totalPages: 1,
  },
};

const mockVideoDetail: GetVideoResponse = {
  id: '1',
  googleDriveFileId: 'abc123',
  googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
  title: 'チームみらい紹介動画',
  description: 'チームみらいの活動紹介動画です。',
  durationSeconds: 3600,
  fileSizeBytes: 1500000000,
  status: 'completed',
  errorMessage: null,
  clips: [
    {
      id: 'clip-1',
      videoId: '1',
      googleDriveFileId: 'clip-abc1',
      googleDriveUrl: 'https://drive.google.com/file/d/clip-abc1/view',
      title: '自己紹介',
      startTimeSeconds: 0,
      endTimeSeconds: 45,
      durationSeconds: 45,
      transcript: 'こんにちは、チームみらいです。今日は私たちの活動についてご紹介します。',
      status: 'completed',
      errorMessage: null,
      createdAt: new Date('2024-01-15T10:30:00Z'),
      updatedAt: new Date('2024-01-15T10:35:00Z'),
    },
    {
      id: 'clip-2',
      videoId: '1',
      googleDriveFileId: 'clip-abc2',
      googleDriveUrl: 'https://drive.google.com/file/d/clip-abc2/view',
      title: '政策説明',
      startTimeSeconds: 300,
      endTimeSeconds: 360,
      durationSeconds: 60,
      transcript: '私たちの政策は、若者の政治参加を促進することです。',
      status: 'completed',
      errorMessage: null,
      createdAt: new Date('2024-01-15T10:35:00Z'),
      updatedAt: new Date('2024-01-15T10:40:00Z'),
    },
    {
      id: 'clip-3',
      videoId: '1',
      googleDriveFileId: 'clip-abc3',
      googleDriveUrl: 'https://drive.google.com/file/d/clip-abc3/view',
      title: '質疑応答ハイライト',
      startTimeSeconds: 1800,
      endTimeSeconds: 1840,
      durationSeconds: 40,
      transcript: 'ご質問ありがとうございます。その点については...',
      status: 'completed',
      errorMessage: null,
      createdAt: new Date('2024-01-15T10:40:00Z'),
      updatedAt: new Date('2024-01-15T10:45:00Z'),
    },
  ],
  processingJobs: [
    {
      id: 'job-1',
      status: 'completed',
      clipInstructions: '自己紹介、政策説明、質疑応答のハイライトを切り抜いてください。',
      completedAt: new Date('2024-01-15T10:45:00Z'),
    },
  ],
  transcription: {
    id: 'transcription-1',
    videoId: '1',
    fullText:
      'こんにちは、チームみらいです。今日は私たちの活動についてご紹介します。私たちの政策は、若者の政治参加を促進することです。',
    segments: [
      {
        text: 'こんにちは',
        startTimeSeconds: 0,
        endTimeSeconds: 1.5,
        confidence: 0.95,
      },
    ],
    languageCode: 'ja-JP',
    durationSeconds: 3600,
    createdAt: new Date('2024-01-15T10:20:00Z'),
  },
  createdAt: new Date('2024-01-15T10:00:00Z'),
  updatedAt: new Date('2024-01-15T10:45:00Z'),
};

// API Client
export const apiClient = {
  async getVideos(query?: GetVideosQuery): Promise<GetVideosResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return mockVideos;
    }

    const params = new URLSearchParams();
    if (query?.page) params.set('page', query.page.toString());
    if (query?.limit) params.set('limit', query.limit.toString());
    if (query?.status) params.set('status', query.status);

    const queryString = params.toString();
    return fetchApi<GetVideosResponse>(`/api/videos${queryString ? `?${queryString}` : ''}`);
  },

  async getVideo(id: string): Promise<GetVideoResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      if (id === '1') {
        return mockVideoDetail;
      }
      throw new ApiError(404, 'Video not found');
    }

    return fetchApi<GetVideoResponse>(`/api/videos/${id}`);
  },

  async getClips(videoId: string): Promise<GetClipsResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        data: mockVideoDetail.clips.map((clip) => ({
          id: clip.id,
          title: clip.title,
          startTimeSeconds: clip.startTimeSeconds,
          endTimeSeconds: clip.endTimeSeconds,
          durationSeconds: clip.durationSeconds,
          googleDriveUrl: clip.googleDriveUrl,
          transcript: clip.transcript,
          status: clip.status,
        })),
      };
    }

    return fetchApi<GetClipsResponse>(`/api/videos/${videoId}/clips`);
  },

  async submitVideo(request: SubmitVideoRequest): Promise<SubmitVideoResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        id: 'new-video-id',
        googleDriveFileId: 'new-file-id',
        googleDriveUrl: request.googleDriveUrl,
        status: 'pending',
        createdAt: new Date(),
      };
    }

    return fetchApi<SubmitVideoResponse>('/api/videos', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async transcribeVideo(videoId: string): Promise<TranscribeVideoResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        videoId,
        status: 'transcribing',
      };
    }

    return fetchApi<TranscribeVideoResponse>(`/api/videos/${videoId}/transcribe`, {
      method: 'POST',
    });
  },

  async getTranscription(videoId: string): Promise<GetTranscriptionResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        id: 'transcription-1',
        videoId,
        fullText:
          'これはモックのトランスクリプトです。実際のトランスクリプトは動画の音声から生成されます。',
        segments: [
          {
            text: 'これは',
            startTimeSeconds: 0,
            endTimeSeconds: 0.5,
            confidence: 0.95,
          },
          {
            text: 'モックの',
            startTimeSeconds: 0.5,
            endTimeSeconds: 1.0,
            confidence: 0.92,
          },
          {
            text: 'トランスクリプトです',
            startTimeSeconds: 1.0,
            endTimeSeconds: 2.0,
            confidence: 0.98,
          },
        ],
        languageCode: 'ja-JP',
        durationSeconds: 60,
        createdAt: new Date(),
      };
    }

    return fetchApi<GetTranscriptionResponse>(`/api/videos/${videoId}/transcription`);
  },

  async extractClips(videoId: string, request: ExtractClipsRequest): Promise<ExtractClipsResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      return {
        videoId,
        status: 'extracting',
      };
    }

    return fetchApi<ExtractClipsResponse>(`/api/videos/${videoId}/extract-clips`, {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  async refineTranscript(videoId: string): Promise<RefineTranscriptResponse> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      return {
        videoId,
        status: 'refined',
      };
    }

    return fetchApi<RefineTranscriptResponse>(`/api/videos/${videoId}/refine-transcript`, {
      method: 'POST',
    });
  },

  async getRefinedTranscription(videoId: string): Promise<GetRefinedTranscriptionResponse | null> {
    if (USE_MOCK) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      return {
        id: 'refined-transcription-1',
        transcriptionId: 'transcription-1',
        fullText:
          'どうも、こんにちは。チームみらい党首の安野たかひろです。本日は年始ということで、チームみらいが2026年に成し遂げること、題して2026年プランを発表したいと思います。',
        sentences: [
          {
            text: 'どうも、こんにちは。',
            startTimeSeconds: 0.08,
            endTimeSeconds: 0.8,
            originalSegmentIndices: [0, 1, 2],
          },
          {
            text: 'チームみらい党首の安野たかひろです。',
            startTimeSeconds: 0.88,
            endTimeSeconds: 3.12,
            originalSegmentIndices: [3, 4, 5, 6, 7],
          },
          {
            text: '本日は年始ということで、チームみらいが2026年に成し遂げること、題して2026年プランを発表したいと思います。',
            startTimeSeconds: 3.36,
            endTimeSeconds: 12.68,
            originalSegmentIndices: [8, 9, 10, 11, 12, 13, 14, 15, 16, 17],
          },
        ],
        dictionaryVersion: '1.0.0',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    try {
      return await fetchApi<GetRefinedTranscriptionResponse>(
        `/api/videos/${videoId}/transcription/refined`
      );
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        return null;
      }
      throw error;
    }
  },
};

export { ApiError };
