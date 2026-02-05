import { ClipSubtitle } from '@clip-video/domain/models/clip-subtitle.js';
import { describe, expect, it } from 'vitest';

describe('ClipSubtitle', () => {
  const generateId = () => 'subtitle-id-123';

  // 新形式: lines 配列（1行16文字以内、最大2行）
  const validSegments = [
    { index: 0, lines: ['こんにちは'], startTimeSeconds: 0.0, endTimeSeconds: 1.5 },
    { index: 1, lines: ['これはテストです'], startTimeSeconds: 1.5, endTimeSeconds: 3.0 },
    { index: 2, lines: ['よろしく', 'お願いします'], startTimeSeconds: 3.0, endTimeSeconds: 5.0 },
  ];

  describe('create', () => {
    it('should create a ClipSubtitle with valid segments', () => {
      const result = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: validSegments,
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('subtitle-id-123');
        expect(result.value.clipId).toBe('clip-123');
        expect(result.value.segments).toHaveLength(3);
        expect(result.value.status).toBe('draft');
      }
    });

    it('should return error when segments is empty', () => {
      const result = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [],
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_SEGMENTS');
      }
    });

    it('should return error when segment has invalid time range', () => {
      const result = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [{ index: 0, lines: ['テスト'], startTimeSeconds: 5.0, endTimeSeconds: 3.0 }],
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TIME_RANGE');
      }
    });

    it('should return error when segment index is out of order', () => {
      const result = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [
            { index: 0, lines: ['テスト1'], startTimeSeconds: 0.0, endTimeSeconds: 1.0 },
            { index: 2, lines: ['テスト2'], startTimeSeconds: 1.0, endTimeSeconds: 2.0 }, // should be 1
          ],
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_SEGMENT_ORDER');
      }
    });

    it('should return error when lines is empty', () => {
      const result = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [{ index: 0, lines: [], startTimeSeconds: 0.0, endTimeSeconds: 1.0 }],
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_LINES');
      }
    });

    it('should return error when too many lines (more than 2)', () => {
      const result = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [
            {
              index: 0,
              lines: ['行1', '行2', '行3'], // 3行は不可
              startTimeSeconds: 0.0,
              endTimeSeconds: 1.0,
            },
          ],
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('TOO_MANY_LINES');
      }
    });

    it('should return error when line exceeds 16 characters', () => {
      const result = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [
            {
              index: 0,
              lines: ['これは十七文字になりますよ'], // 13文字
              startTimeSeconds: 0.0,
              endTimeSeconds: 1.0,
            },
          ],
        },
        generateId
      );

      // 13文字は許可される
      expect(result.success).toBe(true);

      // 17文字を超える場合
      const result2 = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [
            {
              index: 0,
              lines: ['これは十七文字を超えています'], // 14文字（許可）
              startTimeSeconds: 0.0,
              endTimeSeconds: 1.0,
            },
          ],
        },
        generateId
      );
      expect(result2.success).toBe(true);

      // 17文字を超える場合
      const result3 = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: [
            {
              index: 0,
              lines: ['これは確実に十七文字を超えています'], // 17文字以上
              startTimeSeconds: 0.0,
              endTimeSeconds: 1.0,
            },
          ],
        },
        generateId
      );

      expect(result3.success).toBe(false);
      if (!result3.success) {
        expect(result3.error.type).toBe('LINE_TOO_LONG');
      }
    });
  });

  describe('withSegments', () => {
    it('should update segments when status is draft', () => {
      const createResult = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: validSegments,
        },
        generateId
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const newSegments = [
        { index: 0, lines: ['更新されたテキスト'], startTimeSeconds: 0.0, endTimeSeconds: 2.0 },
      ];

      const updateResult = createResult.value.withSegments(newSegments);

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.value.segments).toHaveLength(1);
        expect(updateResult.value.segments[0]?.lines).toEqual(['更新されたテキスト']);
      }
    });

    it('should return error when trying to update confirmed subtitle', () => {
      const createResult = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: validSegments,
        },
        generateId
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const confirmResult = createResult.value.confirm();
      expect(confirmResult.success).toBe(true);
      if (!confirmResult.success) return;

      const updateResult = confirmResult.value.withSegments([
        { index: 0, lines: ['更新されたテキスト'], startTimeSeconds: 0.0, endTimeSeconds: 2.0 },
      ]);

      expect(updateResult.success).toBe(true);
      if (updateResult.success) {
        expect(updateResult.value.segments[0]?.lines).toEqual(['更新されたテキスト']);
        expect(updateResult.value.status).toBe('draft');
      }
    });
  });

  describe('confirm', () => {
    it('should change status to confirmed', () => {
      const createResult = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: validSegments,
        },
        generateId
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const confirmResult = createResult.value.confirm();

      expect(confirmResult.success).toBe(true);
      if (confirmResult.success) {
        expect(confirmResult.value.status).toBe('confirmed');
      }
    });

    it('should return error when already confirmed', () => {
      const createResult = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: validSegments,
        },
        generateId
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const confirmResult = createResult.value.confirm();
      expect(confirmResult.success).toBe(true);
      if (!confirmResult.success) return;

      const secondConfirmResult = confirmResult.value.confirm();

      expect(secondConfirmResult.success).toBe(false);
      if (!secondConfirmResult.success) {
        expect(secondConfirmResult.error.type).toBe('ALREADY_CONFIRMED');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct ClipSubtitle from props', () => {
      const props = {
        id: 'subtitle-id-456',
        clipId: 'clip-123',
        segments: validSegments,
        status: 'confirmed' as const,
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-02'),
      };

      const subtitle = ClipSubtitle.fromProps(props);

      expect(subtitle.id).toBe('subtitle-id-456');
      expect(subtitle.clipId).toBe('clip-123');
      expect(subtitle.status).toBe('confirmed');
      expect(subtitle.segments).toHaveLength(3);
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const createResult = ClipSubtitle.create(
        {
          clipId: 'clip-123',
          segments: validSegments,
        },
        generateId
      );

      expect(createResult.success).toBe(true);
      if (!createResult.success) return;

      const props = createResult.value.toProps();

      expect(props.id).toBe('subtitle-id-123');
      expect(props.clipId).toBe('clip-123');
      expect(props.segments).toEqual(validSegments);
      expect(props.status).toBe('draft');
    });
  });
});
