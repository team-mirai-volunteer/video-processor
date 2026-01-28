'use client';

import {
  ComposeStep,
  PublishTextStep,
  StepCard,
  type StepStatus,
} from '@/components/features/shorts-gen';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type {
  GetComposedVideoResponse,
  GetPublishTextResponse,
  ShortsProject,
} from '@video-processor/shared';
import { ArrowLeft, Settings } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useState } from 'react';

interface ProjectDetailClientProps {
  project: ShortsProject;
}

interface StepState {
  status: StepStatus;
  isExpanded: boolean;
}

type StepId = 'project' | 'planning' | 'script' | 'assets' | 'compose' | 'publish';

type StepsState = Record<StepId, StepState>;

const INITIAL_STEPS: StepsState = {
  project: { status: 'completed', isExpanded: false },
  planning: { status: 'ready', isExpanded: true },
  script: { status: 'pending', isExpanded: false },
  assets: { status: 'pending', isExpanded: false },
  compose: { status: 'pending', isExpanded: false },
  publish: { status: 'pending', isExpanded: false },
};

export function ProjectDetailClient({ project }: ProjectDetailClientProps) {
  const [steps, setSteps] = useState<StepsState>(INITIAL_STEPS);
  const [scriptId] = useState<string | null>(null);
  const [isAssetsComplete] = useState(false);
  const [isComposeComplete, setIsComposeComplete] = useState(false);

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

        {/* Step 2: Planning */}
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
          <div className="text-center py-8 text-muted-foreground">
            <p>企画書生成UIはE4タスクで実装されます</p>
            <p className="text-sm mt-1">チャットUIでAIと対話しながら企画書を作成できます</p>
          </div>
        </StepCard>

        {/* Step 3: Script */}
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
          <div className="text-center py-8 text-muted-foreground">
            <p>台本生成UIはE5タスクで実装されます</p>
            <p className="text-sm mt-1">チャットUIでAIと対話しながら台本を作成できます</p>
          </div>
        </StepCard>

        {/* Step 4: Assets (4-5-6-7) */}
        <StepCard
          stepNumber={4}
          title="素材生成"
          description="音声・字幕・画像を並列で生成します"
          status={steps.assets.status}
          isExpanded={steps.assets.isExpanded}
          onToggle={() => toggleStep('assets')}
          canRegenerate
        >
          <div className="text-center py-8 text-muted-foreground">
            <p>素材生成UIはE6タスクで実装済みです</p>
            <p className="text-sm mt-1">音声・字幕・画像を3列で並列生成できます</p>
          </div>
        </StepCard>

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
            scriptId={scriptId}
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
