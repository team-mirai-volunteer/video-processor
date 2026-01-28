'use client';

import { ProjectStatusBadge } from '@/components/features/shorts-gen/project-list/project-status-badge';
import { StepCard, type StepStatus } from '@/components/features/shorts-gen/step-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatDate } from '@/lib/utils';
import type { ShortsProject, ShortsProjectStatus } from '@video-processor/shared';
import { ArrowLeft, Check, Pencil, X } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface ProjectDetailClientProps {
  project: ShortsProject;
}

type StepPhase = 'planning' | 'script' | 'assets' | 'compose' | 'publish';

const STATUS_ORDER: Record<ShortsProjectStatus, number> = {
  created: 0,
  planning_in_progress: 1,
  planning_completed: 2,
  script_in_progress: 3,
  script_completed: 4,
  assets_generating: 5,
  assets_completed: 6,
  composing: 7,
  completed: 8,
  failed: -1,
};

const PHASE_START: Record<StepPhase, number> = {
  planning: 1,
  script: 3,
  assets: 5,
  compose: 7,
  publish: 8,
};

const PHASE_END: Record<StepPhase, number> = {
  planning: 2,
  script: 4,
  assets: 6,
  compose: 7,
  publish: 8,
};

function getStepStatus(projectStatus: ShortsProjectStatus, stepPhase: StepPhase): StepStatus {
  if (projectStatus === 'failed') {
    return 'error';
  }

  const current = STATUS_ORDER[projectStatus];
  const start = PHASE_START[stepPhase];
  const end = PHASE_END[stepPhase];

  if (current < start) {
    return current === start - 1 ? 'ready' : 'pending';
  }
  if (current >= start && current < end) {
    return 'running';
  }
  if (current >= end) {
    return 'completed';
  }
  return 'pending';
}

export function ProjectDetailClient({ project }: ProjectDetailClientProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(project.title);

  const handleToggleStep = (step: number) => {
    setExpandedStep(expandedStep === step ? null : step);
  };

  const handleSaveTitle = () => {
    // TODO: Implement title update via API
    setIsEditingTitle(false);
  };

  const handleCancelEditTitle = () => {
    setEditedTitle(project.title);
    setIsEditingTitle(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/shorts-gen">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div className="flex-1">
          {isEditingTitle ? (
            <div className="flex items-center gap-2">
              <Input
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="text-2xl font-bold h-auto py-1"
                autoFocus
              />
              <Button variant="ghost" size="icon" onClick={handleSaveTitle}>
                <Check className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleCancelEditTitle}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">{project.title}</h1>
              <Button variant="ghost" size="icon" onClick={() => setIsEditingTitle(true)}>
                <Pencil className="h-4 w-4" />
              </Button>
            </div>
          )}
          <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
            <ProjectStatusBadge status={project.status} />
            <span>
              {project.aspectRatio} / {project.resolutionWidth}x{project.resolutionHeight}
            </span>
            <span>作成: {formatDate(project.createdAt)}</span>
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-4">
        {/* Step 1: Project Settings */}
        <StepCard
          stepNumber={1}
          title="企画ルート"
          description="動画の基本設定（アスペクト比、解像度など）"
          status="completed"
          isExpanded={expandedStep === 1}
          onToggle={() => handleToggleStep(1)}
          canRegenerate={false}
          canEdit={true}
          onEdit={() => setIsEditingTitle(true)}
        >
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">タイトル:</span>
              <span className="ml-2 font-medium">{project.title}</span>
            </div>
            <div>
              <span className="text-muted-foreground">アスペクト比:</span>
              <span className="ml-2 font-medium">{project.aspectRatio}</span>
            </div>
            <div>
              <span className="text-muted-foreground">解像度:</span>
              <span className="ml-2 font-medium">
                {project.resolutionWidth}x{project.resolutionHeight}
              </span>
            </div>
          </div>
        </StepCard>

        {/* Step 2: Planning */}
        <StepCard
          stepNumber={2}
          title="企画書"
          description="AIと対話して企画書を作成します"
          status={getStepStatus(project.status, 'planning')}
          isExpanded={expandedStep === 2}
          onToggle={() => handleToggleStep(2)}
          canEdit={true}
        >
          <div className="text-sm text-muted-foreground">
            {project.planning ? (
              <div className="prose prose-sm max-w-none">
                <p>企画書が作成されています。</p>
              </div>
            ) : (
              <p>チャットUIで企画書を作成してください。（E4で実装予定）</p>
            )}
          </div>
        </StepCard>

        {/* Step 3: Script */}
        <StepCard
          stepNumber={3}
          title="台本"
          description="企画書を元にシーン構成の台本を作成します"
          status={getStepStatus(project.status, 'script')}
          isExpanded={expandedStep === 3}
          onToggle={() => handleToggleStep(3)}
          canEdit={true}
        >
          <div className="text-sm text-muted-foreground">
            {project.script ? (
              <p>台本が作成されています。シーン数: {project.script.scenes.length}</p>
            ) : (
              <p>チャットUIで台本を作成してください。（E5で実装予定）</p>
            )}
          </div>
        </StepCard>

        {/* Step 4-6: Assets (3-column) */}
        <StepCard
          stepNumber={4}
          title="素材生成"
          description="音声・字幕・画像を並列生成します"
          status={getStepStatus(project.status, 'assets')}
          isExpanded={expandedStep === 4}
          onToggle={() => handleToggleStep(4)}
        >
          <div className="text-sm text-muted-foreground">
            <p>3列並列表示で素材を生成します。（E6で実装予定）</p>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <div className="border rounded-lg p-4">
                <h4 className="font-medium">音声合成</h4>
                <p className="text-xs mt-1">シーンごとの音声を生成</p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium">字幕生成</h4>
                <p className="text-xs mt-1">字幕画像を生成</p>
              </div>
              <div className="border rounded-lg p-4">
                <h4 className="font-medium">画像生成</h4>
                <p className="text-xs mt-1">シーン画像を生成</p>
              </div>
            </div>
          </div>
        </StepCard>

        {/* Step 7: Compose */}
        <StepCard
          stepNumber={5}
          title="動画合成"
          description="生成した素材から動画を合成します"
          status={getStepStatus(project.status, 'compose')}
          isExpanded={expandedStep === 5}
          onToggle={() => handleToggleStep(5)}
        >
          <div className="text-sm text-muted-foreground">
            {project.composedVideo ? (
              <p>動画が合成されています。</p>
            ) : (
              <p>素材生成完了後、動画を合成できます。（E7で実装予定）</p>
            )}
          </div>
        </StepCard>

        {/* Step 8: Publish Text */}
        <StepCard
          stepNumber={6}
          title="公開テキスト"
          description="動画タイトルとディスクリプションを生成します"
          status={project.publishText ? 'completed' : 'pending'}
          isExpanded={expandedStep === 6}
          onToggle={() => handleToggleStep(6)}
          canEdit={true}
        >
          <div className="text-sm text-muted-foreground">
            {project.publishText ? (
              <div className="space-y-2">
                <p>
                  <span className="font-medium">タイトル:</span> {project.publishText.title}
                </p>
                <p>
                  <span className="font-medium">説明:</span> {project.publishText.description}
                </p>
              </div>
            ) : (
              <p>動画合成完了後、公開テキストを生成できます。（E7で実装予定）</p>
            )}
          </div>
        </StepCard>
      </div>
    </div>
  );
}
