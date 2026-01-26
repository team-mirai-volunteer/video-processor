import type {
  ExtractClipsRequest,
  ExtractClipsResponse,
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

const mockVideos: GetVideoResponse[] = [
  {
    id: '1',
    googleDriveFileId: 'abc123',
    googleDriveUrl: 'https://drive.google.com/file/d/abc123/view',
    title: 'テスト動画',
    description: 'テスト動画の説明',
    durationSeconds: 3600,
    fileSizeBytes: 1500000000,
    status: 'completed',
    errorMessage: null,
    clips: [],
    processingJobs: [
      {
        id: 'job-1',
        status: 'completed',
        clipInstructions: 'テスト指示',
        completedAt: new Date().toISOString(),
      },
    ],
    transcriptionPhase: 'not_started',
    transcription: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export const mockBackendClient = {
  // Videos
  async getVideos(_query?: GetVideosQuery): Promise<GetVideosResponse> {
    return {
      data: mockVideos,
      pagination: {
        total: mockVideos.length,
        page: 1,
        limit: 10,
        totalPages: 1,
      },
    };
  },

  async getVideo(id: string): Promise<GetVideoResponse> {
    const video = mockVideos.find((v) => v.id === id);
    if (!video) {
      throw new Error(`Video not found: ${id}`);
    }
    return video;
  },

  async submitVideo(request: SubmitVideoRequest): Promise<SubmitVideoResponse> {
    return {
      id: 'new-video-id',
      googleDriveFileId: request.googleDriveUrl.split('/d/')[1]?.split('/')[0] || 'unknown',
      googleDriveUrl: request.googleDriveUrl,
      title: 'New Video',
      description: null,
      durationSeconds: null,
      fileSizeBytes: null,
      status: 'pending',
      errorMessage: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  },

  async deleteVideo(_id: string): Promise<void> {
    // Mock deletion - do nothing
  },

  // Transcription
  async transcribeVideo(_videoId: string): Promise<TranscribeVideoResponse> {
    return {
      message: 'Transcription started',
    };
  },

  async getTranscription(_videoId: string): Promise<GetTranscriptionResponse> {
    throw new MockBackendApiError(404, 'Transcription not found');
  },

  async refineTranscript(_videoId: string): Promise<RefineTranscriptResponse> {
    return {
      message: 'Refinement started',
    };
  },

  async getRefinedTranscription(_videoId: string): Promise<GetRefinedTranscriptionResponse | null> {
    return null;
  },

  // Clips
  async extractClips(
    _videoId: string,
    _request: ExtractClipsRequest
  ): Promise<ExtractClipsResponse> {
    return {
      jobId: 'mock-job-id',
      message: 'Clip extraction started',
    };
  },
};

class MockBackendApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = 'BackendApiError';
  }
}
