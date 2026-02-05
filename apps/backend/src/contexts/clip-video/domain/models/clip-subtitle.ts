import { type Result, err, ok } from '@shared/domain/types/result.js';

/**
 * 字幕1行の最大文字数
 */
export const SUBTITLE_MAX_CHARS_PER_LINE = 16;

/**
 * 字幕の最大行数
 */
export const SUBTITLE_MAX_LINES = 2;

/**
 * 字幕セグメント
 * 画面に表示される1単位の字幕
 * lines: 字幕テキストの配列（1行16文字以内、最大2行）
 */
export interface ClipSubtitleSegment {
  index: number;
  lines: string[];
  startTimeSeconds: number;
  endTimeSeconds: number;
}

/**
 * 字幕ステータス
 */
export type ClipSubtitleStatus = 'draft' | 'confirmed';

/**
 * ClipSubtitle エラー型
 */
export type ClipSubtitleError =
  | { type: 'EMPTY_SEGMENTS'; message: string }
  | { type: 'INVALID_SEGMENT_ORDER'; message: string }
  | { type: 'INVALID_TIME_RANGE'; message: string }
  | { type: 'ALREADY_CONFIRMED'; message: string }
  | { type: 'EMPTY_LINES'; message: string }
  | { type: 'TOO_MANY_LINES'; message: string }
  | { type: 'LINE_TOO_LONG'; message: string };

/**
 * ClipSubtitle プロパティ
 */
export interface ClipSubtitleProps {
  id: string;
  clipId: string;
  segments: ClipSubtitleSegment[];
  status: ClipSubtitleStatus;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * ClipSubtitle 作成パラメータ
 */
export interface CreateClipSubtitleParams {
  clipId: string;
  segments: ClipSubtitleSegment[];
}

/**
 * ClipSubtitle ドメインモデル
 * クリップに紐づく字幕データを表現
 */
export class ClipSubtitle {
  readonly id: string;
  readonly clipId: string;
  readonly segments: ClipSubtitleSegment[];
  readonly status: ClipSubtitleStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ClipSubtitleProps) {
    this.id = props.id;
    this.clipId = props.clipId;
    this.segments = props.segments;
    this.status = props.status;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * 新規 ClipSubtitle を作成
   */
  static create(
    params: CreateClipSubtitleParams,
    generateId: () => string
  ): Result<ClipSubtitle, ClipSubtitleError> {
    const validationResult = ClipSubtitle.validateSegments(params.segments);
    if (!validationResult.success) {
      return validationResult;
    }

    const now = new Date();
    return ok(
      new ClipSubtitle({
        id: generateId(),
        clipId: params.clipId,
        segments: params.segments,
        status: 'draft',
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * DBからの復元
   */
  static fromProps(props: ClipSubtitleProps): ClipSubtitle {
    return new ClipSubtitle(props);
  }

  /**
   * セグメントを更新
   */
  withSegments(segments: ClipSubtitleSegment[]): Result<ClipSubtitle, ClipSubtitleError> {
    const validationResult = ClipSubtitle.validateSegments(segments);
    if (!validationResult.success) {
      return validationResult;
    }

    return ok(
      new ClipSubtitle({
        ...this.toProps(),
        segments,
        status: 'draft',
        updatedAt: new Date(),
      })
    );
  }

  /**
   * 字幕を確定する
   */
  confirm(): Result<ClipSubtitle, ClipSubtitleError> {
    if (this.status === 'confirmed') {
      return err({
        type: 'ALREADY_CONFIRMED',
        message: 'Subtitle is already confirmed',
      });
    }

    return ok(
      new ClipSubtitle({
        ...this.toProps(),
        status: 'confirmed',
        updatedAt: new Date(),
      })
    );
  }

  /**
   * プロパティオブジェクトに変換
   */
  toProps(): ClipSubtitleProps {
    return {
      id: this.id,
      clipId: this.clipId,
      segments: this.segments,
      status: this.status,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }

  /**
   * セグメントのバリデーション
   */
  private static validateSegments(
    segments: ClipSubtitleSegment[]
  ): Result<void, ClipSubtitleError> {
    if (segments.length === 0) {
      return err({
        type: 'EMPTY_SEGMENTS',
        message: 'Subtitle must have at least one segment',
      });
    }

    for (const [i, segment] of segments.entries()) {
      if (segment.startTimeSeconds >= segment.endTimeSeconds) {
        return err({
          type: 'INVALID_TIME_RANGE',
          message: `Segment ${i}: start time must be before end time`,
        });
      }

      if (segment.index !== i) {
        return err({
          type: 'INVALID_SEGMENT_ORDER',
          message: `Segment index mismatch at position ${i}`,
        });
      }

      // lines のバリデーション
      const linesValidation = ClipSubtitle.validateLines(segment.lines, i);
      if (!linesValidation.success) {
        return linesValidation;
      }
    }

    return ok(undefined);
  }

  /**
   * 字幕行のバリデーション
   * - 最低1行必要
   * - 最大2行まで
   * - 各行は16文字以内
   */
  private static validateLines(
    lines: string[],
    segmentIndex: number
  ): Result<void, ClipSubtitleError> {
    if (!lines || lines.length === 0) {
      return err({
        type: 'EMPTY_LINES',
        message: `Segment ${segmentIndex}: lines cannot be empty`,
      });
    }

    if (lines.length > SUBTITLE_MAX_LINES) {
      return err({
        type: 'TOO_MANY_LINES',
        message: `Segment ${segmentIndex}: maximum ${SUBTITLE_MAX_LINES} lines allowed, got ${lines.length}`,
      });
    }

    for (const [lineIndex, line] of lines.entries()) {
      if (line.length > SUBTITLE_MAX_CHARS_PER_LINE) {
        return err({
          type: 'LINE_TOO_LONG',
          message: `Segment ${segmentIndex}, line ${lineIndex + 1}: maximum ${SUBTITLE_MAX_CHARS_PER_LINE} characters allowed, got ${line.length}`,
        });
      }
    }

    return ok(undefined);
  }
}
