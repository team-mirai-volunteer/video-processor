import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import type {
  ClipSubtitleComposeError,
  ClipSubtitleComposeParams,
  ClipSubtitleComposeResult,
  ClipSubtitleComposerGateway,
  FormatConversionParams,
  SubtitleStyle,
  VideoDimensions,
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
   * Get video dimensions using ffprobe
   */
  getVideoDimensions(videoPath: string): Promise<VideoDimensions> {
    return new Promise((resolve, reject) => {
      const args = [
        '-v',
        'error',
        '-select_streams',
        'v:0',
        '-show_entries',
        'stream=width,height',
        '-of',
        'json',
        videoPath,
      ];

      const ffprobeProcess = spawn('ffprobe', args);
      let stdout = '';
      let stderr = '';

      ffprobeProcess.stdout.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      ffprobeProcess.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffprobeProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`ffprobe failed: ${stderr}`));
          return;
        }

        try {
          const result = JSON.parse(stdout);
          const stream = result.streams?.[0];
          if (!stream?.width || !stream?.height) {
            reject(new Error('Could not determine video dimensions'));
            return;
          }
          resolve({ width: stream.width, height: stream.height });
        } catch {
          reject(new Error(`Failed to parse ffprobe output: ${stdout}`));
        }
      });

      ffprobeProcess.on('error', (error) => {
        reject(new Error(`Failed to spawn ffprobe: ${error.message}`));
      });
    });
  }

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

    // フォーマット変換がある場合は出力サイズ基準でフォント計算
    const outputWidth = params.formatConversion?.targetWidth ?? params.width;
    const outputHeight = params.formatConversion?.targetHeight ?? params.height;

    // フォントサイズの決定（出力動画横幅ベース）
    const fontSizeKey = params.fontSize ?? 'small';
    const { fontSize: fontSizePx, outlineWidth: outlineWidthPx } = calcFontMetrics(
      fontSizeKey,
      outputWidth
    );

    // 縦位置の計算（出力サイズ基準）
    const verticalPosition = this.calculateVerticalPosition(outputWidth, outputHeight);

    // スタイルの合成
    const mergedStyle = this.mergeStyles(params.style, fontSizePx, outlineWidthPx);

    console.log(
      `[ClipSubtitleComposeClient] Font size: ${fontSizeKey} (${fontSizePx}px), vertical position: ${verticalPosition}, format conversion: ${params.formatConversion ? 'yes' : 'no'}`
    );

    try {
      // drawtext フィルタチェーンを構築（出力サイズ基準）
      const drawtextFilter = this.buildDrawtextFilter(
        params.segments,
        outputWidth,
        outputHeight,
        verticalPosition,
        mergedStyle
      );

      // フォーマット変換がある場合はscale+padを先頭に追加して1パスで実行
      const videoFilter = params.formatConversion
        ? `${this.buildFormatConversionFilter(params.width, params.height, params.formatConversion)},${drawtextFilter}`
        : drawtextFilter;

      console.log(
        `[ClipSubtitleComposeClient] Composing ${params.segments.length} subtitles${params.formatConversion ? ' with format conversion' : ''} in single pass...`
      );

      // FFmpeg実行
      const durationSeconds = await this.executeFFmpeg(
        params.inputVideoPath,
        params.outputPath,
        videoFilter,
        params.onProgress
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
   * Build scale+pad filter for format conversion
   */
  private buildFormatConversionFilter(
    sourceWidth: number,
    sourceHeight: number,
    conversion: FormatConversionParams
  ): string {
    const { targetWidth, targetHeight, paddingColor } = conversion;
    const sourceAspectRatio = sourceWidth / sourceHeight;
    const targetAspectRatio = targetWidth / targetHeight;

    const scaleFilter =
      sourceAspectRatio > targetAspectRatio
        ? `scale=${targetWidth}:-2`
        : `scale=-2:${targetHeight}`;
    const padFilter = `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=${paddingColor}`;
    return `${scaleFilter},${padFilter}`;
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
   * Parse timemark string (HH:MM:SS.ss) to seconds
   */
  private parseTimemark(timemark: string): number {
    const match = timemark.match(/(\d+):(\d+):(\d+(?:\.\d+)?)/);
    if (!match) return 0;
    const hours = Number.parseFloat(match[1] || '0');
    const minutes = Number.parseFloat(match[2] || '0');
    const seconds = Number.parseFloat(match[3] || '0');
    return hours * 3600 + minutes * 60 + seconds;
  }

  /**
   * Execute FFmpeg with drawtext filter
   */
  private executeFFmpeg(
    inputPath: string,
    outputPath: string,
    videoFilter: string,
    onProgress?: (percent: number) => void
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      const args = [
        '-y',
        '-i',
        inputPath,
        '-vf',
        videoFilter,
        '-preset',
        'fast',
        '-c:a',
        'copy',
        outputPath,
      ];

      console.log('[ClipSubtitleComposeClient] FFmpeg args:', args.join(' '));

      const ffmpegProcess = spawn('ffmpeg', args);

      let stderr = '';
      let totalDuration = 0;
      let lastReportedPercent = -1;

      ffmpegProcess.stderr.on('data', (data: Buffer) => {
        const chunk = data.toString();
        stderr += chunk;

        // Parse total duration from initial output (e.g., "Duration: 00:01:30.50")
        if (totalDuration === 0) {
          const durationMatch = stderr.match(/Duration: (\d+:\d+:\d+\.\d+)/);
          if (durationMatch?.[1]) {
            totalDuration = this.parseTimemark(durationMatch[1]);
          }
        }

        // Parse current progress from FFmpeg output (e.g., "time=00:00:15.00")
        if (onProgress && totalDuration > 0) {
          const timeMatch = chunk.match(/time=(\d+:\d+:\d+\.\d+)/);
          if (timeMatch?.[1]) {
            const currentTime = this.parseTimemark(timeMatch[1]);
            const percent = Math.min(Math.round((currentTime / totalDuration) * 100), 100);
            if (percent !== lastReportedPercent) {
              lastReportedPercent = percent;
              onProgress(percent);
            }
          }
        }
      });

      ffmpegProcess.on('close', (code) => {
        if (code === 0) {
          onProgress?.(100);
          resolve(totalDuration);
        } else {
          reject({
            type: 'FFMPEG_ERROR',
            message: `FFmpeg exited with code ${code}`,
            stderr,
          });
        }
      });

      ffmpegProcess.on('error', (error) => {
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
