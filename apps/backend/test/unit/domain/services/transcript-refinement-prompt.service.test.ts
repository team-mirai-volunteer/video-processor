import { describe, expect, it } from 'vitest';
import type { TranscriptionSegment } from '../../../../src/domain/models/transcription.js';
import {
  type ProperNounDictionary,
  TranscriptRefinementPromptService,
} from '../../../../src/domain/services/transcript-refinement-prompt.service.js';

describe('TranscriptRefinementPromptService', () => {
  const service = new TranscriptRefinementPromptService();

  const mockDictionary: ProperNounDictionary = {
    version: '1.0.0',
    description: 'Test dictionary',
    entries: [
      {
        correct: 'チームみらい',
        category: 'organization',
        description: '政党名',
        wrongPatterns: ['チーム未来', 'チームミライ'],
      },
      {
        correct: '安野たかひろ',
        category: 'person',
        description: 'チームみらい党首',
        wrongPatterns: ['安野高広', 'あんの高広'],
      },
      {
        correct: '党首',
        category: 'political_term',
        description: '政党の代表者（政治の文脈で）',
        wrongPatterns: ['投手', '闘手'],
      },
    ],
  };

  const mockSegments: TranscriptionSegment[] = [
    { text: 'どうも', startTimeSeconds: 0.08, endTimeSeconds: 0.2, confidence: 0.95 },
    { text: 'こんにちは', startTimeSeconds: 0.22, endTimeSeconds: 0.6, confidence: 0.98 },
    { text: 'チーム未来', startTimeSeconds: 0.65, endTimeSeconds: 1.2, confidence: 0.85 },
    { text: '投手', startTimeSeconds: 1.25, endTimeSeconds: 1.5, confidence: 0.75 },
    { text: 'の', startTimeSeconds: 1.52, endTimeSeconds: 1.6, confidence: 0.99 },
    { text: '安野高広', startTimeSeconds: 1.62, endTimeSeconds: 2.0, confidence: 0.8 },
    { text: 'です', startTimeSeconds: 2.02, endTimeSeconds: 2.3, confidence: 0.97 },
  ];

  describe('buildPrompt', () => {
    it('should include dictionary section with wrong patterns and corrections', () => {
      const prompt = service.buildPrompt(mockSegments, mockDictionary);

      expect(prompt).toContain('## 固有名詞辞書');
      expect(prompt).toContain('チーム未来、チームミライ → チームみらい（政党名）');
      expect(prompt).toContain('安野高広、あんの高広 → 安野たかひろ（チームみらい党首）');
      expect(prompt).toContain('投手、闘手 → 党首（政党の代表者（政治の文脈で））');
    });

    it('should include formatted input segments', () => {
      const prompt = service.buildPrompt(mockSegments, mockDictionary);

      expect(prompt).toContain('[0] [0.08-0.20] どうも');
      expect(prompt).toContain('[1] [0.22-0.60] こんにちは');
      expect(prompt).toContain('[2] [0.65-1.20] チーム未来');
      expect(prompt).toContain('[3] [1.25-1.50] 投手');
      expect(prompt).toContain('[4] [1.52-1.60] の');
      expect(prompt).toContain('[5] [1.62-2.00] 安野高広');
      expect(prompt).toContain('[6] [2.02-2.30] です');
    });

    it('should include task instructions', () => {
      const prompt = service.buildPrompt(mockSegments, mockDictionary);

      expect(prompt).toContain('## タスク');
      expect(prompt).toContain('単語レベルのセグメントを日本語の自然な文単位にマージ');
      expect(prompt).toContain('固有名詞を辞書に基づいて修正');
      expect(prompt).toContain('政治の文脈を考慮して同音異義語を補正');
    });

    it('should include output format specification', () => {
      const prompt = service.buildPrompt(mockSegments, mockDictionary);

      expect(prompt).toContain('## 出力フォーマット（JSON）');
      expect(prompt).toContain('"sentences"');
      expect(prompt).toContain('"text"');
      expect(prompt).toContain('"startTimeSeconds"');
      expect(prompt).toContain('"endTimeSeconds"');
      expect(prompt).toContain('"originalSegmentIndices"');
    });

    it('should include important notes about sentence splitting', () => {
      const prompt = service.buildPrompt(mockSegments, mockDictionary);

      expect(prompt).toContain('## 重要な注意事項');
      expect(prompt).toContain('句点（。）で文を区切ってください');
    });

    it('should handle empty segments', () => {
      const prompt = service.buildPrompt([], mockDictionary);

      expect(prompt).toContain('## 入力データ');
      // Should not throw error
    });

    it('should handle dictionary with single entry', () => {
      const singleEntryDict: ProperNounDictionary = {
        version: '1.0.0',
        description: 'Single entry',
        entries: [
          {
            correct: 'テスト',
            category: 'test',
            description: 'テスト用',
            wrongPatterns: ['てすと'],
          },
        ],
      };

      const prompt = service.buildPrompt(mockSegments, singleEntryDict);

      expect(prompt).toContain('てすと → テスト（テスト用）');
    });
  });

  describe('splitIntoChunks', () => {
    it('should return empty array for empty segments', () => {
      const chunks = service.splitIntoChunks([]);

      expect(chunks).toHaveLength(0);
    });

    it('should return single chunk when segments fit within chunk size', () => {
      const chunks = service.splitIntoChunks(mockSegments, 100);

      expect(chunks).toHaveLength(1);
      expect(chunks[0].segments).toEqual(mockSegments);
      expect(chunks[0].startIndex).toBe(0);
      expect(chunks[0].endIndex).toBe(6);
      expect(chunks[0].chunkIndex).toBe(0);
      expect(chunks[0].totalChunks).toBe(1);
    });

    it('should split segments into multiple chunks with overlap', () => {
      // Create 100 segments
      const manySegments: TranscriptionSegment[] = [];
      for (let i = 0; i < 100; i++) {
        manySegments.push({
          text: `word${i}`,
          startTimeSeconds: i * 0.1,
          endTimeSeconds: (i + 1) * 0.1,
          confidence: 0.9,
        });
      }

      // Use chunk size of 30
      const chunks = service.splitIntoChunks(manySegments, 30);

      // Should have multiple chunks
      expect(chunks.length).toBeGreaterThan(1);

      // First chunk should start at 0
      expect(chunks[0].startIndex).toBe(0);
      expect(chunks[0].endIndex).toBe(29);

      // Second chunk should overlap with first (by 10 segments by default)
      expect(chunks[1].startIndex).toBe(20); // 30 - 10 overlap

      // All chunks should have correct totalChunks
      for (const chunk of chunks) {
        expect(chunk.totalChunks).toBe(chunks.length);
      }
    });

    it('should have correct segment counts in each chunk', () => {
      const manySegments: TranscriptionSegment[] = [];
      for (let i = 0; i < 50; i++) {
        manySegments.push({
          text: `word${i}`,
          startTimeSeconds: i * 0.1,
          endTimeSeconds: (i + 1) * 0.1,
          confidence: 0.9,
        });
      }

      const chunks = service.splitIntoChunks(manySegments, 20);

      // Each chunk (except possibly last) should have chunk size segments
      expect(chunks[0].segments).toHaveLength(20);
    });
  });

  describe('buildChunkPrompt', () => {
    it('should include chunk information in prompt', () => {
      const chunk = {
        segments: mockSegments,
        startIndex: 100,
        endIndex: 106,
        chunkIndex: 1,
        totalChunks: 5,
      };

      const prompt = service.buildChunkPrompt(chunk, mockDictionary);

      expect(prompt).toContain('2 番目'); // chunkIndex + 1
      expect(prompt).toContain('5 個のチャンク');
      expect(prompt).toContain('セグメントindex 100 から 106');
    });

    it('should use absolute indices in input section', () => {
      const chunk = {
        segments: mockSegments.slice(0, 3),
        startIndex: 50,
        endIndex: 52,
        chunkIndex: 2,
        totalChunks: 10,
      };

      const prompt = service.buildChunkPrompt(chunk, mockDictionary);

      // Should use absolute indices starting from 50
      expect(prompt).toContain('[50]');
      expect(prompt).toContain('[51]');
      expect(prompt).toContain('[52]');
      // Should not contain relative indices
      expect(prompt).not.toMatch(/\[0\] \[\d/);
    });

    it('should include previous context when provided', () => {
      const chunk = {
        segments: mockSegments,
        startIndex: 100,
        endIndex: 106,
        chunkIndex: 1,
        totalChunks: 5,
      };

      const previousContext = '前の文章です。これも前の文章です。';
      const prompt = service.buildChunkPrompt(chunk, mockDictionary, previousContext);

      expect(prompt).toContain('## 前のチャンクの末尾');
      expect(prompt).toContain(previousContext);
      expect(prompt).toContain('出力には含めないでください');
    });

    it('should not include chunk info section for single chunk', () => {
      const chunk = {
        segments: mockSegments,
        startIndex: 0,
        endIndex: 6,
        chunkIndex: 0,
        totalChunks: 1,
      };

      const prompt = service.buildChunkPrompt(chunk, mockDictionary);

      // Should not include chunk info for single chunk
      expect(prompt).not.toContain('## チャンク情報');
    });

    it('should include instruction to process all segments', () => {
      const chunk = {
        segments: mockSegments,
        startIndex: 0,
        endIndex: 6,
        chunkIndex: 0,
        totalChunks: 3,
      };

      const prompt = service.buildChunkPrompt(chunk, mockDictionary);

      expect(prompt).toContain('すべてのセグメントを処理し、最後まで出力してください');
    });
  });
});
