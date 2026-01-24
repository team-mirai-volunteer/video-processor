import { describe, expect, it } from 'vitest';
import {
  Video,
  extractGoogleDriveFileId,
  isValidGoogleDriveUrl,
} from '../../../../src/domain/models/video.js';

describe('Video', () => {
  const generateId = () => 'test-id-123';

  describe('extractGoogleDriveFileId', () => {
    it('should extract file ID from valid Google Drive URL', () => {
      const url = 'https://drive.google.com/file/d/1a2b3c4d5e6f/view';
      expect(extractGoogleDriveFileId(url)).toBe('1a2b3c4d5e6f');
    });

    it('should extract file ID with various characters', () => {
      const url = 'https://drive.google.com/file/d/1a-2b_3c4d5e6f/view?usp=sharing';
      expect(extractGoogleDriveFileId(url)).toBe('1a-2b_3c4d5e6f');
    });

    it('should return null for invalid URL', () => {
      expect(extractGoogleDriveFileId('https://example.com/file')).toBe(null);
      expect(extractGoogleDriveFileId('')).toBe(null);
    });
  });

  describe('isValidGoogleDriveUrl', () => {
    it('should return true for valid Google Drive URLs', () => {
      expect(isValidGoogleDriveUrl('https://drive.google.com/file/d/1a2b3c4d5e6f/view')).toBe(true);
      expect(
        isValidGoogleDriveUrl('https://drive.google.com/file/d/1a2b3c4d5e6f/view?usp=sharing')
      ).toBe(true);
    });

    it('should return false for invalid URLs', () => {
      expect(isValidGoogleDriveUrl('https://example.com/file')).toBe(false);
      expect(isValidGoogleDriveUrl('')).toBe(false);
      expect(isValidGoogleDriveUrl('not-a-url')).toBe(false);
    });
  });

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

      const updated = videoResult.value.withStatus('processing');
      expect(updated.status).toBe('processing');
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
