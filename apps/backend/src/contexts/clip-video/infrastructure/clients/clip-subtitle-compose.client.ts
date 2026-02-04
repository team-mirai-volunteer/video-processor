import * as fs from 'node:fs';
import type {
  ClipSubtitleComposeError,
  ClipSubtitleComposeParams,
  ClipSubtitleComposeResult,
  ClipSubtitleComposerGateway,
  SubtitleStyle,
} from '@clip-video/domain/gateways/clip-subtitle-composer.gateway.js';
import { type Result, err, ok } from '@shared/domain/types/result.js';
import { FFmpegSubtitleGeneratorClient } from '@shared/infrastructure/clients/ffmpeg-subtitle-generator.client.js';
import ffmpeg from 'fluent-ffmpeg';

/**
 * Default font family for subtitle generation
 */
const DEFAULT_FONT_FAMILY = process.env.SUBTITLE_FONT_FAMILY || 'Noto Sans CJK JP';

/**
 * Default subtitle style settings
 */
const DEFAULT_STYLE: Required<SubtitleStyle> = {
  fontFamily: DEFAULT_FONT_FAMILY,
  fontSize: 64,
  fontColor: '#FFFFFF',
  outlineColor: '#000000',
  outlineWidth: 3,
  shadowColor: '#000000',
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  alignment: 'center',
  bold: true,
};

/**
 * Default vertical position (80% from top = near bottom)
 */
const DEFAULT_VERTICAL_POSITION = 0.8;

/**
 * Default horizontal padding in pixels
 */
const DEFAULT_HORIZONTAL_PADDING = 40;

/**
 * Clip Subtitle Compose Client
 * Composes subtitles onto a video clip using FFmpeg drawtext filter
 */
export class ClipSubtitleComposeClient implements ClipSubtitleComposerGateway {
  private readonly subtitleGenerator: FFmpegSubtitleGeneratorClient;

  constructor() {
    this.subtitleGenerator = new FFmpegSubtitleGeneratorClient();
  }

