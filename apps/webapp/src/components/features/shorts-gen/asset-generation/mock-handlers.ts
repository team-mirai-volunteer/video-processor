/**
 * Mock handlers for asset generation - use these during development
 * when the backend API is not yet available
 */

import type {
  GenerateAllAssetsResponse,
  GenerateImageResponse,
  GenerateSubtitleResponse,
  GenerateVoiceResponse,
  Scene,
  SceneAsset,
} from './types';

function generateId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function mockGenerateVoice(scene: Scene): Promise<GenerateVoiceResponse> {
  await delay(1000 + Math.random() * 2000);
  if (Math.random() < 0.1) {
    throw new Error('音声生成サービスが一時的に利用できません');
  }
  const durationMs = scene.voiceText
    ? Math.round(scene.voiceText.length * 80 + Math.random() * 500)
    : scene.silenceDurationMs || 1000;
  const asset: SceneAsset = {
    id: generateId(),
    sceneId: scene.id,
    assetType: 'voice',
    fileUrl: `https://example.com/mock/voice/${scene.id}.mp3`,
    durationMs,
  };
  return { asset };
}

export async function mockGenerateSubtitle(scene: Scene): Promise<GenerateSubtitleResponse> {
  await delay(500 + Math.random() * 1000);
  if (Math.random() < 0.1) {
    throw new Error('字幕生成中にエラーが発生しました');
  }
  const assets: SceneAsset[] = scene.subtitles.map((_subtitle, index) => ({
    id: generateId(),
    sceneId: scene.id,
    assetType: 'subtitle_image',
    fileUrl: `https://example.com/mock/subtitle/${scene.id}_${index}.png`,
    durationMs: null,
  }));
  return { assets };
}

export async function mockGenerateImage(scene: Scene): Promise<GenerateImageResponse> {
  await delay(2000 + Math.random() * 3000);
  if (Math.random() < 0.1) {
    throw new Error('画像生成APIがタイムアウトしました');
  }
  const generatedPrompt = scene.imagePrompt || `A creative illustration for: ${scene.summary}`;
  const asset: SceneAsset = {
    id: generateId(),
    sceneId: scene.id,
    assetType: 'background_image',
    fileUrl: `https://picsum.photos/seed/${scene.id}/1080/1920`,
    durationMs: null,
  };
  return { asset, generatedPrompt };
}

export async function mockGenerateAllVoices(scenes: Scene[]): Promise<GenerateAllAssetsResponse> {
  const results = await Promise.all(
    scenes.map(async (scene) => {
      if (!scene.voiceText) {
        return { sceneId: scene.id, success: true };
      }
      try {
        const response = await mockGenerateVoice(scene);
        return { sceneId: scene.id, success: true, asset: response.asset };
      } catch (error) {
        return {
          sceneId: scene.id,
          success: false,
          error: error instanceof Error ? error.message : '不明なエラー',
        };
      }
    })
  );
  return { success: results.every((r) => r.success), results };
}

export async function mockGenerateAllSubtitles(
  scenes: Scene[]
): Promise<GenerateAllAssetsResponse> {
  const results = await Promise.all(
    scenes.map(async (scene) => {
      if (scene.subtitles.length === 0) {
        return { sceneId: scene.id, success: true };
      }
      try {
        const response = await mockGenerateSubtitle(scene);
        return { sceneId: scene.id, success: true, assets: response.assets };
      } catch (error) {
        return {
          sceneId: scene.id,
          success: false,
          error: error instanceof Error ? error.message : '不明なエラー',
        };
      }
    })
  );
  return { success: results.every((r) => r.success), results };
}

export async function mockGenerateAllImages(scenes: Scene[]): Promise<GenerateAllAssetsResponse> {
  const results = await Promise.all(
    scenes.map(async (scene) => {
      if (scene.visualType !== 'image_gen') {
        return { sceneId: scene.id, success: true };
      }
      try {
        const response = await mockGenerateImage(scene);
        return { sceneId: scene.id, success: true, asset: response.asset };
      } catch (error) {
        return {
          sceneId: scene.id,
          success: false,
          error: error instanceof Error ? error.message : '不明なエラー',
        };
      }
    })
  );
  return { success: results.every((r) => r.success), results };
}

export function createMockHandlers(scenes: Scene[]) {
  return {
    onVoiceGenerate: async (sceneId: string) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error('Scene not found');
      return mockGenerateVoice(scene);
    },
    onSubtitleGenerate: async (sceneId: string) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error('Scene not found');
      return mockGenerateSubtitle(scene);
    },
    onImageGenerate: async (sceneId: string) => {
      const scene = scenes.find((s) => s.id === sceneId);
      if (!scene) throw new Error('Scene not found');
      return mockGenerateImage(scene);
    },
    onAllVoicesGenerate: () => mockGenerateAllVoices(scenes),
    onAllSubtitlesGenerate: () => mockGenerateAllSubtitles(scenes),
    onAllImagesGenerate: () => mockGenerateAllImages(scenes),
  };
}
