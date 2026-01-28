import type {
  CacheVideoResponse,
  CreateShortsProjectRequest,
  CreateShortsProjectResponse,
  ExtractAudioResponse,
  ExtractClipsRequest,
  ExtractClipsResponse,
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
  ShortsProject,
  ShortsProjectSummary,
  SubmitVideoRequest,
  SubmitVideoResponse,
  TranscribeAudioResponse,
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
    progressMessage: null,
    gcsUri: null,
    gcsExpiresAt: null,
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

// Mock shorts-gen projects
const mockShortsProjects: ShortsProject[] = [
  {
    id: 'shorts-1',
    title: 'AIについて解説',
    aspectRatio: '9:16',
    resolutionWidth: 1080,
    resolutionHeight: 1920,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'shorts-2',
    title: 'マニフェスト紹介動画',
    aspectRatio: '9:16',
    resolutionWidth: 1080,
    resolutionHeight: 1920,
    createdAt: new Date(Date.now() - 172800000).toISOString(),
    updatedAt: new Date(Date.now() - 172800000).toISOString(),
  },
];

const mockShortsProjectSummaries: ShortsProjectSummary[] = mockShortsProjects.map((p) => ({
  id: p.id,
  title: p.title,
  aspectRatio: p.aspectRatio,
  createdAt: p.createdAt,
  updatedAt: p.updatedAt,
  hasPlan: p.id === 'shorts-1',
  hasScript: p.id === 'shorts-1',
  hasComposedVideo: false,
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

  // Pipeline Steps
  async cacheVideo(videoId: string): Promise<CacheVideoResponse> {
    return {
      videoId,
      gcsUri: `gs://mock-bucket/videos/${videoId}`,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      cached: true,
    };
  },

  async extractAudio(videoId: string): Promise<ExtractAudioResponse> {
    return {
      videoId,
      format: 'flac',
      audioGcsUri: `gs://mock-bucket/videos/${videoId}/audio.flac`,
    };
  },

  async transcribeAudio(videoId: string): Promise<TranscribeAudioResponse> {
    return {
      videoId,
      transcriptionId: `transcription-${videoId}`,
      segmentsCount: 100,
      durationSeconds: 3600,
    };
  },

  async getTranscriptionSrt(_videoId: string): Promise<string> {
    return `1
00:00:00,000 --> 00:00:05,000
Mock transcription subtitle 1

2
00:00:05,000 --> 00:00:10,000
Mock transcription subtitle 2`;
  },

  // Shorts Gen - Projects
  async getShortsProjects(): Promise<GetShortsProjectsResponse> {
    return {
      data: mockShortsProjectSummaries,
    };
  },

  async getShortsProject(id: string): Promise<GetShortsProjectResponse> {
    const project = mockShortsProjects.find((p) => p.id === id);
    if (!project) {
      throw new MockBackendApiError(404, `Project not found: ${id}`);
    }
    return { data: project };
  },

  async createShortsProject(
    request: CreateShortsProjectRequest
  ): Promise<CreateShortsProjectResponse> {
    const newProject: ShortsProject = {
      id: `shorts-${Date.now()}`,
      title: request.title,
      aspectRatio: request.aspectRatio ?? '9:16',
      resolutionWidth: request.resolutionWidth ?? 1080,
      resolutionHeight: request.resolutionHeight ?? 1920,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    mockShortsProjects.unshift(newProject);
    mockShortsProjectSummaries.unshift({
      id: newProject.id,
      title: newProject.title,
      aspectRatio: newProject.aspectRatio,
      createdAt: newProject.createdAt,
      updatedAt: newProject.updatedAt,
      hasPlan: false,
      hasScript: false,
      hasComposedVideo: false,
    });
    return { data: newProject };
  },

  async deleteShortsProject(id: string): Promise<void> {
    const index = mockShortsProjects.findIndex((p) => p.id === id);
    if (index !== -1) {
      mockShortsProjects.splice(index, 1);
    }
    const summaryIndex = mockShortsProjectSummaries.findIndex((p) => p.id === id);
    if (summaryIndex !== -1) {
      mockShortsProjectSummaries.splice(summaryIndex, 1);
    }
  },

  // Shorts Gen - Planning
  async getShortsPlanning(_projectId: string): Promise<GetShortsPlanningResponse | null> {
    return null;
  },

  // Shorts Gen - Script
  async getShortsScript(_projectId: string): Promise<GetShortsScriptResponse | null> {
    return null;
  },

  // Shorts Gen - Assets
  async getShortsVoice(_scriptId: string): Promise<GetShortsVoiceResponse | null> {
    return null;
  },

  async getShortsSubtitles(_scriptId: string): Promise<GetShortsSubtitlesResponse | null> {
    return null;
  },

  async getShortsImages(_scriptId: string): Promise<GetShortsImagesResponse | null> {
    return null;
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
