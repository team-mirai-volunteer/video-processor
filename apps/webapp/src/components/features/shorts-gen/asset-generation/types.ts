/**
 * Visual type for a scene
 */
export type VisualType = 'image_gen' | 'stock_video' | 'solid_color';

/**
 * Asset type for a scene
 */
export type AssetType = 'voice' | 'subtitle_image' | 'background_image';

/**
 * Asset generation status
 */
export type AssetGenerationStatus = 'pending' | 'running' | 'completed' | 'error';

/**
 * Scene for display in asset generation UI
 */
export interface Scene {
  id: string;
  order: number;
  summary: string;
  visualType: VisualType;
  voiceText: string | null;
  subtitles: string[];
  silenceDurationMs: number | null;
  imagePrompt: string | null;
}

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
 * State for a single scene's asset generation
 */
export interface SceneAssetState {
  sceneId: string;
  status: AssetGenerationStatus;
  asset?: SceneAsset;
  error?: string;
}

/**
 * Column data for parallel progress display
 */
export interface AssetColumnData {
  id: 'voice' | 'subtitle' | 'image';
  title: string;
  scenes: SceneAssetState[];
  isGenerating: boolean;
  canGenerate: boolean;
}

/**
 * Props for individual scene asset item display
 */
export interface SceneAssetItemProps {
  scene: Scene;
  state: SceneAssetState;
  onRetry?: () => void;
  onPreview?: () => void;
}

/**
 * Voice generation request
 */
export interface GenerateVoiceRequest {
  projectId: string;
  sceneId: string;
}

/**
 * Voice generation response
 */
export interface GenerateVoiceResponse {
  asset: SceneAsset;
}

/**
 * Subtitle generation request
 */
export interface GenerateSubtitleRequest {
  projectId: string;
  sceneId: string;
}

/**
 * Subtitle generation response
 */
export interface GenerateSubtitleResponse {
  assets: SceneAsset[];
}

/**
 * Image generation request (includes prompt generation)
 */
export interface GenerateImageRequest {
  projectId: string;
  sceneId: string;
}

/**
 * Image generation response
 */
export interface GenerateImageResponse {
  asset: SceneAsset;
  generatedPrompt?: string;
}

/**
 * Batch asset generation request
 */
export interface GenerateAllAssetsRequest {
  projectId: string;
  type: 'voice' | 'subtitle' | 'image';
}

/**
 * Batch asset generation response
 */
export interface GenerateAllAssetsResponse {
  success: boolean;
  results: {
    sceneId: string;
    success: boolean;
    asset?: SceneAsset;
    assets?: SceneAsset[];
    error?: string;
  }[];
}
