import { type Result, err, ok } from '@shared/domain/types/result.js';

/**
 * Visual type for a scene
 * - image_gen: AI-generated image
 * - stock_video: Pre-existing video asset (party leader speech, etc.)
 * - solid_color: Solid color background
 */
export type VisualType = 'image_gen' | 'stock_video' | 'solid_color';

export type ShortsSceneError =
  | { type: 'INVALID_SCRIPT_ID'; message: string }
  | { type: 'INVALID_ORDER'; message: string }
  | { type: 'INVALID_SUMMARY'; message: string }
  | { type: 'INVALID_VISUAL_TYPE'; message: string }
  | { type: 'MISSING_STOCK_VIDEO_KEY'; message: string }
  | { type: 'MISSING_SOLID_COLOR'; message: string }
  | { type: 'INVALID_SILENCE_DURATION'; message: string }
  | { type: 'MISSING_VOICE_OR_SILENCE'; message: string };

export interface ShortsSceneProps {
  id: string;
  scriptId: string;
  order: number;
  summary: string;
  visualType: VisualType;
  voiceText: string | null;
  subtitles: string[];
  silenceDurationMs: number | null;
  stockVideoKey: string | null;
  solidColor: string | null;
  imagePrompt: string | null;
  imageStyleHint: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateShortsSceneParams {
  scriptId: string;
  order: number;
  summary: string;
  visualType: VisualType;
  voiceText?: string | null;
  subtitles?: string[];
  silenceDurationMs?: number | null;
  stockVideoKey?: string | null;
  solidColor?: string | null;
  imageStyleHint?: string | null;
}

const VALID_VISUAL_TYPES: VisualType[] = ['image_gen', 'stock_video', 'solid_color'];

function isValidVisualType(type: string): type is VisualType {
  return VALID_VISUAL_TYPES.includes(type as VisualType);
}

function isValidHexColor(color: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(color);
}

export class ShortsScene {
  readonly id: string;
  readonly scriptId: string;
  readonly order: number;
  readonly summary: string;
  readonly visualType: VisualType;
  readonly voiceText: string | null;
  readonly subtitles: string[];
  readonly silenceDurationMs: number | null;
  readonly stockVideoKey: string | null;
  readonly solidColor: string | null;
  readonly imagePrompt: string | null;
  readonly imageStyleHint: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;

  private constructor(props: ShortsSceneProps) {
    this.id = props.id;
    this.scriptId = props.scriptId;
    this.order = props.order;
    this.summary = props.summary;
    this.visualType = props.visualType;
    this.voiceText = props.voiceText;
    this.subtitles = props.subtitles;
    this.silenceDurationMs = props.silenceDurationMs;
    this.stockVideoKey = props.stockVideoKey;
    this.solidColor = props.solidColor;
    this.imagePrompt = props.imagePrompt;
    this.imageStyleHint = props.imageStyleHint;
    this.createdAt = props.createdAt;
    this.updatedAt = props.updatedAt;
  }

