'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { ReferenceCharacter } from '@video-processor/shared';
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
import { useCallback, useEffect, useState } from 'react';
import { StepCard, type StepStatus } from '../step-card';
import { ReferenceCharacterUploader } from './reference-character-uploader';
import { SceneAssetItem } from './scene-asset-item';
import type {
  AssetColumnData,
  AssetGenerationStatus,
  GenerateAllAssetsResponse,
  GenerateAllImagePromptsResponse,
  GenerateImagePromptResponse,
  GenerateImageResponse,
  GenerateSubtitleResponse,
  GenerateVoiceResponse,
  ImagePromptState,
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
  initialReferenceCharacters?: ReferenceCharacter[];
  onVoiceGenerate?: (sceneId: string) => Promise<GenerateVoiceResponse>;
  onSubtitleGenerate?: (sceneId: string) => Promise<GenerateSubtitleResponse>;
  onImageGenerate?: (sceneId: string) => Promise<GenerateImageResponse>;
  onImagePromptGenerate?: (sceneId: string) => Promise<GenerateImagePromptResponse>;
  onAllVoicesGenerate?: () => Promise<GenerateAllAssetsResponse>;
  onAllSubtitlesGenerate?: () => Promise<GenerateAllAssetsResponse>;
  onAllImagesGenerate?: () => Promise<GenerateAllAssetsResponse>;
  onAllImagePromptsGenerate?: (styleHint?: string) => Promise<GenerateAllImagePromptsResponse>;
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
  // 画像カラム専用
  imagePromptStates?: Record<string, ImagePromptState>;
  onGenerateImagePrompt?: (sceneId: string) => void;
  onGenerateImage?: (sceneId: string) => void;
  onGenerateAllImagePrompts?: () => void;
  isGeneratingImagePrompts?: boolean;
  // 追加指示用
  styleHint?: string;
  onStyleHintChange?: (value: string) => void;
}

