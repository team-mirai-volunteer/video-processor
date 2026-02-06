import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import type {
  ClipSubtitleComposeError,
  ClipSubtitleComposeParams,
  ClipSubtitleComposeResult,
  ClipSubtitleComposerGateway,
  SubtitleStyle,
} from '@clip-video/domain/gateways/clip-subtitle-composer.gateway.js';
import type { ClipSubtitleSegment } from '@clip-video/domain/models/clip-subtitle.js';
import { type Result, err, ok } from '@shared/domain/types/result.js';
import type { SubtitleFontSize } from '@video-processor/shared';

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
  outlineWidth: 8,
  shadowColor: '#000000',
  shadowOffsetX: 2,
  shadowOffsetY: 2,
  alignment: 'center',
  bold: true,
};

/**
 * 動画横幅に対するフォントサイズの比率
 */
const FONT_SIZE_RATIO: Record<SubtitleFontSize, number> = {
  small: 96 / 1920,
  medium: 120 / 1920,
  large: 148 / 1920,
};

/**
 * フォントサイズに対するアウトライン幅の比率
 */
const OUTLINE_RATIO: Record<SubtitleFontSize, number> = {
  small: 8 / 64,
  medium: 10 / 80,
  large: 12 / 96,
};

/**
 * 動画横幅からフォントサイズとアウトライン幅を算出する
 */
function calcFontMetrics(
  fontSizeKey: SubtitleFontSize,
  videoWidth: number
): { fontSize: number; outlineWidth: number } {
  const fontSize = Math.round(videoWidth * FONT_SIZE_RATIO[fontSizeKey]);
  const outlineWidth = Math.round(fontSize * OUTLINE_RATIO[fontSizeKey]);
  return { fontSize, outlineWidth };
}

/**
 * Clip Subtitle Compose Client
 * Composes subtitles onto a video clip using drawtext direct rendering
 *
 * 処理フロー（改善版）:
 * 1. 字幕セグメントからdrawtextフィルタチェーンを構築
 * 2. enable='between(t,start,end)' で時間指定描画
 * 3. 1回のFFmpeg呼び出しで完結（PNG中間ステップ不要）
 */
export class ClipSubtitleComposeClient implements ClipSubtitleComposerGateway {
  /**
   * Compose subtitles onto a video clip using drawtext direct rendering
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

    // フォントサイズの決定（動画横幅ベース）
    const fontSizeKey = params.fontSize ?? 'small';
    const { fontSize: fontSizePx, outlineWidth: outlineWidthPx } = calcFontMetrics(
      fontSizeKey,
      params.width
    );

    // 縦位置の計算
    const verticalPosition = this.calculateVerticalPosition(params.width, params.height);

    // スタイルの合成
    const mergedStyle = this.mergeStyles(params.style, fontSizePx, outlineWidthPx);

    console.log(
      `[ClipSubtitleComposeClient] Font size: ${fontSizeKey} (${fontSizePx}px), vertical position: ${verticalPosition}`
    );

    try {
      // drawtext フィルタチェーンを構築
      const drawtextFilter = this.buildDrawtextFilter(
        params.segments,
        params.width,
        params.height,
        verticalPosition,
        mergedStyle
      );

      console.log(
        `[ClipSubtitleComposeClient] Composing ${params.segments.length} subtitles using drawtext direct rendering...`
      );

      // FFmpeg実行
      const durationSeconds = await this.executeFFmpeg(
        params.inputVideoPath,
        params.outputPath,
        drawtextFilter
      );

      console.log(
        `[ClipSubtitleComposeClient] Composition complete. Duration: ${durationSeconds}s`
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
   * Build drawtext filter chain for all segments
   */
  private buildDrawtextFilter(
    segments: ClipSubtitleSegment[],
    _width: number,
    height: number,
    verticalPosition: number,
    style: Required<SubtitleStyle>
  ): string {
    const fontColor = this.hexToFFmpegColor(style.fontColor);
    const outlineColor = this.hexToFFmpegColor(style.outlineColor);
    const shadowColor = this.hexToFFmpegColor(style.shadowColor);

    // Resolve font name (handle bold variants)
    const fontName = this.resolveFontName(style.fontFamily, style.bold);

    // Line height for multi-line text
    const lineHeightMultiplier = 1.5;
    const lineHeight = style.fontSize * lineHeightMultiplier;

    const filters: string[] = [];

    for (const segment of segments) {
      const lines = segment.lines;
      const totalTextHeight = lines.length * lineHeight;
      const baseY = height * verticalPosition - totalTextHeight / 2;

      // Create drawtext filter for each line
      for (const [lineIndex, line] of lines.entries()) {
        const escapedText = this.escapeDrawtext(line);
        const yPosition = Math.round(baseY + lineIndex * lineHeight);

        // Build drawtext filter with enable expression
        const filter = [
          `drawtext=text='${escapedText}'`,
          `enable='between(t,${segment.startTimeSeconds},${segment.endTimeSeconds})'`,
          `font='${fontName}'`,
          `fontsize=${style.fontSize}`,
          `fontcolor=${fontColor}`,
          `bordercolor=${outlineColor}`,
          `borderw=${style.outlineWidth}`,
          `shadowcolor=${shadowColor}`,
          `shadowx=${style.shadowOffsetX}`,
          `shadowy=${style.shadowOffsetY}`,
          'x=(w-text_w)/2',
          `y=${yPosition}`,
        ].join(':');

        filters.push(filter);
      }
    }

    return filters.join(',');
  }

