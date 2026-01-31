// Re-export shared types from lib (used by both server and components)
export type {
  AssetType,
  SceneAsset,
  GenerateVoiceResponse,
  GenerateSubtitleResponse,
  GenerateImageResponse,
  GenerateImagePromptResponse,
} from '@/lib/types/asset-generation';

// Import shared types for use in local interfaces
import type { SceneAsset } from '@/lib/types/asset-generation';

/**
 * Visual type for a scene
 */
export type VisualType = 'image_gen' | 'stock_video' | 'solid_color';

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
 * State for a single scene's asset generation
 */
export interface SceneAssetState {
  sceneId: string;
  status: AssetGenerationStatus;
  asset?: SceneAsset;
  /** 字幕など複数アセットを持つ場合に使用 */
  assets?: SceneAsset[];
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
 * Subtitle generation request
 */
export interface GenerateSubtitleRequest {
  projectId: string;
  sceneId: string;
}

/**
 * Image generation request (includes prompt generation)
 */
export interface GenerateImageRequest {
  projectId: string;
  sceneId: string;
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

/**
 * State for a single scene's image prompt generation
 */
export interface ImagePromptState {
  sceneId: string;
  status: AssetGenerationStatus;
  imagePrompt?: string;
  error?: string;
}
