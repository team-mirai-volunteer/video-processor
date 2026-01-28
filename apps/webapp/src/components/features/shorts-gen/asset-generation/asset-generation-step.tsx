'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Check,
  Circle,
  Image as ImageIcon,
  Loader2,
  RefreshCw,
  Type,
  Volume2,
} from 'lucide-react';
import { useCallback, useEffect } from 'react';
import { StepCard, type StepStatus } from '../step-card';
import { SceneAssetItem } from './scene-asset-item';
import type {
  AssetColumnData,
  AssetGenerationStatus,
  GenerateAllAssetsResponse,
  GenerateImageResponse,
  GenerateSubtitleResponse,
  GenerateVoiceResponse,
  Scene,
  SceneAsset,
} from './types';
import { useAssetGeneration } from './use-asset-generation';

export interface AssetGenerationStepProps {
  projectId: string;
  scenes: Scene[];
  isExpanded: boolean;
  onToggle: () => void;
  onComplete?: () => void;
  canStart?: boolean;
  existingAssets?: {
    voice: SceneAsset[];
    subtitle: SceneAsset[];
    image: SceneAsset[];
  };
  onVoiceGenerate?: (sceneId: string) => Promise<GenerateVoiceResponse>;
  onSubtitleGenerate?: (sceneId: string) => Promise<GenerateSubtitleResponse>;
  onImageGenerate?: (sceneId: string) => Promise<GenerateImageResponse>;
  onAllVoicesGenerate?: () => Promise<GenerateAllAssetsResponse>;
  onAllSubtitlesGenerate?: () => Promise<GenerateAllAssetsResponse>;
  onAllImagesGenerate?: () => Promise<GenerateAllAssetsResponse>;
}

