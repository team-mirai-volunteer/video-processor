'use server';

import type {
  GenerateSubtitleResponse,
  SceneAsset,
} from '@/components/features/shorts-gen/asset-generation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function generateSubtitle(
  projectId: string,
  sceneId: string
): Promise<GenerateSubtitleResponse> {
  const response = await fetch(
    `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/scenes/${sceneId}/subtitles`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`字幕生成に失敗しました: ${errorText}`);
  }

  const data = await response.json();
  return { assets: data.assets as SceneAsset[] };
}

export async function generateAllSubtitles(projectId: string): Promise<{
  success: boolean;
  results: { sceneId: string; success: boolean; assets?: SceneAsset[]; error?: string }[];
}> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/projects/${projectId}/subtitles`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`字幕生成に失敗しました: ${errorText}`);
  }

  return response.json();
}