  /**
   * Compose subtitles onto a video clip
   */
  async compose(
    params: ClipSubtitleComposeParams
  ): Promise<Result<ClipSubtitleComposeResult, ClipSubtitleComposeError>> {
    // Validate input video exists
    if (!fs.existsSync(params.inputVideoPath)) {
      return err({
        type: 'INPUT_VIDEO_NOT_FOUND',
        message: `Input video not found: ${params.inputVideoPath}`,
      });
    }

    // Validate segments
    if (params.segments.length === 0) {
      return err({
        type: 'INVALID_SEGMENTS',
        message: 'Segments array cannot be empty',
      });
    }

    try {
      // Build drawtext filter for all segments
      const style = this.mergeStyles(params.style);
      const drawtextFilter = this.buildDrawtextFilter(
        params.segments,
        params.width,
        params.height,
        style
      );

      // Execute FFmpeg with drawtext filter
      const durationSeconds = await this.executeFFmpegCompose(
        params.inputVideoPath,
        params.outputPath,
        drawtextFilter
      );

      return ok({
        durationSeconds,
        outputPath: params.outputPath,
      });
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        return err(error as ClipSubtitleComposeError);
      }
      const message = error instanceof Error ? error.message : String(error);
      return err({
        type: 'COMPOSE_FAILED',
        message: `Failed to compose subtitles: ${message}`,
      });
    }
  }

  /**
   * Merge provided styles with defaults
   */
  private mergeStyles(style?: SubtitleStyle): Required<SubtitleStyle> {
    return {
      fontFamily: style?.fontFamily ?? DEFAULT_STYLE.fontFamily,
      fontSize: style?.fontSize ?? DEFAULT_STYLE.fontSize,
      fontColor: style?.fontColor ?? DEFAULT_STYLE.fontColor,
      outlineColor: style?.outlineColor ?? DEFAULT_STYLE.outlineColor,
      outlineWidth: style?.outlineWidth ?? DEFAULT_STYLE.outlineWidth,
      shadowColor: style?.shadowColor ?? DEFAULT_STYLE.shadowColor,
      shadowOffsetX: style?.shadowOffsetX ?? DEFAULT_STYLE.shadowOffsetX,
      shadowOffsetY: style?.shadowOffsetY ?? DEFAULT_STYLE.shadowOffsetY,
      alignment: style?.alignment ?? DEFAULT_STYLE.alignment,
      bold: style?.bold ?? DEFAULT_STYLE.bold,
    };
  }

  /**
   * Build drawtext filter string for all segments
   * Each segment is displayed at its specified time range
   */
  private buildDrawtextFilter(
    segments: ClipSubtitleComposeParams['segments'],
    _width: number,
    _height: number,
    style: Required<SubtitleStyle>
  ): string {
    const filters: string[] = [];

    // Convert hex color to FFmpeg format
    const fontColor = this.hexToFFmpegColor(style.fontColor);
    const outlineColor = this.hexToFFmpegColor(style.outlineColor);
    const shadowColor = this.hexToFFmpegColor(style.shadowColor);

    // Build font name
    const fontName =
      style.bold && style.fontFamily.includes('Hiragino')
        ? `${style.fontFamily} W6`
        : style.fontFamily;

    // Calculate positions
    const verticalPosition = DEFAULT_VERTICAL_POSITION;
    const horizontalPadding = DEFAULT_HORIZONTAL_PADDING;

    let xPosition: string;
    switch (style.alignment) {
      case 'left':
        xPosition = `${horizontalPadding}`;
        break;
      case 'right':
        xPosition = `w-text_w-${horizontalPadding}`;
        break;
      default:
        xPosition = '(w-text_w)/2';
        break;
    }

    const yPosition = `h*${verticalPosition}-text_h/2`;

    for (const segment of segments) {
      // Escape text for FFmpeg drawtext filter
      const escapedText = this.subtitleGenerator.escapeText(segment.text);

      // Create enable expression for time range
      const enableExpr = `enable='between(t,${segment.startTimeSeconds},${segment.endTimeSeconds})'`;

      const drawtextFilter = [
        `drawtext=text='${escapedText}'`,
        `font='${fontName}'`,
        `fontsize=${style.fontSize}`,
        `fontcolor=${fontColor}`,
        `bordercolor=${outlineColor}`,
        `borderw=${style.outlineWidth}`,
        `shadowcolor=${shadowColor}`,
        `shadowx=${style.shadowOffsetX}`,
        `shadowy=${style.shadowOffsetY}`,
        `x=${xPosition}`,
        `y=${yPosition}`,
        enableExpr,
      ].join(':');

      filters.push(drawtextFilter);
    }

    return filters.join(',');
  }

  /**
   * Convert hex color (#RRGGBB) to FFmpeg format (0xRRGGBB)
   */
  private hexToFFmpegColor(hex: string): string {
    const cleanHex = hex.replace('#', '');
    return `0x${cleanHex}`;
  }

  /**
   * Execute FFmpeg to compose subtitles onto video
   */
  private executeFFmpegCompose(
    inputPath: string,
    outputPath: string,
    drawtextFilter: string
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      let durationSeconds = 0;

      ffmpeg(inputPath)
        .videoFilters(drawtextFilter)
        .outputOptions(['-c:a copy'])
        .output(outputPath)
        .on('codecData', (data) => {
          // Parse duration from codec data
          if (data.duration) {
            const parts = data.duration.split(':');
            if (parts.length === 3) {
              const hours = Number.parseFloat(parts[0] || '0');
              const minutes = Number.parseFloat(parts[1] || '0');
              const seconds = Number.parseFloat(parts[2] || '0');
              durationSeconds = hours * 3600 + minutes * 60 + seconds;
            }
          }
        })
        .on('end', () => resolve(durationSeconds))
        .on('error', (err: Error) => {
          reject({
            type: 'FFMPEG_ERROR',
            message: `FFmpeg error: ${err.message}`,
            stderr: err.message,
          });
        })
        .run();
    });
  }
}
