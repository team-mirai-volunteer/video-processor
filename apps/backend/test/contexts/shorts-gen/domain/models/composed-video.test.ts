import { ShortsComposedVideo } from '@shorts-gen/domain/models/composed-video.js';
import { describe, expect, it } from 'vitest';

describe('ShortsComposedVideo', () => {
  const generateId = () => 'video-id-123';

  describe('create', () => {
    it('should create a ShortsComposedVideo with valid params', () => {
      const result = ShortsComposedVideo.create(
        {
          projectId: 'project-123',
          scriptId: 'script-123',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('video-id-123');
        expect(result.value.projectId).toBe('project-123');
        expect(result.value.scriptId).toBe('script-123');
        expect(result.value.status).toBe('pending');
        expect(result.value.fileUrl).toBe(null);
        expect(result.value.durationSeconds).toBe(null);
        expect(result.value.bgmKey).toBe(null);
      }
    });

    it('should create a ShortsComposedVideo with bgmKey', () => {
      const result = ShortsComposedVideo.create(
        {
          projectId: 'project-123',
          scriptId: 'script-123',
          bgmKey: 'upbeat-001',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.bgmKey).toBe('upbeat-001');
      }
    });

    it('should return error for empty projectId', () => {
      const result = ShortsComposedVideo.create(
        { projectId: '', scriptId: 'script-123' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for whitespace-only projectId', () => {
      const result = ShortsComposedVideo.create(
        { projectId: '   ', scriptId: 'script-123' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for empty scriptId', () => {
      const result = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: '' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SCRIPT_ID');
      }
    });

    it('should return error for whitespace-only scriptId', () => {
      const result = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: '   ' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SCRIPT_ID');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsComposedVideo from props', () => {
      const now = new Date();
      const video = ShortsComposedVideo.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        scriptId: 'script-123',
        fileUrl: 'https://storage.example.com/video.mp4',
        durationSeconds: 45.5,
        status: 'completed',
        errorMessage: null,
        bgmKey: 'bgm-001',
        createdAt: now,
        updatedAt: now,
      });

      expect(video.id).toBe('existing-id');
      expect(video.status).toBe('completed');
      expect(video.fileUrl).toBe('https://storage.example.com/video.mp4');
    });
  });

  describe('startProcessing', () => {
    it('should transition from pending to processing', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const result = videoResult.value.startProcessing();
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe('processing');
      }
    });

    it('should return error when transitioning from completed', () => {
      const now = new Date();
      const video = ShortsComposedVideo.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        scriptId: 'script-123',
        fileUrl: 'https://storage.example.com/video.mp4',
        durationSeconds: 45.5,
        status: 'completed',
        errorMessage: null,
        bgmKey: null,
        createdAt: now,
        updatedAt: now,
      });

      const result = video.startProcessing();
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });

  describe('complete', () => {
    it('should transition from processing to completed with file info', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const processingResult = videoResult.value.startProcessing();
      expect(processingResult.success).toBe(true);
      if (!processingResult.success) return;

      const completeResult = processingResult.value.complete(
        'https://storage.example.com/video.mp4',
        60.5
      );
      expect(completeResult.success).toBe(true);
      if (completeResult.success) {
        expect(completeResult.value.status).toBe('completed');
        expect(completeResult.value.fileUrl).toBe('https://storage.example.com/video.mp4');
        expect(completeResult.value.durationSeconds).toBe(60.5);
      }
    });

    it('should return error when transitioning from pending', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const result = videoResult.value.complete('https://storage.example.com/video.mp4', 60.5);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_STATE_TRANSITION');
      }
    });

    it('should return error for invalid file URL', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const processingResult = videoResult.value.startProcessing();
      expect(processingResult.success).toBe(true);
      if (!processingResult.success) return;

      const result = processingResult.value.complete('not-a-valid-url', 60.5);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_FILE_URL');
      }
    });

    it('should return error for non-positive duration', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const processingResult = videoResult.value.startProcessing();
      expect(processingResult.success).toBe(true);
      if (!processingResult.success) return;

      const result = processingResult.value.complete('https://storage.example.com/video.mp4', 0);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DURATION');
      }
    });
  });

  describe('fail', () => {
    it('should transition from processing to failed with error message', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const processingResult = videoResult.value.startProcessing();
      expect(processingResult.success).toBe(true);
      if (!processingResult.success) return;

      const failResult = processingResult.value.fail('FFmpeg encoding failed');
      expect(failResult.success).toBe(true);
      if (failResult.success) {
        expect(failResult.value.status).toBe('failed');
        expect(failResult.value.errorMessage).toBe('FFmpeg encoding failed');
      }
    });

    it('should transition from pending to failed', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const failResult = videoResult.value.fail('Initialization failed');
      expect(failResult.success).toBe(true);
      if (failResult.success) {
        expect(failResult.value.status).toBe('failed');
      }
    });
  });

  describe('reset', () => {
    it('should transition from failed to pending', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const failResult = videoResult.value.fail('Error');
      expect(failResult.success).toBe(true);
      if (!failResult.success) return;

      const resetResult = failResult.value.reset();
      expect(resetResult.success).toBe(true);
      if (resetResult.success) {
        expect(resetResult.value.status).toBe('pending');
        expect(resetResult.value.fileUrl).toBe(null);
        expect(resetResult.value.durationSeconds).toBe(null);
        expect(resetResult.value.errorMessage).toBe(null);
      }
    });

    it('should transition from completed to pending for regeneration', () => {
      const now = new Date();
      const video = ShortsComposedVideo.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        scriptId: 'script-123',
        fileUrl: 'https://storage.example.com/video.mp4',
        durationSeconds: 45.5,
        status: 'completed',
        errorMessage: null,
        bgmKey: null,
        createdAt: now,
        updatedAt: now,
      });

      const resetResult = video.reset();
      expect(resetResult.success).toBe(true);
      if (resetResult.success) {
        expect(resetResult.value.status).toBe('pending');
        expect(resetResult.value.fileUrl).toBe(null);
      }
    });

    it('should return error when resetting from processing', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const processingResult = videoResult.value.startProcessing();
      expect(processingResult.success).toBe(true);
      if (!processingResult.success) return;

      const resetResult = processingResult.value.reset();
      expect(resetResult.success).toBe(false);
      if (!resetResult.success) {
        expect(resetResult.error.type).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });

  describe('withBgmKey', () => {
    it('should update BGM key', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const updated = videoResult.value.withBgmKey('new-bgm-key');
      expect(updated.bgmKey).toBe('new-bgm-key');
    });

    it('should allow null BGM key', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123', bgmKey: 'original' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const updated = videoResult.value.withBgmKey(null);
      expect(updated.bgmKey).toBe(null);
    });
  });

  describe('isReady', () => {
    it('should return true when completed with file URL', () => {
      const now = new Date();
      const video = ShortsComposedVideo.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        scriptId: 'script-123',
        fileUrl: 'https://storage.example.com/video.mp4',
        durationSeconds: 45.5,
        status: 'completed',
        errorMessage: null,
        bgmKey: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(video.isReady()).toBe(true);
    });

    it('should return false when pending', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      expect(videoResult.value.isReady()).toBe(false);
    });
  });

  describe('isProcessing', () => {
    it('should return true when processing', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const processingResult = videoResult.value.startProcessing();
      expect(processingResult.success).toBe(true);
      if (!processingResult.success) return;

      expect(processingResult.value.isProcessing()).toBe(true);
    });

    it('should return false when completed', () => {
      const now = new Date();
      const video = ShortsComposedVideo.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        scriptId: 'script-123',
        fileUrl: 'https://storage.example.com/video.mp4',
        durationSeconds: 45.5,
        status: 'completed',
        errorMessage: null,
        bgmKey: null,
        createdAt: now,
        updatedAt: now,
      });

      expect(video.isProcessing()).toBe(false);
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const videoResult = ShortsComposedVideo.create(
        { projectId: 'project-123', scriptId: 'script-123', bgmKey: 'bgm-key' },
        generateId
      );
      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const props = videoResult.value.toProps();
      expect(props.id).toBe('video-id-123');
      expect(props.projectId).toBe('project-123');
      expect(props.scriptId).toBe('script-123');
      expect(props.status).toBe('pending');
      expect(props.fileUrl).toBe(null);
      expect(props.durationSeconds).toBe(null);
      expect(props.bgmKey).toBe('bgm-key');
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
