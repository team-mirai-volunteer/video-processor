/**
 * Shared types for asset generation
 * Used by both server actions and components
 */

/**
 * Asset type for a scene
 */
export type AssetType = 'voice' | 'subtitle_image' | 'background_image';

/**
 * Generated asset for a scene
 */
export interface SceneAsset {
  id: string;
  sceneId: string;
  assetType: AssetType;
  fileUrl: string;
  durationMs: number | null;
}

/**
 * Voice generation response
 */
export interface GenerateVoiceResponse {
  asset: SceneAsset;
}

/**
 * Subtitle generation response
 */
export interface GenerateSubtitleResponse {
  assets: SceneAsset[];
}

/**
 * Image generation response
 */
export interface GenerateImageResponse {
  asset: SceneAsset;
  generatedPrompt?: string;
}

/**
 * Image prompt generation response
 */
export interface GenerateImagePromptResponse {
  sceneId: string;
  imagePrompt: string;
  styleHint: string | null;
}
