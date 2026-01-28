// ============================================================================
// Shorts Generation Project Types
// ============================================================================

/**
 * Shorts project status
 */
export type ShortsProjectStatus =
  | 'created'
  | 'planning_in_progress'
  | 'planning_completed'
  | 'script_in_progress'
  | 'script_completed'
  | 'assets_generating'
  | 'assets_completed'
  | 'composing'
  | 'completed'
  | 'failed';

/**
 * Shorts project summary (for list view)
 */
export interface ShortsProjectSummary {
  id: string;
  title: string;
  aspectRatio: string;
  resolutionWidth: number;
  resolutionHeight: number;
  status: ShortsProjectStatus;
  createdAt: string;
  updatedAt: string;
}

/**
 * Full shorts project with relations
 */
export interface ShortsProject {
  id: string;
  title: string;
  aspectRatio: string;
  resolutionWidth: number;
  resolutionHeight: number;
  status: ShortsProjectStatus;
  planning?: ShortsPlanning | null;
  script?: ShortsScript | null;
  composedVideo?: ShortsComposedVideo | null;
  publishText?: ShortsPublishText | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shorts planning (企画書)
 */
export interface ShortsPlanning {
  id: string;
  projectId: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Visual type for a scene
 */
export type VisualType = 'image_gen' | 'stock_video' | 'solid_color';

/**
 * Scene within a script
 */
export interface ShortsScene {
  id: string;
  scriptId: string;
  index: number;
  summary: string;
  visualType: VisualType;
  voiceText: string | null;
  subtitles: string[];
  silenceDurationMs: number | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Shorts script (台本)
 */
export interface ShortsScript {
  id: string;
  projectId: string;
  scenes: ShortsScene[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Scene asset type
 */
export type SceneAssetType = 'voice' | 'subtitle_image' | 'scene_image';

/**
 * Scene asset (生成アセット)
 */
export interface ShortsSceneAsset {
  id: string;
  sceneId: string;
  assetType: SceneAssetType;
  gcsUrl: string;
  durationMs: number | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Composed video (合成動画)
 */
export interface ShortsComposedVideo {
  id: string;
  projectId: string;
  gcsUrl: string;
  durationMs: number;
  createdAt: string;
}

/**
 * Publish text (公開テキスト)
 */
export interface ShortsPublishText {
  id: string;
  projectId: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}
