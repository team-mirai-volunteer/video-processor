/**
 * 素材管理レジストリ - ストック動画、BGM、声の定義
 */

interface VideoAssetDefinition {
  /** assetsディレクトリからの相対パス */
  path: string;
  /** 素材の説明 */
  description: string;
  /** 動画の長さ（ミリ秒） */
  durationMs: number;
}

interface BgmAssetDefinition {
  /** assetsディレクトリからの相対パス */
  path: string;
  /** BGMの説明 */
  description: string;
}

interface VoiceAssetDefinition {
  /** 音声モデルIDを格納する環境変数名 */
  envKey: string;
  /** 表示名 */
  name: string;
  /** 説明文 */
  description: string;
}

interface AssetRegistry {
  videos: Record<string, VideoAssetDefinition>;
  bgm: Record<string, BgmAssetDefinition>;
  voices: Record<string, VoiceAssetDefinition>;
}

export const assetRegistry: AssetRegistry = {
  videos: {
    speech_exciting: {
      path: 'videos/speech-exciting.mov',
      description: '党首演説（エキサイティング）',
      durationMs: 10000,
    },
    speech_serious: {
      path: 'videos/speech-serius.mov',
      description: '党首演説（真剣）',
      durationMs: 10000,
    },
    speech_smiley: {
      path: 'videos/speech-smiley.mov',
      description: '党首演説（笑顔）',
      durationMs: 10000,
    },
    family_financial_struggle: {
      path: 'videos/family-financial-struggle.mov',
      description: '家族の経済的苦労',
      durationMs: 10000,
    },
    family_relief: {
      path: 'videos/family-relief.mov',
      description: '家族の安心',
      durationMs: 10000,
    },
  },
  bgm: {},
  voices: {
    default: {
      envKey: 'FISH_AUDIO_VOICE_DEFAULT',
      name: 'デフォルト',
      description: '標準的な声',
    },
  },
};