function StatusIcon({ status }: { status: AssetGenerationStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
}

function ColumnIcon({ type }: { type: AssetColumnData['id'] }) {
  switch (type) {
    case 'voice':
      return <Volume2 className="h-4 w-4" />;
    case 'subtitle':
      return <Type className="h-4 w-4" />;
    case 'image':
      return <ImageIcon className="h-4 w-4" />;
  }
}

function mapToStepStatus(status: AssetGenerationStatus, canStart: boolean): StepStatus {
  if (status === 'pending' && canStart) return 'ready';
  return status as StepStatus;
}

interface AssetColumnProps {
  column: AssetColumnData;
  scenes: Scene[];
  onGenerate: () => void;
  onRetryItem: (sceneId: string) => void;
  disabled?: boolean;
}

function AssetColumn({ column, scenes, onGenerate, onRetryItem, disabled }: AssetColumnProps) {
  const completedCount = column.scenes.filter((s) => s.status === 'completed').length;
  const totalCount = column.scenes.length;
  const hasErrors = column.scenes.some((s) => s.status === 'error');
  const allCompleted = completedCount === totalCount && totalCount > 0;

  const needsGenerationCount = scenes.filter((scene) => {
    switch (column.id) {
      case 'voice':
        return !!scene.voiceText;
      case 'subtitle':
        return scene.subtitles.length > 0;
      case 'image':
        return scene.visualType === 'image_gen';
    }
  }).length;

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ColumnIcon type={column.id} />
          <h4 className="font-medium text-sm">{column.title}</h4>
        </div>
        <Button
          size="sm"
          variant={allCompleted ? 'outline' : 'default'}
          onClick={onGenerate}
          disabled={disabled || column.isGenerating || !column.canGenerate}
          className="h-7 text-xs"
        >
          {column.isGenerating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
          {column.isGenerating ? '生成中...' : allCompleted ? '再生成' : '生成'}
        </Button>
      </div>

      {totalCount > 0 && needsGenerationCount > 0 && (
        <div className="mb-3 space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedCount} / {totalCount} 完了
            </span>
            {hasErrors && <span className="text-destructive">エラーあり</span>}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                hasErrors ? 'bg-destructive' : 'bg-green-500'
              )}
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {scenes.map((scene, index) => {
          const sceneState = column.scenes[index];
          if (!sceneState) return null;
          return (
            <SceneAssetItem
              key={scene.id}
              scene={scene}
              state={sceneState}
              columnType={column.id}
              onRetry={() => onRetryItem(scene.id)}
            />
          );
        })}
      </div>

      {scenes.length === 0 && (
        <p className="text-sm text-muted-foreground py-4 text-center">シーンがありません</p>
      )}
    </div>
  );
}

export function AssetGenerationStep({
  projectId,
  scenes,
  isExpanded,
  onToggle,
  onComplete,
  canStart = false,
  existingAssets,
  onVoiceGenerate,
  onSubtitleGenerate,
  onImageGenerate,
  onAllVoicesGenerate,
  onAllSubtitlesGenerate,
  onAllImagesGenerate,
}: AssetGenerationStepProps) {
  const {
    columns,
    overallStatus,
    isAllCompleted,
    generateVoice,
    generateSubtitle,
    generateImage,
    generateAllVoices,
    generateAllSubtitles,
    generateAllImages,
    loadExistingAssets,
    reset,
  } = useAssetGeneration({
    projectId,
    scenes,
    onVoiceGenerate,
    onSubtitleGenerate,
    onImageGenerate,
    onAllVoicesGenerate,
    onAllSubtitlesGenerate,
    onAllImagesGenerate,
  });

  useEffect(() => {
    if (existingAssets) {
      loadExistingAssets(existingAssets);
    }
  }, [existingAssets, loadExistingAssets]);

  useEffect(() => {
    if (isAllCompleted && onComplete) {
      onComplete();
    }
  }, [isAllCompleted, onComplete]);

  const handleColumnGenerate = useCallback(
    (columnId: AssetColumnData['id']) => {
      switch (columnId) {
        case 'voice':
          generateAllVoices();
          break;
        case 'subtitle':
          generateAllSubtitles();
          break;
        case 'image':
          generateAllImages();
          break;
      }
    },
    [generateAllVoices, generateAllSubtitles, generateAllImages]
  );

  const handleRetryItem = useCallback(
    (columnId: AssetColumnData['id'], sceneId: string) => {
      switch (columnId) {
        case 'voice':
          generateVoice(sceneId);
          break;
        case 'subtitle':
          generateSubtitle(sceneId);
          break;
        case 'image':
          generateImage(sceneId);
          break;
      }
    },
    [generateVoice, generateSubtitle, generateImage]
  );

  const handleRegenerate = useCallback(() => {
    reset();
  }, [reset]);

  const stepStatus = mapToStepStatus(overallStatus, canStart);

  const getProgressMessage = (): string | null => {
    const runningColumns = columns.filter((c) => c.isGenerating);
    if (runningColumns.length === 0) return null;
    const names = runningColumns.map((c) => {
      switch (c.id) {
        case 'voice':
          return '音声';
        case 'subtitle':
          return '字幕';
        case 'image':
          return '画像';
      }
    });
    return `${names.join('・')}を生成中...`;
  };

  return (
    <StepCard
      stepNumber={4}
      title="素材生成"
      description="音声・字幕・画像を生成します。各列は並列で実行できます。"
      status={stepStatus}
      isExpanded={isExpanded}
      onToggle={onToggle}
      onRegenerate={handleRegenerate}
      canRegenerate={overallStatus === 'completed' || overallStatus === 'error'}
      progressMessage={getProgressMessage()}
    >
      {scenes.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <p>シーンがありません。</p>
          <p className="text-sm mt-1">先に③台本生成を完了してください。</p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map((column) => (
              <AssetColumn
                key={column.id}
                column={column}
                scenes={scenes}
                onGenerate={() => handleColumnGenerate(column.id)}
                onRetryItem={(sceneId) => handleRetryItem(column.id, sceneId)}
                disabled={!canStart && overallStatus === 'pending'}
              />
            ))}
          </div>

          {overallStatus !== 'pending' && (
            <div className="border-t pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <StatusIcon status={overallStatus} />
                  <span>
                    {overallStatus === 'running' && '生成中...'}
                    {overallStatus === 'completed' && 'すべての素材が生成されました'}
                    {overallStatus === 'error' && '一部の素材でエラーが発生しました'}
                  </span>
                </div>
                {overallStatus === 'error' && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      for (const column of columns) {
                        for (const state of column.scenes) {
                          if (state.status === 'error') {
                            handleRetryItem(column.id, state.sceneId);
                          }
                        }
                      }
                    }}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    エラーを再試行
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </StepCard>
  );
}
