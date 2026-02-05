import type { RefinedSentence } from '@clip-video/domain/models/refined-transcription.js';
import { SubtitleSegmentationPromptService } from '@clip-video/domain/services/subtitle-segmentation-prompt.service.js';
import { describe, expect, it } from 'vitest';

describe('SubtitleSegmentationPromptService', () => {
  const service = new SubtitleSegmentationPromptService();

  const mockRefinedSentences: RefinedSentence[] = [
    {
      text: '今日は良い天気です。',
      startTimeSeconds: 0.0,
      endTimeSeconds: 1.5,
      originalSegmentIndices: [0, 1, 2, 3, 4],
    },
    {
      text: '明日も晴れるといいですね。',
      startTimeSeconds: 1.5,
      endTimeSeconds: 3.0,
      originalSegmentIndices: [5, 6, 7, 8, 9],
    },
  ];

  describe('filterSentencesForClip', () => {
    it('should filter sentences within clip range', () => {
      const result = service.filterSentencesForClip(mockRefinedSentences, 0.0, 2.0);

      expect(result.length).toBe(2);
    });

    it('should return empty array when no sentences in range', () => {
      const result = service.filterSentencesForClip(mockRefinedSentences, 10.0, 20.0);

      expect(result).toHaveLength(0);
    });

    it('should include overlapping sentences', () => {
      // Only second sentence overlaps with 2.0-4.0
      const result = service.filterSentencesForClip(mockRefinedSentences, 2.0, 4.0);

      expect(result.length).toBe(1);
      expect(result[0]?.text).toBe('明日も晴れるといいですね。');
    });
  });

  describe('buildPrompt', () => {
    it('should build a lightweight prompt with sentence text', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 3.0,
        refinedSentences: mockRefinedSentences,
      });

      expect(prompt).toContain('動画字幕の編集者');
      expect(prompt).toContain('今日は良い天気です。');
      expect(prompt).toContain('明日も晴れるといいですね。');
      expect(prompt).toContain('1行は16文字以内');
      expect(prompt).toContain('最大2行まで');
    });

    it('should include time format in prompt', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 3.0,
        refinedSentences: mockRefinedSentences,
      });

      // Should contain time in mm:ss.ms format
      expect(prompt).toContain('00:00.00');
      expect(prompt).toContain('00:01.50');
    });

    it('should not include JSON segments data', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 3.0,
        refinedSentences: mockRefinedSentences,
      });

      // Should NOT contain detailed JSON format used in old prompt
      expect(prompt).not.toContain('"startTimeSeconds"');
      expect(prompt).not.toContain('"endTimeSeconds"');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response with lines array', () => {
      const response = `{
        "segments": [
          { "lines": ["今日は良い天気です"] }
        ]
      }`;

      const result = service.parseResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0]?.lines).toEqual(['今日は良い天気です']);
    });

    it('should parse response with 2 lines', () => {
      const response = `{
        "segments": [
          { "lines": ["こんにちは", "世界"] }
        ]
      }`;

      const result = service.parseResponse(response);

      expect(result).toHaveLength(1);
      expect(result[0]?.lines).toEqual(['こんにちは', '世界']);
    });

    it('should parse response with surrounding text', () => {
      const response = `以下は生成された字幕です:
      {
        "segments": [
          { "lines": ["こんにちは"] },
          { "lines": ["さようなら"] }
        ]
      }
      以上です。`;

      const result = service.parseResponse(response);

      expect(result).toHaveLength(2);
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

    it('should throw error when segment has empty lines', () => {
      const response = `{
        "segments": [
          { "lines": [] }
        ]
      }`;

      expect(() => service.parseResponse(response)).toThrow('missing or empty lines');
    });

    it('should throw error when segment has too many lines', () => {
      const response = `{
        "segments": [
          { "lines": ["行1", "行2", "行3"] }
        ]
      }`;

      expect(() => service.parseResponse(response)).toThrow('too many lines');
    });

    it('should throw error when line exceeds max characters', () => {
      const response = `{
        "segments": [
          { "lines": ["これは確実に十七文字を超えています"] }
        ]
      }`;

      expect(() => service.parseResponse(response)).toThrow('too long');
    });

    it('should trim whitespace from lines', () => {
      const response = `{
        "segments": [
          { "lines": ["  テスト  ", "  テスト2  "] }
        ]
      }`;

      const result = service.parseResponse(response);

      expect(result[0]?.lines).toEqual(['テスト', 'テスト2']);
    });
  });

  describe('assignTimestamps', () => {
    it('should assign timestamps based on character position', () => {
      const parsedSegments = [{ lines: ['今日は良い天気です'] }];
      const sentences: RefinedSentence[] = [
        {
          text: '今日は良い天気です。',
          startTimeSeconds: 10.0,
          endTimeSeconds: 15.0,
          originalSegmentIndices: [],
        },
      ];

      const result = service.assignTimestamps(parsedSegments, sentences, 10.0);

      expect(result).toHaveLength(1);
      expect(result[0]?.index).toBe(0);
      expect(result[0]?.startTimeSeconds).toBe(0); // relative to clipStart
      expect(result[0]?.endTimeSeconds).toBeGreaterThan(0);
    });

    it('should handle multiple segments with interpolation', () => {
      const parsedSegments = [{ lines: ['今日は'] }, { lines: ['良い天気です'] }];
      const sentences: RefinedSentence[] = [
        {
          text: '今日は良い天気です。',
          startTimeSeconds: 0.0,
          endTimeSeconds: 3.0,
          originalSegmentIndices: [],
        },
      ];

      const result = service.assignTimestamps(parsedSegments, sentences, 0.0);

      expect(result).toHaveLength(2);
      expect(result[0]?.startTimeSeconds).toBe(0);
      expect(result[0]?.endTimeSeconds).toBeGreaterThan(0);
      expect(result[1]?.startTimeSeconds).toBe(result[0]?.endTimeSeconds);
      expect(result[1]?.endTimeSeconds).toBeLessThanOrEqual(3.0);
    });

    it('should handle segments spanning multiple sentences', () => {
      const parsedSegments = [{ lines: ['今日は良い'] }, { lines: ['天気です明日も晴れる'] }];
      const sentences: RefinedSentence[] = [
        {
          text: '今日は良い天気です。',
          startTimeSeconds: 0.0,
          endTimeSeconds: 2.0,
          originalSegmentIndices: [],
        },
        {
          text: '明日も晴れるといいですね。',
          startTimeSeconds: 2.0,
          endTimeSeconds: 4.0,
          originalSegmentIndices: [],
        },
      ];

      const result = service.assignTimestamps(parsedSegments, sentences, 0.0);

      expect(result).toHaveLength(2);
      // Second segment should span across both sentences
      expect(result[1]?.startTimeSeconds).toBeLessThan(2.0);
      expect(result[1]?.endTimeSeconds).toBeGreaterThan(2.0);
    });

    it('should throw error when no sentences provided', () => {
      expect(() => service.assignTimestamps([{ lines: ['test'] }], [], 0)).toThrow(
        'No sentences provided'
      );
    });

    it('should calculate relative time based on clipStartSeconds', () => {
      const parsedSegments = [{ lines: ['テスト'] }];
      const sentences: RefinedSentence[] = [
        {
          text: 'テスト',
          startTimeSeconds: 120.0,
          endTimeSeconds: 122.0,
          originalSegmentIndices: [],
        },
      ];

      const result = service.assignTimestamps(parsedSegments, sentences, 120.0);

      expect(result[0]?.startTimeSeconds).toBe(0); // relative to clipStart
      expect(result[0]?.endTimeSeconds).toBe(2.0); // 122 - 120
    });
  });
});
