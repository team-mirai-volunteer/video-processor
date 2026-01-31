'use client';

import { useCallback, useState } from 'react';
import type {
  AssetColumnData,
  AssetGenerationStatus,
  GenerateAllAssetsResponse,
  GenerateImagePromptResponse,
  GenerateImageResponse,
  GenerateSubtitleResponse,
  GenerateVoiceResponse,
  ImagePromptState,
  Scene,
  SceneAsset,
  SceneAssetState,
} from './types';

interface UseAssetGenerationOptions {
  projectId: string;
  scenes: Scene[];
  onVoiceGenerate?: (sceneId: string) => Promise<GenerateVoiceResponse>;
  onSubtitleGenerate?: (sceneId: string) => Promise<GenerateSubtitleResponse>;
  onImageGenerate?: (sceneId: string) => Promise<GenerateImageResponse>;
  onImagePromptGenerate?: (sceneId: string) => Promise<GenerateImagePromptResponse>;
  onAllVoicesGenerate?: () => Promise<GenerateAllAssetsResponse>;
  onAllSubtitlesGenerate?: () => Promise<GenerateAllAssetsResponse>;
  onAllImagesGenerate?: () => Promise<GenerateAllAssetsResponse>;
}

interface AssetGenerationState {
  voice: Record<string, SceneAssetState>;
  subtitle: Record<string, SceneAssetState>;
  image: Record<string, SceneAssetState>;
  imagePrompt: Record<string, ImagePromptState>;
  isGeneratingVoice: boolean;
  isGeneratingSubtitle: boolean;
  isGeneratingImage: boolean;
  isGeneratingImagePrompt: boolean;
}

function createInitialSceneState(sceneId: string): SceneAssetState {
  return {
    sceneId,
    status: 'pending',
  };
}

function createInitialImagePromptState(sceneId: string): ImagePromptState {
  return {
    sceneId,
    status: 'pending',
  };
}

function initializeState(scenes: Scene[]): AssetGenerationState {
  const voice: Record<string, SceneAssetState> = {};
  const subtitle: Record<string, SceneAssetState> = {};
  const image: Record<string, SceneAssetState> = {};
  const imagePrompt: Record<string, ImagePromptState> = {};

  for (const scene of scenes) {
    voice[scene.id] = createInitialSceneState(scene.id);
    subtitle[scene.id] = createInitialSceneState(scene.id);
    image[scene.id] = createInitialSceneState(scene.id);
    imagePrompt[scene.id] = createInitialImagePromptState(scene.id);
  }

  return {
    voice,
    subtitle,
    image,
    imagePrompt,
    isGeneratingVoice: false,
    isGeneratingSubtitle: false,
    isGeneratingImage: false,
    isGeneratingImagePrompt: false,
  };
}

