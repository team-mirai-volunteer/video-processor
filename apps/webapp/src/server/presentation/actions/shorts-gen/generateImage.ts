'use server';

import type {
  GenerateImagePromptResponse,
  GenerateImageResponse,
  SceneAsset,
} from '@/lib/types/asset-generation';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function generateImagePrompt(
  projectId: string,
  sceneId: string,
  styleHint?: string
): Promise<GenerateImagePromptResponse> {
  const response = await fetch(
    `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/scenes/${sceneId}/image-prompt`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ styleHint }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`プロンプト生成に失敗しました: ${errorText}`);
  }

  const data = await response.json();
  return {
    sceneId: data.sceneId,
    imagePrompt: data.imagePrompt,
    styleHint: data.styleHint ?? null,
  };
}

export async function generateImage(
  projectId: string,
  sceneId: string
): Promise<GenerateImageResponse> {
  const response = await fetch(
    `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/scenes/${sceneId}/image`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`画像生成に失敗しました: ${errorText}`);
  }

  const data = await response.json();
  return { asset: data.asset as SceneAsset, generatedPrompt: data.generatedPrompt };
}

export async function generateAllImages(projectId: string): Promise<{
  success: boolean;
  results: { sceneId: string; success: boolean; asset?: SceneAsset; error?: string }[];
}> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/projects/${projectId}/images`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`画像生成に失敗しました: ${errorText}`);
  }

  return response.json();
}
