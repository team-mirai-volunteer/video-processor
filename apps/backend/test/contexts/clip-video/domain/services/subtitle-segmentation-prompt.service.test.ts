import { SubtitleSegmentationPromptService } from '@clip-video/domain/services/subtitle-segmentation-prompt.service.js';
import { describe, expect, it } from 'vitest';

describe('SubtitleSegmentationPromptService', () => {
  const service = new SubtitleSegmentationPromptService();

  const mockTranscriptionSegments = [
    { text: '今日', startTimeSeconds: 0.0, endTimeSeconds: 0.3, confidence: 0.95 },
    { text: 'は', startTimeSeconds: 0.3, endTimeSeconds: 0.4, confidence: 0.95 },
    { text: '良い', startTimeSeconds: 0.4, endTimeSeconds: 0.8, confidence: 0.9 },
    { text: '天気', startTimeSeconds: 0.8, endTimeSeconds: 1.2, confidence: 0.95 },
    { text: 'です', startTimeSeconds: 1.2, endTimeSeconds: 1.5, confidence: 0.95 },
  ];

  describe('filterSegmentsForClip', () => {
    it('should filter segments within clip range', () => {
      const result = service.filterSegmentsForClip(mockTranscriptionSegments, 0.2, 1.3);

      expect(result.length).toBeGreaterThan(0);
      expect(result.every((seg) => seg.startTimeSeconds >= -0.3 && seg.endTimeSeconds <= 1.8)).toBe(
        true
      );
    });

    it('should return empty array when no segments in range', () => {
      const result = service.filterSegmentsForClip(mockTranscriptionSegments, 10.0, 20.0);

      expect(result).toHaveLength(0);
    });

    it('should include segments within tolerance', () => {
      // Segments starting at 0.0 should be included when clipStart is 0.5 (within 0.5 tolerance)
      const result = service.filterSegmentsForClip(mockTranscriptionSegments, 0.5, 1.5);

      expect(result.length).toBeGreaterThan(0);
    });
  });

  describe('buildPrompt', () => {
    it('should build a prompt with all required sections', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 1.5,
        transcriptionSegments: mockTranscriptionSegments,
        refinedFullText: '今日は良い天気です。',
      });

      expect(prompt).toContain('動画字幕の編集者');
      expect(prompt).toContain('0秒 〜 1.5秒');
      expect(prompt).toContain('今日は良い天気です。');
      expect(prompt).toContain('15〜25文字程度');
      expect(prompt).toContain('segments');
    });

    it('should include filtered segments in JSON format', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 1.5,
        transcriptionSegments: mockTranscriptionSegments,
        refinedFullText: '今日は良い天気です。',
      });

      expect(prompt).toContain('"text"');
      expect(prompt).toContain('"startTimeSeconds"');
      expect(prompt).toContain('"endTimeSeconds"');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const response = `{
        "segments": [
          {
            "text": "今日は良い天気です",
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.5
          }
        ]
      }`;

      const result = service.parseResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0]?.index).toBe(0);
      expect(result[0]?.text).toBe('今日は良い天気です');
      expect(result[0]?.startTimeSeconds).toBe(0.0);
      expect(result[0]?.endTimeSeconds).toBe(1.5);
    });

    it('should parse response with surrounding text', () => {
      const response = `以下は生成された字幕です:
      {
        "segments": [
          {
            "text": "こんにちは",
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          },
          {
            "text": "さようなら",
            "startTimeSeconds": 1.0,
            "endTimeSeconds": 2.0
          }
        ]
      }
      以上です。`;

      const result = service.parseResponse(response);

      expect(result).toHaveLength(2);
      expect(result[0]?.index).toBe(0);
      expect(result[1]?.index).toBe(1);
    });

    it('should throw error when no JSON found', () => {
      expect(() => service.parseResponse('これはJSONではありません')).toThrow(
        'No valid JSON found'
      );
    });

    it('should throw error when segments array is missing', () => {
      const response = '{"data": []}';

      expect(() => service.parseResponse(response)).toThrow('missing segments array');
    });

    it('should throw error when segment has empty text', () => {
      const response = `{
        "segments": [
          {
            "text": "",
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response)).toThrow('missing or empty text');
    });

    it('should throw error when segment has invalid time range', () => {
      const response = `{
        "segments": [
          {
            "text": "テスト",
            "startTimeSeconds": 2.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response)).toThrow(
        'startTimeSeconds must be before endTimeSeconds'
      );
    });

    it('should throw error when segment is missing startTimeSeconds', () => {
      const response = `{
        "segments": [
          {
            "text": "テスト",
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response)).toThrow('missing startTimeSeconds');
    });

    it('should trim whitespace from text', () => {
      const response = `{
        "segments": [
          {
            "text": "  テスト  ",
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      const result = service.parseResponse(response);

      expect(result[0]?.text).toBe('テスト');
    });
  });
});
