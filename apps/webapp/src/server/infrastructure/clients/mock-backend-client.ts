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
  VideoSummary,
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
        completedAt: new Date(),
      },
    ],
    transcriptionPhase: null,
    transcription: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

// VideoSummary形式に変換
const mockVideoSummaries: VideoSummary[] = mockVideos.map((v) => ({
  id: v.id,
  googleDriveUrl: v.googleDriveUrl,
  title: v.title,
  status: v.status,
  clipCount: v.clips.length,
  createdAt: v.createdAt,
}));

export const mockBackendClient = {
  // Videos
  async getVideos(_query?: GetVideosQuery): Promise<GetVideosResponse> {
    return {
      data: mockVideoSummaries,
      pagination: {
        total: mockVideoSummaries.length,
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
      status: 'pending',
      createdAt: new Date(),
    };
  },

  async deleteVideo(_id: string): Promise<void> {
    // Mock deletion - do nothing
  },

  // Transcription
  async transcribeVideo(videoId: string): Promise<TranscribeVideoResponse> {
    return {
      videoId,
      status: 'transcribing',
    };
  },

  async getTranscription(_videoId: string): Promise<GetTranscriptionResponse> {
    throw new MockBackendApiError(404, 'Transcription not found');
  },

  async refineTranscript(videoId: string): Promise<RefineTranscriptResponse> {
    return {
      videoId,
      status: 'refining',
    };
  },

  async getRefinedTranscription(_videoId: string): Promise<GetRefinedTranscriptionResponse | null> {
    return null;
  },

  // Clips
  async extractClips(
    videoId: string,
    _request: ExtractClipsRequest
  ): Promise<ExtractClipsResponse> {
    return {
      videoId,
      status: 'extracting',
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
