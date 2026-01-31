import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Result } from '@shared/domain/types/result.js';
import { err, ok } from '@shared/domain/types/result.js';
import type {
  SubtitleBatchGenerateParams,
  SubtitleBatchGenerateResult,
  SubtitleGenerateParams,
  SubtitleGenerateResult,
  SubtitleGeneratorGateway,
  SubtitleGeneratorGatewayError,
  SubtitleStyle,
} from '../../domain/gateways/subtitle-generator.gateway.js';

/**
 * Default font family with fallbacks for different platforms
 * Noto Sans CJK JP (Linux), Hiragino Kaku Gothic Pro (macOS), or DejaVu Sans (fallback)
 */
const DEFAULT_FONT_FAMILY = process.env.SUBTITLE_FONT_FAMILY || 'Hiragino Kaku Gothic Pro';

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
 * FFmpeg Subtitle Generator Client
 * Generates transparent background PNG images with subtitle text using FFmpeg drawtext filter
 */
export class FFmpegSubtitleGeneratorClient implements SubtitleGeneratorGateway {
  private fontListCache: string[] | null = null;

  /**
   * Generate a subtitle image from text
   */
  async generate(
    params: SubtitleGenerateParams
  ): Promise<Result<SubtitleGenerateResult, SubtitleGeneratorGatewayError>> {
    // Validate input
    const validationError = this.validateParams(params);
    if (validationError) {
      return err(validationError);
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'subtitle-'));
    const outputPath = path.join(tempDir, 'subtitle.png');