export function useAssetGeneration({
  projectId: _projectId,
  scenes,
  onVoiceGenerate,
  onSubtitleGenerate,
  onImageGenerate,
  onImagePromptGenerate,
  onAllVoicesGenerate,
  onAllSubtitlesGenerate,
  onAllImagesGenerate,
}: UseAssetGenerationOptions) {
  const [state, setState] = useState<AssetGenerationState>(() => initializeState(scenes));

  const updateSceneState = useCallback(
    (type: 'voice' | 'subtitle' | 'image', sceneId: string, updates: Partial<SceneAssetState>) => {
      setState((prev) => ({
        ...prev,
        [type]: {
          ...prev[type],
          [sceneId]: {
            ...prev[type][sceneId],
            ...updates,
          },
        },
      }));
    },
    []
  );

  const updateImagePromptState = useCallback(
    (sceneId: string, updates: Partial<ImagePromptState>) => {
      setState((prev) => {
        const currentState = prev.imagePrompt[sceneId] ?? createInitialImagePromptState(sceneId);
        return {
          ...prev,
          imagePrompt: {
            ...prev.imagePrompt,
            [sceneId]: {
              ...currentState,
              ...updates,
            },
          },
        };
      });
    },
    []
  );

  const generateVoice = useCallback(
    async (sceneId: string) => {
      if (!onVoiceGenerate) return;
      updateSceneState('voice', sceneId, { status: 'running', error: undefined });
      try {
        const response = await onVoiceGenerate(sceneId);
        updateSceneState('voice', sceneId, { status: 'completed', asset: response.asset });
      } catch (error) {
        updateSceneState('voice', sceneId, {
          status: 'error',
          error: error instanceof Error ? error.message : '音声生成に失敗しました',
        });
      }
    },
    [onVoiceGenerate, updateSceneState]
  );

  const generateSubtitle = useCallback(
    async (sceneId: string) => {
      if (!onSubtitleGenerate) return;
      updateSceneState('subtitle', sceneId, { status: 'running', error: undefined });
      try {
        const response = await onSubtitleGenerate(sceneId);
        updateSceneState('subtitle', sceneId, {
          status: 'completed',
          asset: response.assets[0],
          assets: response.assets,
        });
      } catch (error) {
        updateSceneState('subtitle', sceneId, {
          status: 'error',
          error: error instanceof Error ? error.message : '字幕生成に失敗しました',
        });
      }
    },
    [onSubtitleGenerate, updateSceneState]
  );

  const generateImage = useCallback(
    async (sceneId: string) => {
      if (!onImageGenerate) return;
      updateSceneState('image', sceneId, { status: 'running', error: undefined });
      try {
        const response = await onImageGenerate(sceneId);
        updateSceneState('image', sceneId, { status: 'completed', asset: response.asset });
      } catch (error) {
        updateSceneState('image', sceneId, {
          status: 'error',
          error: error instanceof Error ? error.message : '画像生成に失敗しました',
        });
      }
    },
    [onImageGenerate, updateSceneState]
  );

  const generateImagePrompt = useCallback(
    async (sceneId: string): Promise<GenerateImagePromptResponse | undefined> => {
      if (!onImagePromptGenerate) return;
      updateImagePromptState(sceneId, { status: 'running', error: undefined });
      try {
        const response = await onImagePromptGenerate(sceneId);
        updateImagePromptState(sceneId, {
          status: 'completed',
          imagePrompt: response.imagePrompt,
        });
        return response;
      } catch (error) {
        updateImagePromptState(sceneId, {
          status: 'error',
          error: error instanceof Error ? error.message : 'プロンプト生成に失敗しました',
        });
        return undefined;
      }
    },
    [onImagePromptGenerate, updateImagePromptState]
  );

  const generateAllVoices = useCallback(async () => {
    if (!onAllVoicesGenerate) {
      if (!onVoiceGenerate) return;
      setState((prev) => ({ ...prev, isGeneratingVoice: true }));
      for (const scene of scenes) {
        if (scene.voiceText) {
          await generateVoice(scene.id);
        } else {
          updateSceneState('voice', scene.id, { status: 'completed' });
        }
      }
      setState((prev) => ({ ...prev, isGeneratingVoice: false }));
      return;
    }

    setState((prev) => ({ ...prev, isGeneratingVoice: true }));
    for (const scene of scenes) {
      if (scene.voiceText) {
        updateSceneState('voice', scene.id, { status: 'running', error: undefined });
      }
    }

    try {
      const response = await onAllVoicesGenerate();
      for (const result of response.results) {
        if (result.success && result.asset) {
          updateSceneState('voice', result.sceneId, { status: 'completed', asset: result.asset });
        } else {
          updateSceneState('voice', result.sceneId, {
            status: 'error',
            error: result.error || '音声生成に失敗しました',
          });
        }
      }
    } catch (error) {
      for (const scene of scenes) {
        if (scene.voiceText) {
          updateSceneState('voice', scene.id, {
            status: 'error',
            error: error instanceof Error ? error.message : '音声生成に失敗しました',
          });
        }
      }
    } finally {
      setState((prev) => ({ ...prev, isGeneratingVoice: false }));
    }
  }, [scenes, onAllVoicesGenerate, onVoiceGenerate, generateVoice, updateSceneState]);

  const generateAllSubtitles = useCallback(async () => {
    if (!onAllSubtitlesGenerate) {
      if (!onSubtitleGenerate) return;
      setState((prev) => ({ ...prev, isGeneratingSubtitle: true }));
      for (const scene of scenes) {
        if (scene.subtitles.length > 0) {
          await generateSubtitle(scene.id);
        } else {
          updateSceneState('subtitle', scene.id, { status: 'completed' });
        }
      }
      setState((prev) => ({ ...prev, isGeneratingSubtitle: false }));
      return;
    }

    setState((prev) => ({ ...prev, isGeneratingSubtitle: true }));
    for (const scene of scenes) {
      if (scene.subtitles.length > 0) {
        updateSceneState('subtitle', scene.id, { status: 'running', error: undefined });
      }
    }

    try {
      const response = await onAllSubtitlesGenerate();
      for (const result of response.results) {
        if (result.success && result.assets?.[0]) {
          updateSceneState('subtitle', result.sceneId, {
            status: 'completed',
            asset: result.assets[0],
            assets: result.assets,
          });
        } else {
          updateSceneState('subtitle', result.sceneId, {
            status: 'error',
            error: result.error || '字幕生成に失敗しました',
          });
        }
      }
    } catch (error) {
      for (const scene of scenes) {
        if (scene.subtitles.length > 0) {
          updateSceneState('subtitle', scene.id, {
            status: 'error',
            error: error instanceof Error ? error.message : '字幕生成に失敗しました',
          });
        }
      }
    } finally {
      setState((prev) => ({ ...prev, isGeneratingSubtitle: false }));
    }
  }, [scenes, onAllSubtitlesGenerate, onSubtitleGenerate, generateSubtitle, updateSceneState]);

  const generateAllImages = useCallback(async () => {
    if (!onAllImagesGenerate) {
      if (!onImageGenerate) return;
      setState((prev) => ({ ...prev, isGeneratingImage: true }));
      for (const scene of scenes) {
        if (scene.visualType === 'image_gen') {
          await generateImage(scene.id);
        } else {
          updateSceneState('image', scene.id, { status: 'completed' });
        }
      }
      setState((prev) => ({ ...prev, isGeneratingImage: false }));
      return;
    }

    setState((prev) => ({ ...prev, isGeneratingImage: true }));
    for (const scene of scenes) {
      if (scene.visualType === 'image_gen') {
        updateSceneState('image', scene.id, { status: 'running', error: undefined });
      }
    }

    try {
      const response = await onAllImagesGenerate();
      for (const result of response.results) {
        if (result.success && result.asset) {
          updateSceneState('image', result.sceneId, { status: 'completed', asset: result.asset });
        } else {
          updateSceneState('image', result.sceneId, {
            status: 'error',
            error: result.error || '画像生成に失敗しました',
          });
        }
      }
    } catch (error) {
      for (const scene of scenes) {
        if (scene.visualType === 'image_gen') {
          updateSceneState('image', scene.id, {
            status: 'error',
            error: error instanceof Error ? error.message : '画像生成に失敗しました',
          });
        }
      }
    } finally {
      setState((prev) => ({ ...prev, isGeneratingImage: false }));
    }
  }, [scenes, onAllImagesGenerate, onImageGenerate, generateImage, updateSceneState]);

  const loadExistingAssets = useCallback(
    (assets: { voice: SceneAsset[]; subtitle: SceneAsset[]; image: SceneAsset[] }) => {
      setState((prev) => {
        const newState = { ...prev };
        for (const asset of assets.voice) {
          newState.voice[asset.sceneId] = { sceneId: asset.sceneId, status: 'completed', asset };
        }
        for (const asset of assets.subtitle) {
          newState.subtitle[asset.sceneId] = { sceneId: asset.sceneId, status: 'completed', asset };
        }
        for (const asset of assets.image) {
          newState.image[asset.sceneId] = { sceneId: asset.sceneId, status: 'completed', asset };
        }
        return newState;
      });
    },
    []
  );

  const reset = useCallback(() => {
    setState(initializeState(scenes));
  }, [scenes]);

  const getColumnData = useCallback((): AssetColumnData[] => {
    const voiceScenes = scenes
      .map((scene) => state.voice[scene.id])
      .filter((s): s is SceneAssetState => s !== undefined);
    const subtitleScenes = scenes
      .map((scene) => state.subtitle[scene.id])
      .filter((s): s is SceneAssetState => s !== undefined);
    const imageScenes = scenes
      .map((scene) => state.image[scene.id])
      .filter((s): s is SceneAssetState => s !== undefined);

    return [
      {
        id: 'voice',
        title: '④ 音声',
        scenes: voiceScenes,
        isGenerating: state.isGeneratingVoice,
        canGenerate: scenes.some((s) => !!s.voiceText),
      },
      {
        id: 'subtitle',
        title: '⑤ 字幕',
        scenes: subtitleScenes,
        isGenerating: state.isGeneratingSubtitle,
        canGenerate: scenes.some((s) => s.subtitles.length > 0),
      },
      {
        id: 'image',
        title: '⑥⑦ 画像',
        scenes: imageScenes,
        isGenerating: state.isGeneratingImage,
        canGenerate: scenes.some((s) => s.visualType === 'image_gen'),
      },
    ];
  }, [scenes, state]);

  const getOverallStatus = useCallback((): AssetGenerationStatus => {
    // 生成が必要なシーンのみを対象とする（スキップ対象は分母から除外）
    const voiceStates = scenes
      .filter((s) => !!s.voiceText)
      .map((s) => state.voice[s.id])
      .filter((s): s is SceneAssetState => s !== undefined);
    const subtitleStates = scenes
      .filter((s) => s.subtitles.length > 0)
      .map((s) => state.subtitle[s.id])
      .filter((s): s is SceneAssetState => s !== undefined);
    const imageStates = scenes
      .filter((s) => s.visualType === 'image_gen')
      .map((s) => state.image[s.id])
      .filter((s): s is SceneAssetState => s !== undefined);

    const allStates = [...voiceStates, ...subtitleStates, ...imageStates];

    // 生成対象が1つもない場合はpending
    if (allStates.length === 0) {
      return 'pending';
    }

    if (state.isGeneratingVoice || state.isGeneratingSubtitle || state.isGeneratingImage) {
      return 'running';
    }
    if (allStates.some((s) => s.status === 'error')) {
      return 'error';
    }
    if (allStates.every((s) => s.status === 'completed')) {
      return 'completed';
    }
    if (allStates.some((s) => s.status === 'running')) {
      return 'running';
    }
    return 'pending';
  }, [scenes, state]);

  const isAllCompleted = useCallback((): boolean => {
    return getOverallStatus() === 'completed';
  }, [getOverallStatus]);

  return {
    state,
    columns: getColumnData(),
    overallStatus: getOverallStatus(),
    isAllCompleted: isAllCompleted(),
    generateVoice,
    generateSubtitle,
    generateImage,
    generateImagePrompt,
    generateAllVoices,
    generateAllSubtitles,
    generateAllImages,
    loadExistingAssets,
    reset,
  };
}
