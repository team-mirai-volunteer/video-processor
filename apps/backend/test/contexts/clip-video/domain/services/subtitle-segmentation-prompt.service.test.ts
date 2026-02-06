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
      const result = service.filterSentencesForClip(mockRefinedSentences, 2.0, 4.0);
      expect(result.length).toBe(1);
      expect(result[0]?.text).toBe('明日も晴れるといいですね。');
    });
  });

  describe('normalizeText', () => {
    it('should remove punctuation and whitespace', () => {
      expect(service.normalizeText('今日は良い天気です。')).toBe('今日は良い天気です');
      expect(service.normalizeText('明日も晴れる、といいですね！')).toBe(
        '明日も晴れるといいですね'
      );
      expect(service.normalizeText('テスト テスト')).toBe('テストテスト');
    });
  });

  describe('buildNormalizedFullText', () => {
    it('should concatenate normalized texts from sentences', () => {
      const fullText = service.buildNormalizedFullText(mockRefinedSentences);
      expect(fullText).toBe('今日は良い天気です明日も晴れるといいですね');
    });
  });

  describe('buildPrompt', () => {
    it('should build a prompt asking for numbered chunk format', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 3.0,
        refinedSentences: mockRefinedSentences,
      });

      expect(prompt).toContain('字幕編集者');
      expect(prompt).toContain('今日は良い天気です明日も晴れるといいですね');
      expect(prompt).toContain('16文字以内');
      expect(prompt).toContain('1.');
      expect(prompt).toContain('2.');
    });

    it('should not contain old format instructions', () => {
      const prompt = service.buildPrompt({
        clipStartSeconds: 0.0,
        clipEndSeconds: 3.0,
        refinedSentences: mockRefinedSentences,
      });

      expect(prompt).not.toContain('"breaks"');
      expect(prompt).not.toContain('"segments"');
      expect(prompt).not.toContain('"start"');
    });
  });

  describe('parseResponse', () => {
    const fullText = '今日はとても良い天気ですね皆さんお元気ですか';

    it('should parse sequential numbered format (Claude style)', () => {
      const response = '1. 今日はとても\n   良い天気ですね\n\n2. 皆さん\n   お元気ですか';
      const result = service.parseResponse(response, fullText);
      expect(result).toEqual([
        { lines: ['今日はとても', '良い天気ですね'] },
        { lines: ['皆さん', 'お元気ですか'] },
      ]);
    });

    it('should parse 1./2. format (GPT style)', () => {
      const response = '1. 今日はとても\n\n2. 良い天気ですね\n\n3. 皆さん\n\n4. お元気ですか';
      const result = service.parseResponse(response, fullText);
      const reconstructed = result.flatMap((s) => s.lines).join('');
      expect(reconstructed).toBe(fullText);
    });

    it('should parse mixed 1-line and 2-line chunks', () => {
      const response = '1. 今日はとても\n   良い天気ですね\n\n2. 皆さんお元気ですか';
      const result = service.parseResponse(response, fullText);
      expect(result).toEqual([
        { lines: ['今日はとても', '良い天気ですね'] },
        { lines: ['皆さんお元気ですか'] },
      ]);
    });

    it('should parse 1-line only chunks', () => {
      const response = '1. 今日はとても\n\n2. 良い天気ですね\n\n3. 皆さん';
      const result = service.parseResponse(response, fullText);
      expect(result).toHaveLength(3);
      expect(result[0]?.lines).toEqual(['今日はとても']);
      expect(result[1]?.lines).toEqual(['良い天気ですね']);
      // remaining text "お元気ですか" appended to last 1-line segment
      expect(result[2]?.lines).toEqual(['皆さん', 'お元気ですか']);
    });

    it('should restore text via slice (no text loss)', () => {
      const response = '1. 今日はとても\n   良い天気ですね\n\n2. 皆さん\n   お元気ですか';
      const result = service.parseResponse(response, fullText);
      const reconstructed = result.flatMap((s) => s.lines).join('');
      expect(reconstructed).toBe(fullText);
    });

    it('should handle LLM adding punctuation', () => {
      const response = '1. 今日はとても、\n   良い天気ですね。\n\n2. 皆さん！\n   お元気ですか？';
      const result = service.parseResponse(response, fullText);
      const reconstructed = result.flatMap((s) => s.lines).join('');
      expect(reconstructed).toBe(fullText);
    });

    it('should skip unrecognized lines', () => {
      const response = '1. 今日はとても\n   存在しないテキスト\n\n2. 皆さん';
      const result = service.parseResponse(response, fullText);
      const reconstructed = result.flatMap((s) => s.lines).join('');
      expect(reconstructed).toBe(fullText);
    });

    it('should return full text when all lines fail to match', () => {
      const response = '1. 存在しないテキスト\n   ハルシネーション';
      const result = service.parseResponse(response, fullText);
      expect(result).toEqual([{ lines: [fullText] }]);
    });

    it('should throw error when no chunks found', () => {
      expect(() => service.parseResponse('これは番号なし', fullText)).toThrow('No chunks found');
    });

    it('should handle response with surrounding text', () => {
      const response =
        '以下が字幕です:\n\n1. 今日はとても\n   良い天気ですね\n\n2. 皆さんお元気ですか\n\n以上です。';
      const result = service.parseResponse(response, fullText);
      const reconstructed = result.flatMap((s) => s.lines).join('');
      expect(reconstructed).toBe(fullText);
    });
  });

  describe('splitLongLines', () => {
    it('should not modify segments with lines within limit', () => {
      const segments = [{ lines: ['あいうえお', 'かきくけこ'] }];
      const result = service.splitLongLines(segments);
      expect(result).toEqual([{ lines: ['あいうえお', 'かきくけこ'] }]);
    });

    it('should split long lines and regroup into 1-2 line segments', () => {
      const long = 'あ'.repeat(20);
      const segments = [{ lines: [long] }];
      const result = service.splitLongLines(segments);
      expect(result).toHaveLength(1);
      expect(result[0]?.lines).toEqual(['あ'.repeat(16), 'あ'.repeat(4)]);
    });

    it('should preserve total text', () => {
      const segments = [{ lines: ['あ'.repeat(20)] }, { lines: ['い'.repeat(5)] }];
      const result = service.splitLongLines(segments);
      const original = segments.flatMap((s) => s.lines).join('');
      const reconstructed = result.flatMap((s) => s.lines).join('');
      expect(reconstructed).toBe(original);
    });
  });

  describe('assignTimestamps', () => {
    it('should assign timestamps based on character position', () => {
      const segments = [{ lines: ['今日は良い天気です'] }];
      const sentences: RefinedSentence[] = [
        {
          text: '今日は良い天気です。',
          startTimeSeconds: 10.0,
          endTimeSeconds: 15.0,
          originalSegmentIndices: [],
        },
      ];

      const result = service.assignTimestamps(segments, sentences, 10.0);

      expect(result).toHaveLength(1);
      expect(result[0]?.index).toBe(0);
      expect(result[0]?.lines).toEqual(['今日は良い天気です']);
      expect(result[0]?.startTimeSeconds).toBe(0);
      expect(result[0]?.endTimeSeconds).toBeGreaterThan(0);
    });

    it('should handle multiple segments with interpolation', () => {
      const segments = [{ lines: ['今日は'] }, { lines: ['良い天気です'] }];
      const sentences: RefinedSentence[] = [
        {
          text: '今日は良い天気です。',
          startTimeSeconds: 0.0,
          endTimeSeconds: 3.0,
          originalSegmentIndices: [],
        },
      ];

      const result = service.assignTimestamps(segments, sentences, 0.0);

      expect(result).toHaveLength(2);
      expect(result[0]?.startTimeSeconds).toBe(0);
      expect(result[0]?.endTimeSeconds).toBeGreaterThan(0);
      expect(result[1]?.startTimeSeconds).toBe(result[0]?.endTimeSeconds);
      expect(result[1]?.endTimeSeconds).toBeLessThanOrEqual(3.0);
    });

    it('should throw error when no sentences provided', () => {
      expect(() => service.assignTimestamps([{ lines: ['test'] }], [], 0)).toThrow(
        'No sentences provided'
      );
    });

    it('should calculate relative time based on clipStartSeconds', () => {
      const sentences: RefinedSentence[] = [
        {
          text: 'テスト',
          startTimeSeconds: 120.0,
          endTimeSeconds: 122.0,
          originalSegmentIndices: [],
        },
      ];
      const segments = [{ lines: ['テスト'] }];

      const result = service.assignTimestamps(segments, sentences, 120.0);

      expect(result[0]?.startTimeSeconds).toBe(0);
      expect(result[0]?.endTimeSeconds).toBe(2.0);
    });
  });

  describe('end-to-end: parseResponse → splitLongLines → assignTimestamps', () => {
    it('should produce valid segments from LLM chunk response', () => {
      const sentences: RefinedSentence[] = [
        {
          text: 'ちなみにどちらの選挙区なんですか？',
          startTimeSeconds: 13.0,
          endTimeSeconds: 15.0,
          originalSegmentIndices: [],
        },
        {
          text: '佐賀2区が選挙区なんですけど、負けて比例復活で当選してるんで',
          startTimeSeconds: 16.0,
          endTimeSeconds: 26.0,
          originalSegmentIndices: [],
        },
      ];
      const fullText = service.buildNormalizedFullText(sentences);

      const response = [
        '1. ちなみにどちらの',
        '   選挙区なんですか',
        '',
        '2. 佐賀2区が',
        '   選挙区なんですけど',
        '',
        '3. 負けて比例復活で',
        '   当選してるんで',
      ].join('\n');

      const builtSegments = service.parseResponse(response, fullText);
      const segments = service.splitLongLines(builtSegments);
      const result = service.assignTimestamps(segments, sentences, 13.0);

      // All text preserved
      const reconstructed = result.flatMap((seg) => seg.lines).join('');
      expect(reconstructed).toBe(fullText);

      // Each line within limit
      for (const seg of result) {
        for (const line of seg.lines) {
          expect(line.length).toBeLessThanOrEqual(16);
        }
        expect(seg.lines.length).toBeLessThanOrEqual(2);
      }

      // Timestamps are sequential
      for (let i = 1; i < result.length; i++) {
        const prev = result[i - 1];
        const curr = result[i];
        if (prev && curr) {
          expect(curr.startTimeSeconds).toBe(prev.endTimeSeconds);
        }
      }
    });

    it('should handle LLM hallucination gracefully (bad lines still produce valid output)', () => {
      const sentences: RefinedSentence[] = [
        {
          text: '今日は良い天気です。明日も晴れるといいですね。',
          startTimeSeconds: 0.0,
          endTimeSeconds: 3.0,
          originalSegmentIndices: [],
        },
      ];
      const fullText = service.buildNormalizedFullText(sentences);

      // LLM returns nonsense lines
      const response = '1. 存在しない\n2. ハルシネーション';

      const builtSegments = service.parseResponse(response, fullText);
      const segments = service.splitLongLines(builtSegments);
      const result = service.assignTimestamps(segments, sentences, 0.0);

      // Still all text preserved (mechanically split)
      const reconstructed = result.flatMap((seg) => seg.lines).join('');
      expect(reconstructed).toBe(fullText);

      // Each line within limit
      for (const seg of result) {
        for (const line of seg.lines) {
          expect(line.length).toBeLessThanOrEqual(16);
        }
      }
    });
  });
});