  /**
   * Create a new ShortsScene
   */
  static create(
    params: CreateShortsSceneParams,
    generateId: () => string
  ): Result<ShortsScene, ShortsSceneError> {
    if (!params.scriptId || params.scriptId.trim().length === 0) {
      return err({
        type: 'INVALID_SCRIPT_ID',
        message: 'Script ID cannot be empty',
      });
    }

    if (params.order < 0) {
      return err({
        type: 'INVALID_ORDER',
        message: 'Order must be a non-negative integer',
      });
    }

    if (!params.summary || params.summary.trim().length === 0) {
      return err({
        type: 'INVALID_SUMMARY',
        message: 'Summary cannot be empty',
      });
    }

    if (!isValidVisualType(params.visualType)) {
      return err({
        type: 'INVALID_VISUAL_TYPE',
        message: `Invalid visual type. Valid values: ${VALID_VISUAL_TYPES.join(', ')}`,
      });
    }

    // Validate visual type specific requirements
    if (params.visualType === 'stock_video' && !params.stockVideoKey) {
      return err({
        type: 'MISSING_STOCK_VIDEO_KEY',
        message: 'Stock video key is required for stock_video visual type',
      });
    }

    if (params.visualType === 'solid_color') {
      if (!params.solidColor) {
        return err({
          type: 'MISSING_SOLID_COLOR',
          message: 'Solid color is required for solid_color visual type',
        });
      }
      if (!isValidHexColor(params.solidColor)) {
        return err({
          type: 'MISSING_SOLID_COLOR',
          message: 'Solid color must be a valid hex color (e.g., #RRGGBB)',
        });
      }
    }

    // Validate that either voiceText or silenceDurationMs is provided
    const hasVoice = params.voiceText && params.voiceText.trim().length > 0;
    const hasSilence = params.silenceDurationMs !== undefined && params.silenceDurationMs !== null;

    if (!hasVoice && !hasSilence) {
      return err({
        type: 'MISSING_VOICE_OR_SILENCE',
        message: 'Either voiceText or silenceDurationMs must be provided',
      });
    }

    if (
      params.silenceDurationMs !== undefined &&
      params.silenceDurationMs !== null &&
      params.silenceDurationMs <= 0
    ) {
      return err({
        type: 'INVALID_SILENCE_DURATION',
        message: 'Silence duration must be a positive number',
      });
    }

    const now = new Date();
    return ok(
      new ShortsScene({
        id: generateId(),
        scriptId: params.scriptId.trim(),
        order: params.order,
        summary: params.summary.trim(),
        visualType: params.visualType,
        voiceText: params.voiceText?.trim() ?? null,
        subtitles: params.subtitles ?? [],
        silenceDurationMs: params.silenceDurationMs ?? null,
        stockVideoKey: params.stockVideoKey ?? null,
        solidColor: params.solidColor ?? null,
        imagePrompt: null,
        imageStyleHint: params.imageStyleHint ?? null,
        createdAt: now,
        updatedAt: now,
      })
    );
  }

  /**
   * Reconstruct ShortsScene from database
   */
  static fromProps(props: ShortsSceneProps): ShortsScene {
    return new ShortsScene(props);
  }

  /**
   * Update scene summary
   */
  withSummary(summary: string): Result<ShortsScene, ShortsSceneError> {
    if (!summary || summary.trim().length === 0) {
      return err({
        type: 'INVALID_SUMMARY',
        message: 'Summary cannot be empty',
      });
    }

    return ok(
      new ShortsScene({
        ...this.toProps(),
        summary: summary.trim(),
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update scene voice text
   */
  withVoiceText(voiceText: string | null): Result<ShortsScene, ShortsSceneError> {
    const hasVoice = voiceText && voiceText.trim().length > 0;
    const hasSilence = this.silenceDurationMs !== null;

    if (!hasVoice && !hasSilence) {
      return err({
        type: 'MISSING_VOICE_OR_SILENCE',
        message: 'Either voiceText or silenceDurationMs must be provided',
      });
    }

    return ok(
      new ShortsScene({
        ...this.toProps(),
        voiceText: voiceText?.trim() ?? null,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Update scene subtitles
   */
  withSubtitles(subtitles: string[]): ShortsScene {
    return new ShortsScene({
      ...this.toProps(),
      subtitles,
      updatedAt: new Date(),
    });
  }

  /**
   * Update scene image prompt
   */
  withImagePrompt(imagePrompt: string | null): ShortsScene {
    return new ShortsScene({
      ...this.toProps(),
      imagePrompt: imagePrompt?.trim() ?? null,
      updatedAt: new Date(),
    });
  }

  /**
   * Update scene image style hint
   */
  withImageStyleHint(imageStyleHint: string | null): ShortsScene {
    return new ShortsScene({
      ...this.toProps(),
      imageStyleHint: imageStyleHint?.trim() ?? null,
      updatedAt: new Date(),
    });
  }

  /**
   * Update scene order
   */
  withOrder(order: number): Result<ShortsScene, ShortsSceneError> {
    if (order < 0) {
      return err({
        type: 'INVALID_ORDER',
        message: 'Order must be a non-negative integer',
      });
    }

    return ok(
      new ShortsScene({
        ...this.toProps(),
        order,
        updatedAt: new Date(),
      })
    );
  }

  /**
   * Convert to plain object
   */
  toProps(): ShortsSceneProps {
    return {
      id: this.id,
      scriptId: this.scriptId,
      order: this.order,
      summary: this.summary,
      visualType: this.visualType,
      voiceText: this.voiceText,
      subtitles: this.subtitles,
      silenceDurationMs: this.silenceDurationMs,
      stockVideoKey: this.stockVideoKey,
      solidColor: this.solidColor,
      imagePrompt: this.imagePrompt,
      imageStyleHint: this.imageStyleHint,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
    };
  }
}
