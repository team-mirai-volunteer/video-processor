'use server';

import type { GenerateVoiceResponse, SceneAsset } from '@/lib/types/asset-generation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

/**
 * Backend response for voice synthesis
 */
interface SynthesizeVoiceBackendResponse {
  scriptId: string;
  totalScenes: number;
  scenesWithVoice: number;
  successCount: number;
  skippedCount: number;
  failedCount: number;
  results: {
    sceneId: string;
    sceneOrder: number;
    assetId: string;
    fileUrl: string;
    durationMs: number;
    skipped: boolean;
    skipReason?: string;
  }[];
  errors: {
    sceneId: string;
    sceneOrder: number;
    errorType: string;
    message: string;
  }[];
}

export async function generateVoice(
  projectId: string,
  sceneId: string
): Promise<GenerateVoiceResponse> {
  const response = await fetch(
    `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/scenes/${sceneId}/voice`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`音声生成に失敗しました: ${errorText}`);
  }

  const data: SynthesizeVoiceBackendResponse = await response.json();

  // Check for errors
  const firstError = data.errors[0];
  if (firstError) {
    throw new Error(`音声生成に失敗しました: ${firstError.message}`);
  }

  // Find the result for this scene
  const result = data.results.find((r) => r.sceneId === sceneId);
  if (!result) {
    throw new Error(`シーン ${sceneId} の音声生成結果が見つかりません`);
  }

  // If skipped (no voice text), return a placeholder asset
  if (result.skipped) {
    return {
      asset: {
        id: '',
        sceneId: result.sceneId,
        assetType: 'voice',
        fileUrl: '',
        durationMs: result.durationMs,
      },
    };
  }

  // Map backend result to frontend SceneAsset
  const asset: SceneAsset = {
    id: result.assetId,
    sceneId: result.sceneId,
    assetType: 'voice',
    fileUrl: result.fileUrl,
    durationMs: result.durationMs,
  };

  return { asset };
}

export async function generateAllVoices(projectId: string): Promise<{
  success: boolean;
  results: { sceneId: string; success: boolean; asset?: SceneAsset; error?: string }[];
}> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/projects/${projectId}/voices`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`音声生成に失敗しました: ${errorText}`);
  }

  const data: SynthesizeVoiceBackendResponse = await response.json();

  // Transform backend response to frontend format
  const results: { sceneId: string; success: boolean; asset?: SceneAsset; error?: string }[] =
    data.results.map((result) => {
      if (result.skipped) {
        return {
          sceneId: result.sceneId,
          success: true,
          asset: {
            id: '',
            sceneId: result.sceneId,
            assetType: 'voice' as const,
            fileUrl: '',
            durationMs: result.durationMs,
          },
        };
      }
      return {
        sceneId: result.sceneId,
        success: true,
        asset: {
          id: result.assetId,
          sceneId: result.sceneId,
          assetType: 'voice' as const,
          fileUrl: result.fileUrl,
          durationMs: result.durationMs,
        },
      };
    });

  // Add failed scenes from errors array
  for (const error of data.errors) {
    results.push({
      sceneId: error.sceneId,
      success: false,
      error: error.message,
    });
  }

  return {
    success: data.failedCount === 0,
    results,
  };
}
