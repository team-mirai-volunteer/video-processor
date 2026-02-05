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
      expect(prompt).toContain('1行は16文字以内');
      expect(prompt).toContain('最大2行まで');
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

    it('should include lines array example in prompt', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 1.5,
        transcriptionSegments: mockTranscriptionSegments,
        refinedFullText: '今日は良い天気です。',
      });

      expect(prompt).toContain('"lines"');
    });

    it('should include no punctuation rule in prompt', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 1.5,
        transcriptionSegments: mockTranscriptionSegments,
        refinedFullText: '今日は良い天気です。',
      });

      expect(prompt).toContain('句読点');
      expect(prompt).toContain('入れない');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response with lines array', () => {
      const response = `{
        "segments": [
          {
            "lines": ["今日は良い天気です"],
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.5
          }
        ]
      }`;

      const result = service.parseResponse(response, 0);

      expect(result).toHaveLength(1);
      expect(result[0]?.index).toBe(0);
      expect(result[0]?.lines).toEqual(['今日は良い天気です']);
      expect(result[0]?.startTimeSeconds).toBe(0.0);
      expect(result[0]?.endTimeSeconds).toBe(1.5);
    });

    it('should parse response with 2 lines', () => {
      const response = `{
        "segments": [
          {
            "lines": ["こんにちは", "世界"],
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.5
          }
        ]
      }`;

      const result = service.parseResponse(response, 0);

      expect(result).toHaveLength(1);
      expect(result[0]?.lines).toEqual(['こんにちは', '世界']);
    });

    it('should parse response with surrounding text', () => {
      const response = `以下は生成された字幕です:
      {
        "segments": [
          {
            "lines": ["こんにちは"],
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          },
          {
            "lines": ["さようなら"],
            "startTimeSeconds": 1.0,
            "endTimeSeconds": 2.0
          }
        ]
      }
      以上です。`;

      const result = service.parseResponse(response, 0);

      expect(result).toHaveLength(2);
      expect(result[0]?.index).toBe(0);
      expect(result[1]?.index).toBe(1);
    });

    it('should throw error when no JSON found', () => {
      expect(() => service.parseResponse('これはJSONではありません', 0)).toThrow(
        'No valid JSON found'
      );
    });

    it('should throw error when segments array is missing', () => {
      const response = '{"data": []}';

      expect(() => service.parseResponse(response, 0)).toThrow('missing segments array');
    });

    it('should throw error when segment has empty lines', () => {
      const response = `{
        "segments": [
          {
            "lines": [],
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response, 0)).toThrow('missing or empty lines');
    });

    it('should throw error when segment has too many lines', () => {
      const response = `{
        "segments": [
          {
            "lines": ["行1", "行2", "行3"],
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response, 0)).toThrow('too many lines');
    });

    it('should throw error when line exceeds max characters', () => {
      const response = `{
        "segments": [
          {
            "lines": ["これは確実に十七文字を超えています"],
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response, 0)).toThrow('too long');
    });

    it('should throw error when segment has invalid time range', () => {
      const response = `{
        "segments": [
          {
            "lines": ["テスト"],
            "startTimeSeconds": 2.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response, 0)).toThrow(
        'startTimeSeconds must be before endTimeSeconds'
      );
    });

    it('should throw error when segment is missing startTimeSeconds', () => {
      const response = `{
        "segments": [
          {
            "lines": ["テスト"],
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      expect(() => service.parseResponse(response, 0)).toThrow('missing startTimeSeconds');
    });

    it('should trim whitespace from lines', () => {
      const response = `{
        "segments": [
          {
            "lines": ["  テスト  ", "  テスト2  "],
            "startTimeSeconds": 0.0,
            "endTimeSeconds": 1.0
          }
        ]
      }`;

      const result = service.parseResponse(response, 0);

      expect(result[0]?.lines).toEqual(['テスト', 'テスト2']);
    });

    it('should convert absolute time to relative time based on clipStartSeconds', () => {
      const response = `{
        "segments": [
          {
            "lines": ["テスト"],
            "startTimeSeconds": 120.0,
            "endTimeSeconds": 122.5
          }
        ]
      }`;

      const result = service.parseResponse(response, 120);

      expect(result[0]?.startTimeSeconds).toBe(0.0);
      expect(result[0]?.endTimeSeconds).toBe(2.5);
    });
  });
});
