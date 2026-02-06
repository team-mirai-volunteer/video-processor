import { ClipAnalysisPromptService } from '@clip-video/domain/services/clip-analysis-prompt.service.js';
import { describe, expect, it } from 'vitest';

describe('ClipAnalysisPromptService', () => {
  const service = new ClipAnalysisPromptService();

  const sentences = [
    {
      text: '今日はいい天気ですね。',
      startTimeSeconds: 0,
      endTimeSeconds: 3,
      originalSegmentIndices: [0],
    },
    {
      text: 'プログラミングの話をしましょう。',
      startTimeSeconds: 3,
      endTimeSeconds: 7,
      originalSegmentIndices: [1],
    },
    {
      text: 'TypeScriptは素晴らしい言語です。',
      startTimeSeconds: 7,
      endTimeSeconds: 12,
      originalSegmentIndices: [2],
    },
  ];

  describe('buildPrompt', () => {
    it('should build a prompt with single clip instruction by default', () => {
      const prompt = service.buildPrompt({
        refinedTranscription: {
          fullText: '今日はいい天気ですね。プログラミングの話をしましょう。',
          sentences,
          durationSeconds: 120,
        },
        videoTitle: 'テスト動画',
        clipInstructions: '面白い部分を切り抜いてください',
      });

      expect(prompt).toContain('テスト動画');
      expect(prompt).toContain('120秒');
      expect(prompt).toContain('面白い部分を切り抜いてください');
      expect(prompt).toContain('[0秒 - 3秒] 今日はいい天気ですね。');
      expect(prompt).toContain('必ず1つのクリップのみを抽出してください');
    });

    it('should build a prompt with multiple clips instruction when multipleClips is true', () => {
      const prompt = service.buildPrompt({
        refinedTranscription: {
          fullText: '今日はいい天気ですね。',
          sentences,
          durationSeconds: 120,
        },
        videoTitle: 'テスト動画',
        clipInstructions: '面白い部分を全て切り抜いてください',
        multipleClips: true,
      });

      expect(prompt).toContain('必要に応じて複数のクリップを抽出してください');
      expect(prompt).not.toContain('必ず1つのクリップのみを抽出してください');
    });

    it('should handle null videoTitle', () => {
      const prompt = service.buildPrompt({
        refinedTranscription: {
          fullText: '今日はいい天気ですね。',
          sentences,
          durationSeconds: 60,
        },
        videoTitle: null,
        clipInstructions: '切り抜いてください',
      });

      expect(prompt).toContain('タイトル: 不明');
    });

    it('should include all sentences with timestamps', () => {
      const prompt = service.buildPrompt({
        refinedTranscription: {
          fullText:
            '今日はいい天気ですね。プログラミングの話をしましょう。TypeScriptは素晴らしい言語です。',
          sentences,
          durationSeconds: 12,
        },
        videoTitle: 'テスト',
        clipInstructions: '切り抜いてください',
      });

      expect(prompt).toContain('[0秒 - 3秒] 今日はいい天気ですね。');
      expect(prompt).toContain('[3秒 - 7秒] プログラミングの話をしましょう。');
      expect(prompt).toContain('[7秒 - 12秒] TypeScriptは素晴らしい言語です。');
    });
  });

  describe('parseResponse', () => {
    it('should parse valid JSON response', () => {
      const response = JSON.stringify({
        clips: [
          {
            title: 'テストクリップ',
            startTimeSeconds: 0,
            endTimeSeconds: 10,
            transcript: 'テスト内容',
            reason: 'テスト理由',
          },
        ],
      });

      const result = service.parseResponse(response);

      expect(result.clips).toHaveLength(1);
      expect(result.clips[0]?.title).toBe('テストクリップ');
      expect(result.clips[0]?.startTimeSeconds).toBe(0);
      expect(result.clips[0]?.endTimeSeconds).toBe(10);
    });

    it('should parse JSON wrapped in markdown code block', () => {
      const response =
        '```json\n{"clips": [{"title": "テスト", "startTimeSeconds": 5, "endTimeSeconds": 15, "transcript": "内容", "reason": "理由"}]}\n```';

      const result = service.parseResponse(response);

      expect(result.clips).toHaveLength(1);
      expect(result.clips[0]?.title).toBe('テスト');
    });

    it('should parse JSON wrapped in plain code block', () => {
      const response =
        '```\n{"clips": [{"title": "テスト", "startTimeSeconds": 5, "endTimeSeconds": 15, "transcript": "内容", "reason": "理由"}]}\n```';

      const result = service.parseResponse(response);

      expect(result.clips).toHaveLength(1);
    });

    it('should throw error for invalid JSON', () => {
      expect(() => service.parseResponse('not json')).toThrow(
        'Failed to parse AI response as JSON'
      );
    });

    it('should throw error for missing clips array', () => {
      const response = JSON.stringify({ data: [] });

      expect(() => service.parseResponse(response)).toThrow(
        'Invalid response structure: missing clips array'
      );
    });

    it('should throw error for clip missing required fields', () => {
      const response = JSON.stringify({
        clips: [{ title: 'Test' }],
      });

      expect(() => service.parseResponse(response)).toThrow(
        'Invalid clip data: missing required fields'
      );
    });

    it('should throw error for empty response after extraction', () => {
      expect(() => service.parseResponse('```json\n\n```')).toThrow();
    });

    it('should parse multiple clips', () => {
      const response = JSON.stringify({
        clips: [
          {
            title: 'Clip 1',
            startTimeSeconds: 0,
            endTimeSeconds: 10,
            transcript: 'a',
            reason: 'b',
          },
          {
            title: 'Clip 2',
            startTimeSeconds: 20,
            endTimeSeconds: 30,
            transcript: 'c',
            reason: 'd',
          },
        ],
      });

      const result = service.parseResponse(response);

      expect(result.clips).toHaveLength(2);
      expect(result.clips[0]?.title).toBe('Clip 1');
      expect(result.clips[1]?.title).toBe('Clip 2');
    });
  });
});
