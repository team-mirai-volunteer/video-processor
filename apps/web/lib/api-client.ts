import type {
  CreateVideoRequest,
  CreateVideoResponse,
  GetVideoDetailResponse,
  GetVideosQuery,
  GetVideosResponse,
  VideoListItem,
  Clip,
} from '@video-processor/shared';

const API_URL = process.env.NEXT_PUBLIC_API_URL;

// ============================================
// Mock Data
// ============================================

const mockVideos: VideoListItem[] = [
  {
    id: '1',
    googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
    title: 'チームみらい 政策説明会 2024年1月',
    status: 'completed',
    clipCount: 3,
    createdAt: new Date('2024-01-15T10:30:00Z'),
  },
  {
    id: '2',
    googleDriveUrl: 'https://drive.google.com/file/d/def456/view',
    title: '市民との対話集会',
    status: 'processing',
    clipCount: 0,
    createdAt: new Date('2024-01-16T14:00:00Z'),
  },
  {
    id: '3',
    googleDriveUrl: 'https://drive.google.com/file/d/ghi789/view',
    title: '記者会見 - 新政策発表',
    status: 'pending',
    clipCount: 0,
    createdAt: new Date('2024-01-17T09:00:00Z'),
  },
  {
    id: '4',
    googleDriveUrl: 'https://drive.google.com/file/d/jkl012/view',
    title: '街頭演説 新宿駅前',
    status: 'failed',
    clipCount: 0,
    createdAt: new Date('2024-01-18T16:00:00Z'),
  },
];

const mockClips: Clip[] = [
  {
    id: 'clip-1',
    videoId: '1',
    googleDriveFileId: 'clip-abc123',
    googleDriveUrl: 'https://drive.google.com/file/d/clip-abc123/view',
    title: '自己紹介',
    startTimeSeconds: 0,
    endTimeSeconds: 45,
    durationSeconds: 45,
    transcript: 'こんにちは、チームみらいの代表です。本日は政策についてお話しします。',
    status: 'completed',
    errorMessage: null,
    createdAt: new Date('2024-01-15T11:00:00Z'),
    updatedAt: new Date('2024-01-15T11:00:00Z'),
  },
  {
    id: 'clip-2',
    videoId: '1',
    googleDriveFileId: 'clip-def456',
    googleDriveUrl: 'https://drive.google.com/file/d/clip-def456/view',
    title: '教育政策について',
    startTimeSeconds: 300,
    endTimeSeconds: 355,
    durationSeconds: 55,
    transcript: '教育こそが未来を創る基盤です。私たちは全ての子供たちに質の高い教育を届けることを約束します。',
    status: 'completed',
    errorMessage: null,
    createdAt: new Date('2024-01-15T11:05:00Z'),
    updatedAt: new Date('2024-01-15T11:05:00Z'),
  },
  {
    id: 'clip-3',
    videoId: '1',
    googleDriveFileId: 'clip-ghi789',
    googleDriveUrl: 'https://drive.google.com/file/d/clip-ghi789/view',
    title: '質疑応答ハイライト',
    startTimeSeconds: 1800,
    endTimeSeconds: 1850,
    durationSeconds: 50,
    transcript: '市民の皆様からのご質問に答えさせていただきます。',
    status: 'completed',
    errorMessage: null,
    createdAt: new Date('2024-01-15T11:10:00Z'),
    updatedAt: new Date('2024-01-15T11:10:00Z'),
  },
];

const mockVideoDetail: GetVideoDetailResponse = {
  id: '1',
  googleDriveFileId: 'abc123',
  googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
  title: 'チームみらい 政策説明会 2024年1月',
  description: '2024年1月に開催された政策説明会の録画です。',
  durationSeconds: 3600,
  fileSizeBytes: 1500000000,
  status: 'completed',
  errorMessage: null,
  createdAt: new Date('2024-01-15T10:30:00Z'),
  updatedAt: new Date('2024-01-15T11:30:00Z'),
  clips: mockClips,
  processingJobs: [
    {
      id: 'job-1',
      videoId: '1',
      clipInstructions: '以下の箇所を切り抜いてください：\n1. 冒頭の自己紹介部分\n2. 政策について語っている部分\n3. 質疑応答のハイライト',
      status: 'completed',
      aiResponse: null,
      errorMessage: null,
      startedAt: new Date('2024-01-15T10:31:00Z'),
      completedAt: new Date('2024-01-15T11:30:00Z'),
      createdAt: new Date('2024-01-15T10:30:00Z'),
      updatedAt: new Date('2024-01-15T11:30:00Z'),
    },
  ],
};

// ============================================
// API Client
// ============================================

class ApiClient {
  private baseUrl: string | undefined;

  constructor() {
    this.baseUrl = API_URL;
  }

  private get useMock(): boolean {
    return !this.baseUrl;
  }

  private async fetch<T>(path: string, options?: RequestInit): Promise<T> {
    if (!this.baseUrl) {
      throw new Error('API URL not configured');
    }

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(error.message || `HTTP error ${response.status}`);
    }

    return response.json();
  }

  // ============================================
  // Videos API
  // ============================================

  async getVideos(query?: GetVideosQuery): Promise<GetVideosResponse> {
    if (this.useMock) {
      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const page = query?.page ?? 1;
      const limit = query?.limit ?? 20;
      let filteredVideos = mockVideos;

      if (query?.status) {
        filteredVideos = mockVideos.filter((v) => v.status === query.status);
      }

      const total = filteredVideos.length;
      const start = (page - 1) * limit;
      const data = filteredVideos.slice(start, start + limit);

      return {
        data,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }

    const params = new URLSearchParams();
    if (query?.page) params.set('page', String(query.page));
    if (query?.limit) params.set('limit', String(query.limit));
    if (query?.status) params.set('status', query.status);

    const queryString = params.toString();
    return this.fetch<GetVideosResponse>(`/api/videos${queryString ? `?${queryString}` : ''}`);
  }

  async getVideo(id: string): Promise<GetVideoDetailResponse> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 500));

      if (id === '1') {
        return mockVideoDetail;
      }

      // Return mock data for other IDs with different statuses
      const video = mockVideos.find((v) => v.id === id);
      if (!video) {
        throw new Error('Video not found');
      }

      return {
        id: video.id,
        googleDriveFileId: `file-${video.id}`,
        googleDriveUrl: video.googleDriveUrl,
        title: video.title,
        description: null,
        durationSeconds: null,
        fileSizeBytes: null,
        status: video.status,
        errorMessage: video.status === 'failed' ? '動画の処理中にエラーが発生しました' : null,
        createdAt: video.createdAt,
        updatedAt: video.createdAt,
        clips: [],
        processingJobs: [],
      };
    }

    return this.fetch<GetVideoDetailResponse>(`/api/videos/${id}`);
  }

  async createVideo(data: CreateVideoRequest): Promise<CreateVideoResponse> {
    if (this.useMock) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const newId = String(mockVideos.length + 1);
      return {
        id: newId,
        googleDriveFileId: `new-file-${newId}`,
        googleDriveUrl: data.googleDriveUrl,
        status: 'pending',
        processingJob: {
          id: `job-${newId}`,
          status: 'pending',
          clipInstructions: data.clipInstructions,
        },
        createdAt: new Date(),
      };
    }

    return this.fetch<CreateVideoResponse>('/api/videos', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
