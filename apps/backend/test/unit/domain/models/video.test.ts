import { describe, expect, it } from 'vitest';
import { Video } from '../../../../src/domain/models/video.js';

describe('Video', () => {
  const generateId = () => 'test-id-123';

  describe('create', () => {
    it('should create a Video with valid Google Drive URL', () => {
      const result = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/abc123/view' },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('test-id-123');
        expect(result.value.googleDriveFileId).toBe('abc123');
        expect(result.value.googleDriveUrl).toBe('https://drive.google.com/file/d/abc123/view');
        expect(result.value.status).toBe('pending');
        expect(result.value.title).toBe(null);
      }
    });

    it('should return error for invalid URL', () => {
      const result = Video.create({ googleDriveUrl: 'https://example.com/file' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_URL');
      }
    });
  });

  describe('withMetadata', () => {
    it('should update metadata', () => {
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/abc123/view' },
        generateId
      );

      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const updatedResult = videoResult.value.withMetadata({
        title: 'Test Video',
        durationSeconds: 3600,
      });

      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.title).toBe('Test Video');
        expect(updatedResult.value.durationSeconds).toBe(3600);
      }
    });

    it('should return error for negative duration', () => {
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/abc123/view' },
        generateId
      );

      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const updatedResult = videoResult.value.withMetadata({
        durationSeconds: -100,
      });

      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_DURATION');
      }
    });
  });

  describe('withStatus', () => {
    it('should update status', () => {
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/abc123/view' },
        generateId
      );

      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const updated = videoResult.value.withStatus('transcribing');
      expect(updated.status).toBe('transcribing');
    });

    it('should update status with error message', () => {
      const videoResult = Video.create(
        { googleDriveUrl: 'https://drive.google.com/file/d/abc123/view' },
        generateId
      );

      expect(videoResult.success).toBe(true);
      if (!videoResult.success) return;

      const updated = videoResult.value.withStatus('failed', 'Test error');
      expect(updated.status).toBe('failed');
      expect(updated.errorMessage).toBe('Test error');
    });
  });
});
