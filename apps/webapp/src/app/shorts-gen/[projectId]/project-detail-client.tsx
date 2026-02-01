'use client';

import {
  AssetGenerationStep,
  ComposeStep,
  type GenerateAllAssetsResponse,
  type GenerateAllImagePromptsResponse,
  type GenerateImagePromptResponse,
  type GenerateImageResponse,
  type GenerateSubtitleResponse,
  type GenerateVoiceResponse,
  type Planning,
  PlanningGenerationStep,
  PublishTextStep,
  type Scene,
  type SceneAsset,
  type Script,
  ScriptGenerationStep,
  StepCard,
  type StepStatus,
  type UpdatePlanningParams,
  type UpdateSceneParams,
} from '@/components/features/shorts-gen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  GetComposedVideoResponse,
  GetPublishTextResponse,
  GetShortsImagesResponse,
  GetShortsSubtitlesResponse,
  GetShortsVoiceResponse,
  ShortsProject,
} from '@video-processor/shared';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useMemo, useState } from 'react';

interface InitialAssets {
  voice: GetShortsVoiceResponse | null;
  subtitles: GetShortsSubtitlesResponse | null;
  images: GetShortsImagesResponse | null;
}

interface ProjectDetailClientProps {
  project: ShortsProject;
  initialPlanning: Planning | null;
  initialScript?: Script | null;
  initialScenes?: Scene[];
  initialAssets?: InitialAssets | null;
}

interface StepState {
  status: StepStatus;
  isExpanded: boolean;
}

type StepId = 'project' | 'planning' | 'script' | 'assets' | 'compose' | 'publish';

type StepsState = Record<StepId, StepState>;

function getInitialSteps(hasPlanning: boolean, hasScript: boolean): StepsState {
  return {
    project: { status: 'completed', isExpanded: true },
    planning: { status: hasPlanning ? 'completed' : 'ready', isExpanded: true },
    script: {
      status: hasScript ? 'completed' : hasPlanning ? 'ready' : 'pending',
      isExpanded: true,
    },
    assets: { status: hasScript ? 'ready' : 'pending', isExpanded: true },
    compose: { status: 'pending', isExpanded: true },
    publish: { status: 'pending', isExpanded: true },
  };
}

