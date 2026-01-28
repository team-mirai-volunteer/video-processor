'use server';

import type {
  GenerateVoiceResponse,
  SceneAsset,
} from '@/components/features/shorts-gen/asset-generation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

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

  const data = await response.json();
  return { asset: data.asset as SceneAsset };
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

  return response.json();
}
