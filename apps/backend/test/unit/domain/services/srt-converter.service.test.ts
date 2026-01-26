import { describe, expect, it } from 'vitest';
import {
  formatSrtTime,
  refinedTranscriptionToSrt,
  transcriptionToSrt,
} from '../../../../src/domain/services/srt-converter.service.js';

describe('SrtConverterService', () => {
  describe('formatSrtTime', () => {
    it('should format 0 seconds correctly', () => {
      expect(formatSrtTime(0)).toBe('00:00:00,000');
    });

    it('should format seconds with milliseconds', () => {
      expect(formatSrtTime(5.5)).toBe('00:00:05,500');
    });

    it('should format minutes correctly', () => {
      expect(formatSrtTime(65.123)).toBe('00:01:05,123');
    });

    it('should format hours correctly', () => {
      expect(formatSrtTime(3661.999)).toBe('01:01:01,999');
    });

    it('should handle large durations', () => {
      expect(formatSrtTime(86400)).toBe('24:00:00,000');
    });
  });

  describe('transcriptionToSrt', () => {
    it('should return empty string for empty segments', () => {
      expect(transcriptionToSrt([])).toBe('');
    });

    it('should convert single segment to SRT', () => {
      const segments = [
        {
          text: 'Hello world',
          startTimeSeconds: 0,
          endTimeSeconds: 2,
          confidence: 0.9,
        },
      ];

      const result = transcriptionToSrt(segments);

      expect(result).toBe('1\n00:00:00,000 --> 00:00:02,000\nHello world');
    });

    it('should group consecutive short segments', () => {
      const segments = [
        { text: 'Hello ', startTimeSeconds: 0, endTimeSeconds: 1, confidence: 0.9 },
        { text: 'world', startTimeSeconds: 1, endTimeSeconds: 2, confidence: 0.9 },
      ];

      const result = transcriptionToSrt(segments);

      expect(result).toBe('1\n00:00:00,000 --> 00:00:02,000\nHello world');
    });

    it('should split segments exceeding max duration', () => {
      const segments = [
        { text: 'First', startTimeSeconds: 0, endTimeSeconds: 5, confidence: 0.9 },
        { text: 'Second', startTimeSeconds: 5, endTimeSeconds: 12, confidence: 0.9 },
      ];

      const result = transcriptionToSrt(segments);

      const lines = result.split('\n\n');
      expect(lines).toHaveLength(2);
    });

    it('should split segments exceeding max characters', () => {
      const longText = 'A'.repeat(60);
      const segments = [
        { text: longText, startTimeSeconds: 0, endTimeSeconds: 2, confidence: 0.9 },
        { text: 'Short', startTimeSeconds: 2, endTimeSeconds: 4, confidence: 0.9 },
      ];

      const result = transcriptionToSrt(segments);

      const lines = result.split('\n\n');
      expect(lines).toHaveLength(2);
    });
  });

  describe('refinedTranscriptionToSrt', () => {
    it('should return empty string for empty sentences', () => {
      expect(refinedTranscriptionToSrt([])).toBe('');
    });

    it('should convert single sentence to SRT', () => {
      const sentences = [
        {
          text: 'This is a sentence.',
          startTimeSeconds: 0,
          endTimeSeconds: 3,
          originalSegmentIndices: [0, 1, 2],
        },
      ];

      const result = refinedTranscriptionToSrt(sentences);

      expect(result).toBe('1\n00:00:00,000 --> 00:00:03,000\nThis is a sentence.');
    });

    it('should convert multiple sentences to SRT', () => {
      const sentences = [
        {
          text: 'First sentence.',
          startTimeSeconds: 0,
          endTimeSeconds: 2,
          originalSegmentIndices: [0, 1],
        },
        {
          text: 'Second sentence.',
          startTimeSeconds: 2.5,
          endTimeSeconds: 5,
          originalSegmentIndices: [2, 3],
        },
      ];

      const result = refinedTranscriptionToSrt(sentences);

      expect(result).toBe(
        '1\n00:00:00,000 --> 00:00:02,000\nFirst sentence.\n\n2\n00:00:02,500 --> 00:00:05,000\nSecond sentence.'
      );
    });

    it('should preserve original timestamps', () => {
      const sentences = [
        {
          text: 'Test',
          startTimeSeconds: 123.456,
          endTimeSeconds: 125.789,
          originalSegmentIndices: [0],
        },
      ];

      const result = refinedTranscriptionToSrt(sentences);

      expect(result).toContain('00:02:03,456 --> 00:02:05,789');
    });
  });
});
