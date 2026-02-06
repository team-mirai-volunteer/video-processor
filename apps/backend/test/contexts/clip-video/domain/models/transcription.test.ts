import { Transcription } from '@clip-video/domain/models/transcription.js';
import { describe, expect, it } from 'vitest';

describe('Transcription', () => {
  const generateId = () => 'test-id-123';

  const validParams = {
    videoId: 'video-1',
    fullText: 'Hello world',
    segments: [
      {
        text: 'Hello',
        startTimeSeconds: 0,
        endTimeSeconds: 1,
        confidence: 0.95,
      },
      {
        text: 'world',
        startTimeSeconds: 1,
        endTimeSeconds: 2,
        confidence: 0.9,
      },
    ],
    languageCode: 'ja-JP',
    durationSeconds: 120,
  };

  describe('create', () => {
    it('should create a Transcription with valid params', () => {
      const result = Transcription.create(validParams, generateId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('test-id-123');
        expect(result.value.videoId).toBe('video-1');
        expect(result.value.fullText).toBe('Hello world');
        expect(result.value.segments).toHaveLength(2);
        expect(result.value.languageCode).toBe('ja-JP');
        expect(result.value.durationSeconds).toBe(120);
        expect(result.value.createdAt).toBeInstanceOf(Date);
      }
    });

    it('should return error for negative duration', () => {
      const result = Transcription.create({ ...validParams, durationSeconds: -1 }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DURATION');
      }
    });

    it('should return error for empty text', () => {
      const result = Transcription.create({ ...validParams, fullText: '' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_TEXT');
      }
    });

    it('should return error for whitespace-only text', () => {
      const result = Transcription.create({ ...validParams, fullText: '   ' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_TEXT');
      }
    });

    it('should allow zero duration', () => {
      const result = Transcription.create({ ...validParams, durationSeconds: 0 }, generateId);

      expect(result.success).toBe(true);
    });

    it('should allow empty segments array', () => {
      const result = Transcription.create({ ...validParams, segments: [] }, generateId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.segments).toHaveLength(0);
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a Transcription from props', () => {
      const createdAt = new Date('2024-01-01');
      const transcription = Transcription.fromProps({
        id: 'existing-id',
        videoId: 'video-1',
        fullText: 'Hello world',
        segments: validParams.segments,
        languageCode: 'ja-JP',
        durationSeconds: 120,
        createdAt,
      });

      expect(transcription.id).toBe('existing-id');
      expect(transcription.videoId).toBe('video-1');
      expect(transcription.fullText).toBe('Hello world');
      expect(transcription.createdAt).toBe(createdAt);
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const result = Transcription.create(validParams, generateId);

      expect(result.success).toBe(true);
      if (!result.success) return;

      const props = result.value.toProps();

      expect(props.id).toBe('test-id-123');
      expect(props.videoId).toBe('video-1');
      expect(props.fullText).toBe('Hello world');
      expect(props.segments).toEqual(validParams.segments);
      expect(props.languageCode).toBe('ja-JP');
      expect(props.durationSeconds).toBe(120);
      expect(props.createdAt).toBeInstanceOf(Date);
    });
  });
});
