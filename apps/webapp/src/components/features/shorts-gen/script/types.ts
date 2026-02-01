/**
 * Visual type for a scene
 * - image_gen: AI-generated image
 * - stock_video: Pre-existing video asset
 * - solid_color: Solid color background
 */
export type VisualType = 'image_gen' | 'stock_video' | 'solid_color';

/**
 * Scene data structure
 */
export interface Scene {
  id: string;
  scriptId: string;
  order: number;
  summary: string;
  visualType: VisualType;
  voiceText: string | null;
  subtitles: string[];
  silenceDurationMs: number | null;
  stockVideoKey: string | null;
  solidColor: string | null;
  imagePrompt: string | null;
  imageStyleHint: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Script data structure
 */
export interface Script {
  id: string;
  projectId: string;
  planningId: string;
  version: number;
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Scene creation parameters from AI tool use
 */
export interface CreateSceneParams {
  summary: string;
  visualType: VisualType;
  voiceText?: string | null;
  subtitles?: string[];
  silenceDurationMs?: number | null;
  stockVideoKey?: string | null;
  solidColor?: string | null;
  imageStyleHint?: string | null;
}

/**
 * Scene update parameters
 */
export interface UpdateSceneParams {
  summary?: string;
  visualType?: VisualType;
  voiceText?: string | null;
  subtitles?: string[];
  silenceDurationMs?: number | null;
  stockVideoKey?: string | null;
  solidColor?: string | null;
  imageStyleHint?: string | null;
}

/**
 * Visual type display information
 */
export const VISUAL_TYPE_LABELS: Record<VisualType, string> = {
  image_gen: '画像生成',
  stock_video: '動画素材',
  solid_color: '塗りつぶし',
};

/**
 * Visual type color classes
 */
export const VISUAL_TYPE_COLORS: Record<VisualType, string> = {
  image_gen: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  stock_video: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  solid_color: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
};
