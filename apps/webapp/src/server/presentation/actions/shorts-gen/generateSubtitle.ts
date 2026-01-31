'use server';

import type { GenerateSubtitleResponse, SceneAsset } from '@/lib/types/asset-generation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function generateSubtitle(
  _scriptId: string,
  sceneId: string
): Promise<GenerateSubtitleResponse> {
  // 個別シーンの字幕生成は sceneId ベースのエンドポイントを使用
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/scenes/${sceneId}/subtitles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`字幕生成に失敗しました: ${errorText}`);
  }

  const data = await response.json();
  // バックエンドは sceneResults 配列を返す
  const sceneResult = data.sceneResults?.[0];
  return { assets: (sceneResult?.assets ?? []) as SceneAsset[] };
}

export async function generateAllSubtitles(scriptId: string): Promise<{
  success: boolean;
  results: { sceneId: string; success: boolean; assets?: SceneAsset[]; error?: string }[];
}> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/scripts/${scriptId}/subtitles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`字幕生成に失敗しました: ${errorText}`);
  }

  const data = await response.json();
  // バックエンドのレスポンス形式に合わせて変換
  return {
    success: true,
    results: data.sceneResults.map(
      (r: { sceneId: string; success: boolean; assets?: SceneAsset[]; error?: string }) => ({
        sceneId: r.sceneId,
        success: r.success,
        assets: r.assets,
        error: r.error,
      })
    ),
  };
}
