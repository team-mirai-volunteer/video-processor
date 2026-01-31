import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type { Result } from '@shared/domain/types/result.js';
import { err, ok } from '@shared/domain/types/result.js';
import ffmpeg from 'fluent-ffmpeg';
import type {
  ComposeSceneInput,
  VideoComposeGateway,
  VideoComposeGatewayError,
  VideoComposeParams,
  VideoComposeResult,
} from '../../domain/gateways/video-compose.gateway.js';

/**
 * FFmpeg Compose Client
 * 複数シーンを結合し、字幕overlay、BGM合成を行う
 */
export class FFmpegComposeClient implements VideoComposeGateway {
  /**
   * FFmpegが利用可能か確認する
   */
  async isAvailable(): Promise<boolean> {
    try {
      execSync('ffmpeg -version', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * サポートされているビデオコーデック一覧を取得する
   */
  async getSupportedCodecs(): Promise<string[]> {
    return new Promise((resolve) => {
      ffmpeg.getAvailableCodecs((error, codecs) => {
        if (error || !codecs) {
          resolve([]);
          return;
        }
        const videoCodecs = Object.keys(codecs).filter((name) => {
          const codec = codecs[name];
          return codec && codec.type === 'video' && codec.canEncode;
        });
        resolve(videoCodecs);
      });
    });
  }

  /**
   * シーンを合成して動画を生成する
   */
  async compose(
    params: VideoComposeParams
  ): Promise<Result<VideoComposeResult, VideoComposeGatewayError>> {
    // バリデーション
    const validationError = this.validateParams(params);
    if (validationError) {
      return err(validationError);
    }

    // ファイル存在チェック
    const fileCheckError = await this.checkFilesExist(params);
    if (fileCheckError) {
      return err(fileCheckError);
    }

    const tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'ffmpeg-compose-'));

    try {
      // 各シーンの動画を生成
      const sceneVideoPaths: string[] = [];
      for (let i = 0; i < params.scenes.length; i++) {
        const scene = params.scenes[i];
        if (!scene) {
          continue;
        }
        const sceneVideoPath = path.join(tempDir, `scene_${i}.mp4`);
        await this.createSceneVideo(
          scene,
          sceneVideoPath,
          params.width,
          params.height,
          params.frameRate ?? 30
        );
        sceneVideoPaths.push(sceneVideoPath);
      }

      // 全シーンを結合
      const concatenatedPath = path.join(tempDir, 'concatenated.mp4');
      await this.concatenateVideos(sceneVideoPaths, concatenatedPath);

      // BGMを合成（指定がある場合）
      let finalVideoPath = concatenatedPath;
      if (params.bgmPath) {
        const withBgmPath = path.join(tempDir, 'with_bgm.mp4');
        await this.addBgm(
          concatenatedPath,
          params.bgmPath,
          withBgmPath,
          params.bgmVolume ?? 0.3,
          params.voiceVolume ?? 1.0
        );
        finalVideoPath = withBgmPath;
      }

      // 出力先にコピー
      await fs.promises.copyFile(finalVideoPath, params.outputPath);

      // メタデータを取得
      const stats = await fs.promises.stat(params.outputPath);
      const duration = await this.getVideoDuration(params.outputPath);

      return ok({
        outputPath: params.outputPath,
        durationSeconds: duration,
        fileSizeBytes: stats.size,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return err({
        type: 'COMPOSE_FAILED',
        message,
      });
    } finally {
      await this.cleanup(tempDir);
    }
  }

  /**
   * パラメータのバリデーション
   */
  private validateParams(params: VideoComposeParams): VideoComposeGatewayError | null {
    if (!params.scenes || params.scenes.length === 0) {
      return {
        type: 'INVALID_SCENES',
        message: 'At least one scene is required',
      };
    }

    if (params.width <= 0 || params.height <= 0) {
      return {
        type: 'INVALID_DIMENSIONS',
        message: `Invalid dimensions: ${params.width}x${params.height}`,
      };
    }

    for (const scene of params.scenes) {
      if (scene.durationMs <= 0) {
        return {
          type: 'INVALID_SCENES',
          message: `Scene ${scene.sceneId} has invalid duration: ${scene.durationMs}ms`,
        };
      }

      if (scene.visual.type === 'solid_color') {
        if (!scene.visual.color || !/^#[0-9A-Fa-f]{6}$/.test(scene.visual.color)) {
          return {
            type: 'INVALID_SCENES',
            message: `Scene ${scene.sceneId} has invalid solid_color: ${scene.visual.color}`,
          };
        }
      } else if (scene.visual.type === 'image' || scene.visual.type === 'video') {
        if (!scene.visual.filePath) {
          return {
            type: 'INVALID_SCENES',
            message: `Scene ${scene.sceneId} has no file path for ${scene.visual.type}`,
          };
        }
      }
    }

    return null;
  }

  /**
   * 入力ファイルの存在チェック
   */
  private async checkFilesExist(
    params: VideoComposeParams
  ): Promise<VideoComposeGatewayError | null> {
    for (const scene of params.scenes) {
      if (
        (scene.visual.type === 'image' || scene.visual.type === 'video') &&
        scene.visual.filePath
      ) {
        if (!fs.existsSync(scene.visual.filePath)) {
          return {
            type: 'FILE_NOT_FOUND',
            path: scene.visual.filePath,
          };
        }
      }

      if (scene.audioPath && !fs.existsSync(scene.audioPath)) {
        return {
          type: 'FILE_NOT_FOUND',
          path: scene.audioPath,
        };
      }

      for (const subtitle of scene.subtitles) {
        if (!fs.existsSync(subtitle.imagePath)) {
          return {
            type: 'FILE_NOT_FOUND',
            path: subtitle.imagePath,
          };
        }
      }
    }

    if (params.bgmPath && !fs.existsSync(params.bgmPath)) {
      return {
        type: 'FILE_NOT_FOUND',
        path: params.bgmPath,
      };
    }

    return null;
  }

  /**
   * 単一シーンの動画を生成
   */
  private async createSceneVideo(
    scene: ComposeSceneInput,
    outputPath: string,
    width: number,
    height: number,
    frameRate: number
  ): Promise<void> {
    const durationSec = scene.durationMs / 1000;

    // FFmpegコマンド引数を構築
    const args: string[] = ['-y'];

    // 背景入力の設定
    if (scene.visual.type === 'solid_color') {
      const color = scene.visual.color?.replace('#', '') ?? '000000';
      args.push(
        '-f',
        'lavfi',
        '-i',
        `color=c=0x${color}:s=${width}x${height}:d=${durationSec}:r=${frameRate}`
      );
    } else if (scene.visual.type === 'image' && scene.visual.filePath) {
      args.push('-loop', '1', '-t', String(durationSec), '-i', scene.visual.filePath);
    } else if (scene.visual.type === 'video' && scene.visual.filePath) {
      args.push('-stream_loop', '-1', '-t', String(durationSec), '-i', scene.visual.filePath);
    }

    // 字幕画像入力
    for (const subtitle of scene.subtitles) {
      args.push('-i', subtitle.imagePath);
    }

    // 音声入力（ある場合）または無音音声
    const audioPath = scene.audioPath;
    let audioInputIndex: number;
    if (audioPath) {
      args.push('-i', audioPath);
      audioInputIndex = 1 + scene.subtitles.length;
    } else {
      // 無音音声を追加
      args.push('-f', 'lavfi', '-i', `anullsrc=r=44100:cl=stereo:d=${durationSec}`);
      audioInputIndex = 1 + scene.subtitles.length;
    }

    // フィルターチェーン構築
    let filterComplex = '';

    // 背景のスケーリング（solid_colorの場合はすでに正しいサイズなのでスキップ可能だが統一のため適用）
    if (scene.visual.type === 'solid_color') {
      filterComplex = '[0:v]setsar=1[bg];';
    } else {
      filterComplex = `[0:v]scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${frameRate}[bg];`;
    }

    // 字幕オーバーレイ用のフィルター構築
    const subtitleFilterParts: string[] = [];
    for (let i = 0; i < scene.subtitles.length; i++) {
      const subtitle = scene.subtitles[i];
      if (!subtitle) {
        continue;
      }
      const startSec = subtitle.startMs / 1000;
      const endSec = subtitle.endMs / 1000;
      const inputIndex = i + 1; // 0 is background
      const prevLabel = i === 0 ? '[bg]' : `[v${i}]`;
      const nextLabel = i === scene.subtitles.length - 1 ? '[vout]' : `[v${i + 1}]`;
      subtitleFilterParts.push(
        `${prevLabel}[${inputIndex}:v]overlay=0:0:enable='between(t,${startSec},${endSec})'${nextLabel}`
      );
    }

    // 字幕オーバーレイ
    if (subtitleFilterParts.length > 0) {
      filterComplex += subtitleFilterParts.join(';');
    } else {
      filterComplex += '[bg]null[vout]';
    }

    args.push('-filter_complex', filterComplex);
    args.push(
      '-map',
      '[vout]',
      '-map',
      `${audioInputIndex}:a`,
      '-c:v',
      'libx264',
      '-preset',
      'fast',
      '-crf',
      '23',
      '-pix_fmt',
      'yuv420p',
      '-c:a',
      'aac',
      '-b:a',
      '128k',
      '-t',
      String(durationSec),
      outputPath
    );

    return new Promise((resolve, reject) => {
      const proc = spawn('ffmpeg', args);
      let stderr = '';
      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });
      proc.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(
            new Error(`Failed to create scene video: ffmpeg exited with code ${code}\n${stderr}`)
          );
        }
      });
      proc.on('error', (e) => {
        reject(new Error(`Failed to create scene video: ${e.message}`));
      });
    });
  }

  /**
   * 複数動画を結合
   */
  private async concatenateVideos(videoPaths: string[], outputPath: string): Promise<void> {
    if (videoPaths.length === 0) {
      throw new Error('No videos to concatenate');
    }

    if (videoPaths.length === 1 && videoPaths[0]) {
      await fs.promises.copyFile(videoPaths[0], outputPath);
      return;
    }

    // concat demuxer用のファイルリスト作成
    const listPath = path.join(path.dirname(outputPath), 'concat_list.txt');
    const listContent = videoPaths.map((p) => `file '${p}'`).join('\n');
    await fs.promises.writeFile(listPath, listContent);

    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(listPath)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .outputOptions(['-c', 'copy'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (e: Error) => reject(new Error(`Failed to concatenate videos: ${e.message}`)))
        .run();
    });
  }

  /**
   * BGMを合成
   */
  private async addBgm(
    videoPath: string,
    bgmPath: string,
    outputPath: string,
    bgmVolume: number,
    voiceVolume: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      ffmpeg()
        .input(videoPath)
        .input(bgmPath)
        .complexFilter([
          `[0:a]volume=${voiceVolume}[voice]`,
          `[1:a]volume=${bgmVolume}[bgm]`,
          '[voice][bgm]amix=inputs=2:duration=first:dropout_transition=2[aout]',
        ])
        .outputOptions([
          '-map',
          '0:v',
          '-map',
          '[aout]',
          '-c:v',
          'copy',
          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-shortest',
        ])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (e: Error) => reject(new Error(`Failed to add BGM: ${e.message}`)))
        .run();
    });
  }

  /**
   * 動画の長さを取得
   */
  private async getVideoDuration(videoPath: string): Promise<number> {
    return new Promise((resolve, reject) => {
      ffmpeg.ffprobe(videoPath, (error, metadata) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(metadata.format.duration ?? 0);
      });
    });
  }

  /**
   * 一時ディレクトリを削除
   */
  private async cleanup(tempDir: string): Promise<void> {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }
}