function AssetColumn({
  column,
  scenes,
  onGenerate,
  onRetryItem,
  disabled,
  imagePromptStates,
  onGenerateImagePrompt,
  onGenerateImage,
  onGenerateAllImagePrompts,
  isGeneratingImagePrompts,
  styleHint,
  onStyleHintChange,
}: AssetColumnProps) {
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

  // 画像カラム専用：プロンプト生成状態の計算
  const isImageColumn = column.id === 'image';
  const imageGenScenes = scenes.filter((s) => s.visualType === 'image_gen');
  const promptCompletedCount = imageGenScenes.filter(
    (s) => imagePromptStates?.[s.id]?.status === 'completed' || s.imagePrompt
  ).length;
  const allPromptsCompleted =
    promptCompletedCount === imageGenScenes.length && imageGenScenes.length > 0;
  const hasPromptsForImageGen = imageGenScenes.some(
    (s) => imagePromptStates?.[s.id]?.status === 'completed' || s.imagePrompt
  );

  return (
    <div className="border rounded-lg p-3 bg-card">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ColumnIcon type={column.id} />
          <h4 className="font-medium text-sm">{column.title}</h4>
        </div>
        {isImageColumn ? (
          <div className="flex gap-1">
            <Button
              size="sm"
              variant={allPromptsCompleted ? 'outline' : 'default'}
              onClick={onGenerateAllImagePrompts}
              disabled={disabled || isGeneratingImagePrompts || imageGenScenes.length === 0}
              className="h-7 text-xs"
            >
              {isGeneratingImagePrompts && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {isGeneratingImagePrompts
                ? '生成中...'
                : allPromptsCompleted
                  ? 'プロンプト再生成'
                  : 'プロンプト一括生成'}
            </Button>
            <Button
              size="sm"
              variant={allCompleted ? 'outline' : 'default'}
              onClick={onGenerate}
              disabled={disabled || column.isGenerating || !hasPromptsForImageGen}
              className="h-7 text-xs"
            >
              {column.isGenerating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
              {column.isGenerating ? '生成中...' : allCompleted ? '画像再生成' : '画像一括生成'}
            </Button>
          </div>
        ) : (
          <Button
            size="sm"
            variant={allCompleted ? 'outline' : 'default'}
            onClick={onGenerate}
            disabled={disabled || column.isGenerating || !column.canGenerate}
            className="h-7 text-xs"
          >
            {column.isGenerating && <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />}
            {column.isGenerating ? '生成中...' : allCompleted ? '再生成' : '一括生成'}
          </Button>
        )}
      </div>

      {isImageColumn && onStyleHintChange && (
        <div className="mb-3">
          <Textarea
            placeholder="追加の指示（例：アニメ調で、明るい雰囲気で、キャラクターは黒髪のショートカット等）"
            value={styleHint ?? ''}
            onChange={(e) => onStyleHintChange(e.target.value)}
            className="text-xs min-h-[60px] resize-none"
            disabled={disabled || isGeneratingImagePrompts}
          />
        </div>
      )}

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
          const isImageColumn = column.id === 'image';
          return (
            <SceneAssetItem
              key={scene.id}
              scene={scene}
              state={sceneState}
              columnType={column.id}
              onRetry={() => onRetryItem(scene.id)}
              onRegenerate={() => onRetryItem(scene.id)}
              // 画像カラム専用props
              imagePromptState={isImageColumn ? imagePromptStates?.[scene.id] : undefined}
              onGeneratePrompt={
                isImageColumn && onGenerateImagePrompt
                  ? () => onGenerateImagePrompt(scene.id)
                  : undefined
              }
              onGenerateImage={
                isImageColumn && onGenerateImage ? () => onGenerateImage(scene.id) : undefined
              }
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
  initialReferenceCharacters = [],
  onVoiceGenerate,
  onSubtitleGenerate,
  onImageGenerate,
  onImagePromptGenerate,
  onAllVoicesGenerate,
  onAllSubtitlesGenerate,
  onAllImagesGenerate,
  onAllImagePromptsGenerate,
}: AssetGenerationStepProps) {
  const [referenceCharacters, setReferenceCharacters] = useState<ReferenceCharacter[]>(
    initialReferenceCharacters
  );
  const [styleHint, setStyleHint] = useState<string>('');

  const {
    state,
    columns,
    overallStatus,
    isAllCompleted,
    isGeneratingImagePrompts,
    generateVoice,
    generateSubtitle,
    generateImage,
    generateImagePrompt,
    generateAllVoices,
    generateAllSubtitles,
    generateAllImages,
    generateAllImagePrompts,
    loadExistingAssets,
    reset,
  } = useAssetGeneration({
    projectId,
    scenes,
    onVoiceGenerate,
    onSubtitleGenerate,
    onImageGenerate,
    onImagePromptGenerate,
    onAllVoicesGenerate,
    onAllSubtitlesGenerate,
    onAllImagesGenerate,
    onAllImagePromptsGenerate,
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
          {/* Reference Character Uploader */}
          <ReferenceCharacterUploader
            projectId={projectId}
            characters={referenceCharacters}
            onCharactersChange={setReferenceCharacters}
          />

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {columns.map((column) => (
              <AssetColumn
                key={column.id}
                column={column}
                scenes={scenes}
                onGenerate={() => handleColumnGenerate(column.id)}
                onRetryItem={(sceneId) => handleRetryItem(column.id, sceneId)}
                disabled={!canStart && overallStatus === 'pending'}
                // 画像カラム専用props
                imagePromptStates={column.id === 'image' ? state.imagePrompt : undefined}
                onGenerateImagePrompt={column.id === 'image' ? generateImagePrompt : undefined}
                onGenerateImage={column.id === 'image' ? generateImage : undefined}
                onGenerateAllImagePrompts={
                  column.id === 'image' ? () => generateAllImagePrompts(styleHint) : undefined
                }
                isGeneratingImagePrompts={
                  column.id === 'image' ? isGeneratingImagePrompts : undefined
                }
                styleHint={column.id === 'image' ? styleHint : undefined}
                onStyleHintChange={column.id === 'image' ? setStyleHint : undefined}
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