export function ProjectDetailClient({
  project,
  initialPlanning,
  initialScript = null,
  initialScenes = [],
  initialAssets = null,
}: ProjectDetailClientProps) {
  const [steps, setSteps] = useState<StepsState>(() =>
    getInitialSteps(!!initialPlanning, !!initialScript)
  );

  // Planning state (E4)
  const [planning, setPlanning] = useState<Planning | null>(initialPlanning);

  // Script state (E5)
  const [script, setScript] = useState<Script | null>(initialScript);
  const [scenes, setScenes] = useState<Scene[]>(initialScenes);

  // Assets & Compose state
  const [isAssetsComplete, setIsAssetsComplete] = useState(false);
  const [isComposeComplete, setIsComposeComplete] = useState(false);

  // Convert initial assets from API response to SceneAsset format
  const existingAssets = useMemo(() => {
    if (!initialAssets) return undefined;

    const voiceAssets: SceneAsset[] = [];
    const subtitleAssets: SceneAsset[] = [];
    const imageAssets: SceneAsset[] = [];

    // Convert voice assets
    if (initialAssets.voice?.sceneVoices) {
      for (const sv of initialAssets.voice.sceneVoices) {
        if (sv.asset) {
          voiceAssets.push({
            id: sv.asset.assetId,
            sceneId: sv.sceneId,
            assetType: 'voice',
            fileUrl: sv.asset.fileUrl,
            durationMs: sv.asset.durationMs,
          });
        }
      }
    }

    // Convert subtitle assets
    if (initialAssets.subtitles?.sceneSubtitles) {
      for (const ss of initialAssets.subtitles.sceneSubtitles) {
        for (const asset of ss.assets) {
          subtitleAssets.push({
            id: asset.assetId,
            sceneId: ss.sceneId,
            assetType: 'subtitle_image',
            fileUrl: asset.fileUrl,
            durationMs: null,
          });
        }
      }
    }

    // Convert image assets
    if (initialAssets.images?.sceneImages) {
      for (const si of initialAssets.images.sceneImages) {
        if (si.asset) {
          imageAssets.push({
            id: si.asset.assetId,
            sceneId: si.sceneId,
            assetType: 'background_image',
            fileUrl: si.asset.fileUrl,
            durationMs: null,
          });
        }
      }
    }

    return {
      voice: voiceAssets,
      subtitle: subtitleAssets,
      image: imageAssets,
    };
  }, [initialAssets]);

  const toggleStep = (stepId: StepId) => {
    setSteps((prev) => ({
      ...prev,
      [stepId]: { status: prev[stepId].status, isExpanded: !prev[stepId].isExpanded },
    }));
  };

  const updateStepStatus = useCallback((stepId: StepId, status: StepStatus) => {
    setSteps((prev) => ({
      ...prev,
      [stepId]: { ...prev[stepId], status },
    }));
  }, []);

  // Handle assets complete
  const handleAssetsComplete = useCallback(() => {
    setIsAssetsComplete(true);
    updateStepStatus('assets', 'completed');
    updateStepStatus('compose', 'ready');
  }, [updateStepStatus]);

  const handleComposeComplete = useCallback(
    (_composedVideo: GetComposedVideoResponse) => {
      setIsComposeComplete(true);
      updateStepStatus('compose', 'completed');
      updateStepStatus('publish', 'ready');
    },
    [updateStepStatus]
  );

  const handlePublishTextComplete = useCallback(
    (_publishText: GetPublishTextResponse) => {
      updateStepStatus('publish', 'completed');
    },
    [updateStepStatus]
  );

  // E4: Planning handlers
  const handlePlanningGenerated = useCallback(
    (newPlanning: Planning) => {
      setPlanning(newPlanning);
      updateStepStatus('planning', 'completed');
      updateStepStatus('script', 'ready');
    },
    [updateStepStatus]
  );

  const handlePlanningUpdated = useCallback((updatedPlanning: Planning) => {
    setPlanning(updatedPlanning);
  }, []);

  const handleSavePlanning = useCallback(
    async (planningId: string, params: UpdatePlanningParams) => {
      // TODO: Call API to save planning
      const response = await fetch(
        `/api/shorts-gen/projects/${project.id}/planning/${planningId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        }
      );
      if (!response.ok) {
        throw new Error('Failed to save planning');
      }
    },
    [project.id]
  );

  // E5: Script handlers
  const handleScriptGenerated = useCallback(
    (newScript: Script, newScenes: Scene[]) => {
      setScript(newScript);
      setScenes(newScenes);
      updateStepStatus('script', 'completed');
      updateStepStatus('assets', 'ready');
    },
    [updateStepStatus]
  );

  const handleSceneUpdated = useCallback((updatedScene: Scene) => {
    setScenes((prev) => prev.map((s) => (s.id === updatedScene.id ? updatedScene : s)));
  }, []);

  const handleSaveScene = useCallback(
    async (sceneId: string, params: UpdateSceneParams) => {
      // TODO: Call API to save scene
      const response = await fetch(`/api/shorts-gen/projects/${project.id}/scenes/${sceneId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      });
      if (!response.ok) {
        throw new Error('Failed to save scene');
      }
    },
    [project.id]
  );

  // Asset generation handlers
  const handleAllVoicesGenerate = useCallback(async (): Promise<GenerateAllAssetsResponse> => {
    if (!script) throw new Error('Script not found');
    const response = await fetch(`/api/shorts-gen/scripts/${script.id}/voice`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to generate voices');
    }
    const data = await response.json();

    // Convert backend response to GenerateAllAssetsResponse format
    // Backend returns: { results: [{ sceneId, assetId, fileUrl, durationMs, skipped }], errors: [...] }
    const results: GenerateAllAssetsResponse['results'] = (data.results || []).map(
      (result: {
        sceneId: string;
        assetId: string;
        fileUrl: string;
        durationMs: number;
        skipped: boolean;
      }) => ({
        sceneId: result.sceneId,
        success: true,
        asset: result.skipped
          ? undefined
          : {
              id: result.assetId,
              sceneId: result.sceneId,
              assetType: 'voice' as const,
              fileUrl: result.fileUrl,
              durationMs: result.durationMs,
            },
      })
    );

    // Add failed scenes from errors array
    for (const error of data.errors || []) {
      results.push({
        sceneId: error.sceneId,
        success: false,
        error: error.message,
      });
    }

    return {
      success: (data.failedCount || 0) === 0,
      results,
    };
  }, [script]);

  // Single scene voice generation handler
  const handleVoiceGenerate = useCallback(
    async (sceneId: string): Promise<GenerateVoiceResponse> => {
      const response = await fetch(`/api/shorts-gen/scenes/${sceneId}/voice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to generate voice');
      }
      const data = await response.json();

      // Check for errors in the response
      if (data.errors && data.errors.length > 0) {
        throw new Error(data.errors[0].message || 'Voice generation failed');
      }

      // The API returns results array from SynthesizeVoiceOutput
      const result = data.results?.find((r: { sceneId: string }) => r.sceneId === sceneId);
      if (!result) {
        throw new Error('Voice result not found in response');
      }

      // If skipped (no voice text), return placeholder
      if (result.skipped) {
        return {
          asset: {
            id: '',
            sceneId,
            assetType: 'voice',
            fileUrl: '',
            durationMs: result.durationMs ?? null,
          },
        };
      }

      return {
        asset: {
          id: result.assetId,
          sceneId,
          assetType: 'voice',
          fileUrl: result.fileUrl,
          durationMs: result.durationMs ?? null,
        },
      };
    },
    []
  );

  // Single scene subtitle generation handler
  const handleSubtitleGenerate = useCallback(
    async (sceneId: string): Promise<GenerateSubtitleResponse> => {
      const response = await fetch(`/api/shorts-gen/scenes/${sceneId}/subtitles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to generate subtitle');
      }
      const data = await response.json();

      // The API returns sceneResults array
      const sceneResult = data.sceneResults?.[0];
      if (!sceneResult) {
        throw new Error('Subtitle result not found in response');
      }

      return {
        assets: sceneResult.assets ?? [],
      };
    },
    []
  );

  const handleAllSubtitlesGenerate = useCallback(async (): Promise<GenerateAllAssetsResponse> => {
    if (!script) throw new Error('Script not found');
    const response = await fetch(`/api/shorts-gen/scripts/${script.id}/subtitles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to generate subtitles');
    }
    const data = await response.json();
    return {
      success: true,
      results:
        data.sceneResults?.map(
          (sr: { sceneId: string; success: boolean; assets?: unknown[]; error?: string }) => ({
            sceneId: sr.sceneId,
            success: sr.success,
            assets: sr.assets,
            error: sr.error,
          })
        ) ||
        scenes.map((s) => ({
          sceneId: s.id,
          success: true,
          assets: data.sceneSubtitles?.find((ss: { sceneId: string }) => ss.sceneId === s.id)
            ?.assets,
        })),
    };
  }, [script, scenes]);

  const handleAllImagesGenerate = useCallback(async (): Promise<GenerateAllAssetsResponse> => {
    if (!script) throw new Error('Script not found');
    const response = await fetch(`/api/shorts-gen/scripts/${script.id}/images`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'Failed to generate images');
    }
    const data = await response.json();

    // バックエンドレスポンスをGenerateAllAssetsResponse形式に変換
    return {
      success: (data.failureCount || 0) === 0,
      results: (data.results || []).map(
        (result: {
          sceneId: string;
          assetId: string;
          fileUrl: string;
          success: boolean;
          error?: string;
        }) => ({
          sceneId: result.sceneId,
          success: result.success,
          asset: result.success
            ? {
                id: result.assetId,
                sceneId: result.sceneId,
                assetType: 'background_image' as const,
                fileUrl: result.fileUrl,
                durationMs: null,
              }
            : undefined,
          error: result.error,
        })
      ),
    };
  }, [script]);

  // Single scene image prompt generation handler
  const handleImagePromptGenerate = useCallback(
    async (sceneId: string): Promise<GenerateImagePromptResponse> => {
      const response = await fetch(`/api/shorts-gen/scenes/${sceneId}/image-prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to generate image prompt');
      }
      const data = await response.json();

      // Update scene with generated prompt
      const updatedScene = scenes.find((s) => s.id === sceneId);
      if (updatedScene) {
        setScenes((prev) =>
          prev.map((s) => (s.id === sceneId ? { ...s, imagePrompt: data.imagePrompt } : s))
        );
      }

      return {
        sceneId: data.sceneId,
        imagePrompt: data.imagePrompt,
        styleHint: data.styleHint ?? null,
      };
    },
    [scenes]
  );

  // Single scene image generation handler
  const handleImageGenerate = useCallback(
    async (sceneId: string): Promise<GenerateImageResponse> => {
      const response = await fetch(`/api/shorts-gen/scenes/${sceneId}/image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || error.message || 'Failed to generate image');
      }
      const data = await response.json();

      // Backend returns { results: [{ sceneId, assetId, fileUrl, success }], ... }
      const result = data.results?.[0];
      if (!result || !result.success) {
        throw new Error(result?.error || 'Image generation failed');
      }

      return {
        asset: {
          id: result.assetId,
          sceneId,
          assetType: 'background_image',
          fileUrl: result.fileUrl,
          durationMs: null,
        },
      };
    },
    []
  );

  // All image prompts generation handler
  const handleAllImagePromptsGenerate =
    useCallback(async (): Promise<GenerateAllImagePromptsResponse> => {
      if (!script) throw new Error('Script not found');
      const response = await fetch(`/api/shorts-gen/scripts/${script.id}/image-prompts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || 'Failed to generate image prompts');
      }
      const data = await response.json();

      // Update scenes with generated prompts
      if (data.results) {
        setScenes((prev) =>
          prev.map((s) => {
            const result = data.results.find(
              (r: { sceneId: string; imagePrompt?: string }) => r.sceneId === s.id
            );
            if (result?.imagePrompt) {
              return { ...s, imagePrompt: result.imagePrompt };
            }
            return s;
          })
        );
      }

      return {
        success: data.success ?? true,
        results:
          data.results?.map(
            (r: { sceneId: string; success: boolean; imagePrompt?: string; error?: string }) => ({
              sceneId: r.sceneId,
              success: r.success,
              imagePrompt: r.imagePrompt,
              error: r.error,
            })
          ) || [],
      };
    }, [script]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/shorts-gen">
              <ArrowLeft className="mr-2 h-4 w-4" />
              一覧に戻る
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline">{project.aspectRatio}</Badge>
              <span className="text-sm text-muted-foreground">
                {project.resolutionWidth} x {project.resolutionHeight}
              </span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm">
          <Settings className="mr-2 h-4 w-4" />
          設定
        </Button>
      </div>

      {/* Generation Flow */}
      <div className="space-y-4">
        {/* Step 1: Project Info */}
        <StepCard
          stepNumber={1}
          title="企画ルート"
          description="プロジェクトの基本設定です"
          status={steps.project.status}
          isExpanded={steps.project.isExpanded}
          onToggle={() => toggleStep('project')}
          canEdit
          onEdit={() => toggleStep('project')}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">プロジェクト情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">タイトル:</span>
                  <span className="ml-2 font-medium">{project.title}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">アスペクト比:</span>
                  <span className="ml-2">{project.aspectRatio}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">解像度:</span>
                  <span className="ml-2">
                    {project.resolutionWidth} x {project.resolutionHeight}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </StepCard>

        {/* Step 2: Planning (E4) */}
        <StepCard
          stepNumber={2}
          title="企画書"
          description="長文やURLをもとに企画書を生成します"
          status={steps.planning.status}
          isExpanded={steps.planning.isExpanded}
          onToggle={() => toggleStep('planning')}
          canRegenerate
          canEdit
        >
          <PlanningGenerationStep
            projectId={project.id}
            planning={planning}
            status={
              steps.planning.status === 'ready'
                ? 'ready'
                : steps.planning.status === 'completed'
                  ? 'completed'
                  : 'idle'
            }
            onPlanningGenerated={handlePlanningGenerated}
            onPlanningUpdated={handlePlanningUpdated}
            onSavePlanning={handleSavePlanning}
          />
        </StepCard>

        {/* Step 3: Script (E5) */}
        <StepCard
          stepNumber={3}
          title="台本"
          description="企画書をもとにシーンごとの台本を生成します"
          status={steps.script.status}
          isExpanded={steps.script.isExpanded}
          onToggle={() => toggleStep('script')}
          canRegenerate
          canEdit
        >
          <ScriptGenerationStep
            projectId={project.id}
            planningId={planning?.id ?? null}
            script={script}
            scenes={scenes}
            status={
              steps.script.status === 'ready'
                ? 'ready'
                : steps.script.status === 'completed'
                  ? 'completed'
                  : 'idle'
            }
            onScriptGenerated={handleScriptGenerated}
            onSceneUpdated={handleSceneUpdated}
            onSaveScene={handleSaveScene}
          />
        </StepCard>

        {/* Step 4: Assets (4-5-6-7) */}
        <AssetGenerationStep
          projectId={project.id}
          scenes={scenes}
          isExpanded={steps.assets.isExpanded}
          onToggle={() => toggleStep('assets')}
          onComplete={handleAssetsComplete}
          canStart={steps.assets.status === 'ready' || steps.assets.status === 'completed'}
          existingAssets={existingAssets}
          onVoiceGenerate={handleVoiceGenerate}
          onSubtitleGenerate={handleSubtitleGenerate}
          onImageGenerate={handleImageGenerate}
          onImagePromptGenerate={handleImagePromptGenerate}
          onAllVoicesGenerate={handleAllVoicesGenerate}
          onAllSubtitlesGenerate={handleAllSubtitlesGenerate}
          onAllImagesGenerate={handleAllImagesGenerate}
          onAllImagePromptsGenerate={handleAllImagePromptsGenerate}
        />

        {/* Step 8: Compose */}
        <StepCard
          stepNumber={8}
          title="Compose"
          description="素材を合成して動画を生成します"
          status={steps.compose.status}
          isExpanded={steps.compose.isExpanded}
          onToggle={() => toggleStep('compose')}
          canRegenerate
        >
          <ComposeStep
            projectId={project.id}
            scriptId={script?.id ?? null}
            isEnabled={isAssetsComplete}
            onComposeComplete={handleComposeComplete}
          />
        </StepCard>

        {/* Step 9: Publish Text */}
        <StepCard
          stepNumber={9}
          title="公開テキスト"
          description="動画タイトルと説明文を生成します"
          status={steps.publish.status}
          isExpanded={steps.publish.isExpanded}
          onToggle={() => toggleStep('publish')}
          canRegenerate
          canEdit
        >
          <PublishTextStep
            projectId={project.id}
            isEnabled={isComposeComplete}
            onPublishTextComplete={handlePublishTextComplete}
          />
        </StepCard>
      </div>
    </div>
  );
}
