import type { Result } from '@shared/domain/types/result.js';

/**
 * シーン素材の種類
 */
export type SceneVisualType = 'image' | 'video' | 'solid_color';

/**
 * Ken Burns効果の種類
 */
export type KenBurnsEffectType =
  | 'zoom_in'
  | 'zoom_out'
  | 'pan_left'
  | 'pan_right'
  | 'pan_up'
  | 'pan_down';

/**
 * Ken Burns効果の設定
 */
export interface KenBurnsEffect {
  /** エフェクトの種類 */
  type: KenBurnsEffectType;
  /** ズーム倍率（1.0〜2.0、デフォルト: 1.3） */
  zoomScale?: number;
  /** パン移動量（出力サイズに対する割合、0.0〜0.5、デフォルト: 0.2） */
  panAmount?: number;
}

/**
 * シーン素材情報
 */
export interface SceneVisual {
  /** 素材の種類 */
  type: SceneVisualType;
  /** 画像/動画ファイルのパス（type === 'image' or 'video'の場合） */
  filePath?: string;
  /** 塗りつぶし色（type === 'solid_color'の場合、#RRGGBB形式） */
  color?: string;
  /** Ken Burns効果設定（type === 'image'の場合のみ有効） */
  kenBurns?: KenBurnsEffect;
}

/**
 * 字幕オーバーレイ情報
 */
export interface SubtitleOverlay {
  /** 字幕画像ファイルのパス（透明背景PNG） */
  imagePath: string;
  /** 表示開始時間（ミリ秒） */
  startMs: number;
  /** 表示終了時間（ミリ秒） */
  endMs: number;
}

/**
 * シーン構成情報
 */
export interface ComposeSceneInput {
  /** シーンID */
  sceneId: string;
  /** シーンの順序 */
  order: number;
  /** シーンの長さ（ミリ秒） */
  durationMs: number;
  /** 背景映像素材 */
  visual: SceneVisual;
  /** 音声ファイルのパス（nullable） */
  audioPath: string | null;
  /** 字幕オーバーレイ一覧 */
  subtitles: SubtitleOverlay[];
}

/**
 * 動画合成リクエストパラメータ
 */
export interface VideoComposeParams {
  /** 出力ファイルパス */
  outputPath: string;
  /** シーン一覧（順序でソート済み） */
  scenes: ComposeSceneInput[];
  /** 出力動画の幅（ピクセル） */
  width: number;
  /** 出力動画の高さ（ピクセル） */
  height: number;
  /** フレームレート */
  frameRate?: number;
  /** BGMファイルのパス（nullable） */
  bgmPath?: string | null;
  /** BGMの音量（0-1、デフォルト: 0.3） */
  bgmVolume?: number;
  /** 音声の音量（0-1、デフォルト: 1.0） */
  voiceVolume?: number;
}

/**
 * 動画合成結果
 */
export interface VideoComposeResult {
  /** 出力ファイルパス */
  outputPath: string;
  /** 動画の長さ（秒） */
  durationSeconds: number;
  /** ファイルサイズ（バイト） */
  fileSizeBytes: number;
}

/**
 * 動画合成 Gateway エラー
 */
export type VideoComposeGatewayError =
  | { type: 'INVALID_SCENES'; message: string }
  | { type: 'INVALID_DIMENSIONS'; message: string }
  | { type: 'FILE_NOT_FOUND'; path: string }
  | { type: 'FFMPEG_ERROR'; message: string; stderr?: string }
  | { type: 'OUTPUT_WRITE_ERROR'; path: string; message: string }
  | { type: 'COMPOSE_FAILED'; message: string };

/**
 * Video Compose Gateway
 * FFmpegを使用した動画合成を行うインターフェース
 */
export interface VideoComposeGateway {
  /**
   * シーンを合成して動画を生成する
   * @param params 合成パラメータ
   * @returns 合成結果またはエラー
   */
  compose(
    params: VideoComposeParams
  ): Promise<Result<VideoComposeResult, VideoComposeGatewayError>>;

  /**
   * FFmpegが利用可能か確認する
   * @returns 利用可能ならtrue
   */
  isAvailable(): Promise<boolean>;

  /**
   * サポートされているビデオコーデック一覧を取得する
   * @returns コーデック名の配列
   */
  getSupportedCodecs(): Promise<string[]>;
}
