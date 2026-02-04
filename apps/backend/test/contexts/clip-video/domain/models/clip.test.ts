import { Clip } from '@clip-video/domain/models/clip.js';
import { describe, expect, it } from 'vitest';

describe('Clip', () => {
  const generateId = () => 'clip-id-123';

  describe('create', () => {
    it('should create a Clip with valid time range', () => {
      const result = Clip.create(
        {
          videoId: 'video-123',
          title: 'Test Clip',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: 'Test transcript',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('clip-id-123');
        expect(result.value.videoId).toBe('video-123');
        expect(result.value.durationSeconds).toBe(30);
        expect(result.value.status).toBe('pending');
      }
    });

    it('should return error when start time is after end time', () => {
      const result = Clip.create(
        {
          videoId: 'video-123',
          title: 'Test Clip',
          startTimeSeconds: 60,
          endTimeSeconds: 30,
          transcript: 'Test transcript',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TIME_RANGE');
      }
    });

    it('should return error when duration is too short', () => {
      const result = Clip.create(
        {
          videoId: 'video-123',
          title: 'Test Clip',
          startTimeSeconds: 0,
          endTimeSeconds: 10, // Only 10 seconds (minimum is 20)
          transcript: 'Test transcript',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('DURATION_OUT_OF_RANGE');
      }
    });

    it('should return error when duration is too long', () => {
      const result = Clip.create(
        {
          videoId: 'video-123',
          title: 'Test Clip',
          startTimeSeconds: 0,
          endTimeSeconds: 120, // 120 seconds (maximum is 60)
          transcript: 'Test transcript',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('DURATION_OUT_OF_RANGE');
      }
    });
  });

  describe('createWithFlexibleDuration', () => {
    it('should create a clip without duration constraints', () => {
      const result = Clip.createWithFlexibleDuration(
        {
          videoId: 'video-123',
          title: 'Test Clip',
          startTimeSeconds: 0,
          endTimeSeconds: 120, // Would fail with strict validation
          transcript: 'Test transcript',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.durationSeconds).toBe(120);
      }
    });
  });

  describe('withGoogleDriveInfo', () => {
    it('should update Google Drive info', () => {
      const clipResult = Clip.create(
        {
          videoId: 'video-123',
          title: 'Test Clip',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: 'Test transcript',
        },
        generateId
      );

      expect(clipResult.success).toBe(true);
      if (!clipResult.success) return;

      const updated = clipResult.value.withGoogleDriveInfo(
        'file-id',
        'https://drive.google.com/file/d/file-id/view'
      );

      expect(updated.googleDriveFileId).toBe('file-id');
      expect(updated.googleDriveUrl).toBe('https://drive.google.com/file/d/file-id/view');
    });
  });

  describe('withStatus', () => {
    it('should update status', () => {
      const clipResult = Clip.create(
        {
          videoId: 'video-123',
          title: 'Test Clip',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: 'Test transcript',
        },
        generateId
      );

      expect(clipResult.success).toBe(true);
      if (!clipResult.success) return;

      const updated = clipResult.value.withStatus('completed');
      expect(updated.status).toBe('completed');
    });
  });
});
