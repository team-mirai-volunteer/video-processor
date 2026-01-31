'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Check,
  Circle,
  Image as ImageIcon,
  Loader2,
  Pencil,
  Play,
  RefreshCw,
  Type,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';
import type { AssetColumnData, ImagePromptState, Scene, SceneAssetState } from './types';

interface SceneAssetItemProps {
  scene: Scene;
  state: SceneAssetState;
  columnType: AssetColumnData['id'];
  onRetry?: () => void;
  onRegenerate?: () => void;
  onPreview?: () => void;
  // 画像カラム専用
  imagePromptState?: ImagePromptState;
  onGeneratePrompt?: () => void;
  onGenerateImage?: () => void;
}

function StatusIcon({ status }: { status: SceneAssetState['status'] }) {
  switch (status) {
    case 'pending':
      return <Circle className="h-3.5 w-3.5 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="h-3.5 w-3.5 text-blue-500 animate-spin" />;
    case 'completed':
      return <Check className="h-3.5 w-3.5 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-3.5 w-3.5 text-destructive" />;
  }
}

function ColumnIcon({ type }: { type: AssetColumnData['id'] }) {
  switch (type) {
    case 'voice':
      return <Volume2 className="h-3.5 w-3.5" />;
    case 'subtitle':
      return <Type className="h-3.5 w-3.5" />;
    case 'image':
      return <ImageIcon className="h-3.5 w-3.5" />;
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '';
  const seconds = Math.round(ms / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return mins > 0 ? `${mins}:${secs.toString().padStart(2, '0')}` : `${secs}秒`;
}

export function SceneAssetItem({
  scene,
  state,
  columnType,
  onRetry,
  onRegenerate,
  onPreview,
  imagePromptState,
  onGeneratePrompt,
  onGenerateImage,
}: SceneAssetItemProps) {
  const [showPreview, setShowPreview] = useState(false);

  // 画像カラムでimage_gen以外の場合はスキップ
  const isImageColumn = columnType === 'image';
  const isImageGenType = scene.visualType === 'image_gen';
  const hasImagePrompt = !!scene.imagePrompt;
  const isPromptGenerating = imagePromptState?.status === 'running';
  const isImageGenerating = state.status === 'running';

  const handlePreview = () => {
    if (onPreview) {
      onPreview();
    } else {
      setShowPreview(true);
    }
  };

  const getPreviewContent = () => {
    if (!state.asset) return null;

    switch (columnType) {
      case 'voice':
        return (
          // biome-ignore lint/a11y/useMediaCaption: Captions not available for generated audio preview
          <audio src={state.asset.fileUrl} controls className="w-full h-8" preload="metadata" />
        );
      case 'subtitle':
      case 'image':
        return (
          <img
            src={state.asset.fileUrl}
            alt={`シーン ${scene.order + 1} - ${columnType === 'subtitle' ? '字幕' : '画像'}`}
            className="w-full h-auto rounded object-contain max-h-24"
          />
        );
      default:
        return null;
    }
  };

  const getDescription = () => {
    switch (columnType) {
      case 'voice':
        return scene.voiceText
          ? `${scene.voiceText.slice(0, 30)}${scene.voiceText.length > 30 ? '...' : ''}`
          : '(無音)';
      case 'subtitle':
        return scene.subtitles.length > 0 ? `${scene.subtitles.length}枚の字幕` : '字幕なし';
      case 'image':
        if (scene.visualType === 'image_gen') {
          return scene.imagePrompt
            ? `${scene.imagePrompt.slice(0, 30)}${scene.imagePrompt.length > 30 ? '...' : ''}`
            : 'プロンプト未設定';
        }
        return scene.visualType === 'stock_video' ? 'ストック動画' : '単色背景';
    }
  };

  const needsGeneration = () => {
    switch (columnType) {
      case 'voice':
        return !!scene.voiceText;
      case 'subtitle':
        return scene.subtitles.length > 0;
      case 'image':
        return scene.visualType === 'image_gen';
    }
  };

  const isSkipped = !needsGeneration();
  const hasImage = state.status === 'completed' && !!state.asset;

  // 画像カラムでimage_genタイプの場合は専用UIを使う
  if (isImageColumn && isImageGenType) {
    return (
      <div
        className={cn(
          'p-3 rounded-md text-sm border',
          state.status === 'error' && 'border-destructive bg-destructive/5',
          state.status === 'completed' && 'border-green-200 bg-green-50/50',
          (state.status === 'running' || isPromptGenerating) && 'border-blue-200 bg-blue-50/50'
        )}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-1.5 mb-2">
          <ImageIcon className="h-3.5 w-3.5" />
          <span className="font-medium text-xs">シーン {scene.order + 1}</span>
        </div>

        {/* ① プロンプト行 */}
        <div className="flex items-center justify-between gap-2 py-1.5 border-b border-dashed">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-1 shrink-0">
              {hasImagePrompt ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : isPromptGenerating ? (
                <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">①</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs truncate block">
                {hasImagePrompt
                  ? `${scene.imagePrompt?.slice(0, 40)}${(scene.imagePrompt?.length ?? 0) > 40 ? '...' : ''}`
                  : 'プロンプト未設定'}
              </span>
            </div>
          </div>
          {onGeneratePrompt && (
            <Button
              size="sm"
              variant={hasImagePrompt ? 'ghost' : 'outline'}
              className={hasImagePrompt ? 'h-6 px-2 text-xs' : 'h-7 text-xs'}
              onClick={onGeneratePrompt}
              disabled={isPromptGenerating || isImageGenerating}
              title={hasImagePrompt ? 'プロンプト再生成' : undefined}
            >
              {isPromptGenerating ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : hasImagePrompt ? (
                <RefreshCw className="h-3 w-3" />
              ) : (
                <>
                  <Pencil className="h-3 w-3" />
                  <span className="ml-1">生成</span>
                </>
              )}
            </Button>
          )}
        </div>

        {/* ② 画像行 */}
        <div className="flex items-center justify-between gap-2 pt-1.5">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="flex items-center gap-1 shrink-0">
              {hasImage ? (
                <Check className="h-3 w-3 text-green-500" />
              ) : isImageGenerating ? (
                <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
              ) : (
                <Circle className="h-3 w-3 text-muted-foreground" />
              )}
              <span className="text-xs text-muted-foreground">②</span>
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-xs text-muted-foreground">
                {hasImage ? '生成済み' : hasImagePrompt ? '画像未生成' : '(①完了後に実行可能)'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasImage && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={handlePreview}
                title="プレビュー"
              >
                <Play className="h-3 w-3" />
              </Button>
            )}
            {onGenerateImage && (
              <Button
                size="sm"
                variant={hasImage ? 'ghost' : 'outline'}
                className={hasImage ? 'h-6 px-2 text-xs' : 'h-7 text-xs'}
                onClick={onGenerateImage}
                disabled={!hasImagePrompt || isPromptGenerating || isImageGenerating}
                title={hasImage ? '画像再生成' : undefined}
              >
                {isImageGenerating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : hasImage ? (
                  <RefreshCw className="h-3 w-3" />
                ) : (
                  <>
                    <ImageIcon className="h-3 w-3" />
                    <span className="ml-1">生成</span>
                  </>
                )}
              </Button>
            )}
          </div>
        </div>

        {/* エラー表示 */}
        {state.error && (
          <div className="mt-2 text-xs text-destructive bg-destructive/10 p-1.5 rounded">
            {state.error}
          </div>
        )}

        {/* プレビュー */}
        {showPreview && state.asset && (
          <div className="mt-2 p-2 bg-muted/50 rounded">
            <img
              src={state.asset.fileUrl}
              alt={`シーン ${scene.order + 1} - 画像`}
              className="w-full h-auto rounded object-contain max-h-24"
            />
            <Button
              size="sm"
              variant="ghost"
              className="w-full mt-1 h-6 text-xs"
              onClick={() => setShowPreview(false)}
            >
              閉じる
            </Button>
          </div>
        )}
      </div>
    );
  }

  // 画像カラム以外（voice, subtitle）または画像カラムでimage_gen以外の場合
  return (
    <div
      className={cn(
        'p-2 rounded-md text-sm border',
        state.status === 'error' && 'border-destructive bg-destructive/5',
        state.status === 'completed' && 'border-green-200 bg-green-50/50',
        state.status === 'running' && 'border-blue-200 bg-blue-50/50',
        isSkipped && 'border-dashed opacity-60'
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
            <StatusIcon status={isSkipped ? 'completed' : state.status} />
            <ColumnIcon type={columnType} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="font-medium text-xs truncate">シーン {scene.order + 1}</div>
            <div className="text-xs text-muted-foreground truncate">
              {isSkipped ? '(スキップ)' : getDescription()}
            </div>
            {state.asset?.durationMs && (
              <div className="text-xs text-muted-foreground">
                {formatDuration(state.asset.durationMs)}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {/* プレビューボタン (voiceは別でaudioプレーヤー表示) */}
          {state.status === 'completed' && state.asset && columnType !== 'voice' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={handlePreview}
              title="プレビュー"
            >
              <Play className="h-3 w-3" />
            </Button>
          )}
          {/* 再生成ボタン */}
          {state.status === 'completed' && onRegenerate && !isSkipped && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onRegenerate}
              title="再生成"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
          {state.status === 'error' && onRetry && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={onRetry}
              title="再試行"
            >
              <RefreshCw className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {state.error && (
        <div className="mt-1.5 text-xs text-destructive bg-destructive/10 p-1.5 rounded">
          {state.error}
        </div>
      )}

      {columnType === 'voice' && state.status === 'completed' && state.asset && (
        <div className="mt-2">
          {/* biome-ignore lint/a11y/useMediaCaption: Captions not available for generated audio preview */}
          <audio src={state.asset.fileUrl} controls className="w-full h-8" preload="metadata" />
        </div>
      )}

      {showPreview && state.asset && columnType !== 'voice' && (
        <div className="mt-2 p-2 bg-muted/50 rounded">
          {getPreviewContent()}
          <Button
            size="sm"
            variant="ghost"
            className="w-full mt-1 h-6 text-xs"
            onClick={() => setShowPreview(false)}
          >
            閉じる
          </Button>
        </div>
      )}
    </div>
  );
}