    try {
      const style = this.mergeStyles(params.style);
      const verticalPosition = params.verticalPosition ?? DEFAULT_VERTICAL_POSITION;
      const horizontalPadding = params.horizontalPadding ?? DEFAULT_HORIZONTAL_PADDING;

      const ffmpegCommand = this.buildFFmpegCommand(
        params.text,
        params.width,
        params.height,
        verticalPosition,
        horizontalPadding,
        style,
        outputPath
      );

      await this.executeFFmpeg(ffmpegCommand);

      const imageBuffer = await fs.promises.readFile(outputPath);

      return ok({
        imageBuffer,
        width: params.width,
        height: params.height,
        format: 'png',
      });
    } catch (error) {
      if (error instanceof Error && 'type' in error) {
        return err(error as SubtitleGeneratorGatewayError);
      }
      const stderr = error instanceof Error ? error.message : String(error);
      return err({
        type: 'FFMPEG_ERROR',
        message: 'Failed to generate subtitle image',
        stderr,
      });
    } finally {
      await this.cleanup(tempDir);
    }
  }

  /**
   * Generate multiple subtitle images in batch
   */
  async generateBatch(
    params: SubtitleBatchGenerateParams
  ): Promise<Result<SubtitleBatchGenerateResult, SubtitleGeneratorGatewayError>> {
    // Validate texts
    for (const text of params.texts) {
      if (!text || text.trim().length === 0) {
        return err({
          type: 'INVALID_TEXT',
          message: 'Text cannot be empty',
        });
      }
    }

    // Validate dimensions
    if (params.width <= 0 || params.height <= 0) {
      return err({
        type: 'INVALID_DIMENSIONS',
        message: `Invalid dimensions: ${params.width}x${params.height}`,
      });
    }

    const images: SubtitleGenerateResult[] = [];

    for (const text of params.texts) {
      const result = await this.generate({
        text,
        width: params.width,
        height: params.height,
        verticalPosition: params.verticalPosition,
        horizontalPadding: params.horizontalPadding,
        style: params.style,
      });

      if (!result.success) {
        return result;
      }

      images.push(result.value);
    }

    return ok({ images });
  }

  /**
   * List available fonts on the system
   */
  async listAvailableFonts(): Promise<string[]> {
    if (this.fontListCache) {
      return this.fontListCache;
    }

    try {
      // Use fc-list to get available fonts (Linux/Mac)
      const output = execSync('fc-list -f "%{family}\\n"', { encoding: 'utf-8' });
      const fonts = [
        ...new Set(
          output
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line.length > 0)
        ),
      ].sort();

      this.fontListCache = fonts;
      return fonts;
    } catch {
      // If fc-list is not available, return common fonts
      return [
        'Arial',
        'Helvetica',
        'Times New Roman',
        'Noto Sans',
        'Noto Sans CJK JP',
        'DejaVu Sans',
      ];
    }
  }

  /**
   * Get default style settings
   */
  getDefaultStyle(): SubtitleStyle {
    return { ...DEFAULT_STYLE };
  }

  /**
   * Clear the font list cache (mainly for testing)
   */
  clearFontCache(): void {
    this.fontListCache = null;
  }

  /**
   * Validate generation parameters
   */
  private validateParams(params: SubtitleGenerateParams): SubtitleGeneratorGatewayError | null {
    if (!params.text || params.text.trim().length === 0) {
      return {
        type: 'INVALID_TEXT',
        message: 'Text cannot be empty',
      };
    }

    if (params.width <= 0 || params.height <= 0) {
      return {
        type: 'INVALID_DIMENSIONS',
        message: `Invalid dimensions: ${params.width}x${params.height}`,
      };
    }

    return null;
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
   * Build FFmpeg command arguments for subtitle generation
   */
  private buildFFmpegCommand(
    text: string,
    width: number,
    height: number,
    verticalPosition: number,
    horizontalPadding: number,
    style: Required<SubtitleStyle>,
    outputPath: string
  ): string[] {
    // Escape text for FFmpeg drawtext filter
    const escapedText = this.escapeText(text);

    // Convert hex color to FFmpeg format (remove # and add alpha)
    const fontColor = this.hexToFFmpegColor(style.fontColor);
    const outlineColor = this.hexToFFmpegColor(style.outlineColor);
    const shadowColor = this.hexToFFmpegColor(style.shadowColor);

    // Calculate X position based on alignment
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

    // Calculate Y position (verticalPosition is 0-1, where 0 is top)
    const yPosition = `h*${verticalPosition}-text_h/2`;

    // Build drawtext filter
    // Note: Using font instead of fontfile for system fonts
    // For bold text, we append W6 (weight 6) to Hiragino fonts, or use the font as-is for others
    const fontName =
      style.bold && style.fontFamily.includes('Hiragino')
        ? `${style.fontFamily} W6`
        : style.fontFamily;

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
    ].join(':');

    return [
      '-f',
      'lavfi',
      '-i',
      `color=c=black@0.0:s=${width}x${height},format=rgba`,
      '-vf',
      drawtextFilter,
      '-frames:v',
      '1',
      '-y',
      outputPath,
    ];
  }

  /**
   * Escape text for FFmpeg drawtext filter
   */
  private escapeText(text: string): string {
    // Escape special characters for FFmpeg drawtext filter
    return text
      .replace(/\\/g, '\\\\\\\\') // Escape backslash
      .replace(/'/g, "\\'") // Escape single quote
      .replace(/:/g, '\\:') // Escape colon
      .replace(/%/g, '\\%'); // Escape percent
  }

  /**
   * Convert hex color (#RRGGBB) to FFmpeg format (0xRRGGBB or RRGGBB@alpha)
   */
  private hexToFFmpegColor(hex: string): string {
    // Remove # if present and convert to FFmpeg format
    const cleanHex = hex.replace('#', '');
    return `0x${cleanHex}`;
  }

  /**
   * Execute FFmpeg with given arguments
   */
  private executeFFmpeg(args: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpeg = spawn('ffmpeg', args);

      let stderr = '';

      ffmpeg.stderr.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      ffmpeg.on('close', (code) => {
        if (code === 0) {
          resolve();
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
   * Cleanup temporary directory
   */
  private async cleanup(tempDir: string): Promise<void> {
    try {
      const files = await fs.promises.readdir(tempDir);
      await Promise.all(files.map((file) => fs.promises.unlink(path.join(tempDir, file))));
      await fs.promises.rmdir(tempDir);
    } catch {
      // Ignore cleanup errors
    }
  }
}