  /**
   * Execute FFmpeg with drawtext filter
   */
  private executeFFmpeg(
    inputPath: string,
    outputPath: string,
    drawtextFilter: string
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = ['-y', '-i', inputPath, '-vf', drawtextFilter, '-c:a', 'copy', outputPath];

      console.log('[ClipSubtitleComposeClient] FFmpeg args:', args.join(' '));

      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          // Parse duration from stderr
          const durationMatch = stderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
          let durationSeconds = 0;
          if (durationMatch) {
            const hours = Number.parseFloat(durationMatch[1] || '0');
            const minutes = Number.parseFloat(durationMatch[2] || '0');
            const seconds = Number.parseFloat(durationMatch[3] || '0');
            durationSeconds = hours * 3600 + minutes * 60 + seconds;
          }
          resolve(durationSeconds);
        } else {
          reject({
            type: 'FFMPEG_ERROR',
            message: `FFmpeg exited with code ${code}`,
            stderr,
          });
        }
      });

      ffmpeg.on('error', (error) => {
        reject({
          type: 'FFMPEG_ERROR',
          message: `Failed to spawn FFmpeg: ${error.message}`,
          stderr,
        });
      });
    });
  }

  /**
   * Escape text for FFmpeg drawtext filter
   */
  private escapeDrawtext(text: string): string {
    return text
      .replace(/\\/g, '\\\\\\\\')
      .replace(/'/g, "'\\''")
      .replace(/:/g, '\\:')
      .replace(/%/g, '\\%');
  }

  /**
   * Convert hex color (#RRGGBB) to FFmpeg format
   */
  private hexToFFmpegColor(hex: string): string {
    const cleanHex = hex.replace('#', '');
    return `0x${cleanHex}`;
  }

  /**
   * Resolve font name with bold variant
   */
  private resolveFontName(fontFamily: string, bold: boolean): string {
    if (!bold) {
      return fontFamily;
    }

    if (fontFamily.includes('Hiragino')) {
      return `${fontFamily} W6`;
    }
    if (fontFamily.includes('Noto Sans CJK')) {
      return `${fontFamily} Black`;
    }

    return fontFamily;
  }

  /**
   * Merge provided styles with defaults
   */
  private mergeStyles(
    style: SubtitleStyle | undefined,
    fontSizePx: number,
    outlineWidthPx: number
  ): Required<SubtitleStyle> {
    return {
      fontFamily: style?.fontFamily ?? DEFAULT_STYLE.fontFamily,
      fontSize: fontSizePx,
      fontColor: style?.fontColor ?? DEFAULT_STYLE.fontColor,
      outlineColor: style?.outlineColor ?? DEFAULT_STYLE.outlineColor,
      outlineWidth: outlineWidthPx,
      shadowColor: style?.shadowColor ?? DEFAULT_STYLE.shadowColor,
      shadowOffsetX: style?.shadowOffsetX ?? DEFAULT_STYLE.shadowOffsetX,
      shadowOffsetY: style?.shadowOffsetY ?? DEFAULT_STYLE.shadowOffsetY,
      alignment: style?.alignment ?? DEFAULT_STYLE.alignment,
      bold: style?.bold ?? DEFAULT_STYLE.bold,
    };
  }

  /**
   * Calculate vertical position for subtitle placement
   */
  private calculateVerticalPosition(width: number, height: number): number {
    const aspectRatio = width / height;
    const isVertical = aspectRatio <= 0.7;

    if (isVertical) {
      const squareBottomRatio = (height + width) / (2 * height);
      return squareBottomRatio - 0.03;
    }

    return 0.8;
  }
}
