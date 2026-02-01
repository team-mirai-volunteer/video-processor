'use client';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
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
  Save,
  Type,
  Volume2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
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
  // 音声カラム用の編集機能
  onVoiceTextSave?: (sceneId: string, newVoiceText: string) => Promise<void>;
  isVoiceTextSaving?: boolean;
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

/** Photoshop風の市松模様背景スタイル（透明度表示用） */
const checkerboardStyle: React.CSSProperties = {
  backgroundImage: `
    linear-gradient(45deg, #ccc 25%, transparent 25%),
    linear-gradient(-45deg, #ccc 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #ccc 75%),
    linear-gradient(-45deg, transparent 75%, #ccc 75%)
  `,
  backgroundSize: '8px 8px',
  backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
  backgroundColor: '#fff',
};

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
  onVoiceTextSave,
  isVoiceTextSaving,
}: SceneAssetItemProps) {
  const [showPreview, setShowPreview] = useState(false);
  // 音声テキスト編集用のローカル状態
  const [editingVoiceText, setEditingVoiceText] = useState(scene.voiceText ?? '');
  const hasVoiceTextChanges = editingVoiceText !== (scene.voiceText ?? '');

  // scene.voiceText が外部から変更された場合に同期
  useEffect(() => {
    setEditingVoiceText(scene.voiceText ?? '');
  }, [scene.voiceText]);

  const handleVoiceTextSave = async () => {
    if (onVoiceTextSave && hasVoiceTextChanges) {
      await onVoiceTextSave(scene.id, editingVoiceText);
    }
  };

  // 画像カラムでimage_gen以外の場合はスキップ
  const isImageColumn = columnType === 'image';
  const isImageGenType = scene.visualType === 'image_gen';
  // imagePromptStateから生成済みプロンプトを取得（未生成の場合はsceneのプロンプトを使用）
  const generatedPrompt = imagePromptState?.imagePrompt ?? scene.imagePrompt;
  const hasImagePrompt = !!generatedPrompt;
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
        // 字幕は複数画像を横スクロールで表示（市松模様背景）
        if (state.assets && state.assets.length > 0) {
          return (
            <div className="overflow-x-auto">
              <div className="flex gap-2" style={{ width: 'max-content' }}>
                {state.assets.map((asset, index) => (
                  <div
                    key={asset.id}
                    className="rounded shrink-0"
                    style={{ ...checkerboardStyle, width: '80px' }}
                  >
                    <img
                      src={asset.fileUrl}
                      alt={`シーン ${scene.order + 1} - 字幕 ${index + 1}`}
                      className="h-auto w-full rounded object-contain"
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return (
          <div className="rounded" style={{ ...checkerboardStyle, width: '80px' }}>
            <img
              src={state.asset.fileUrl}
              alt={`シーン ${scene.order + 1} - 字幕`}
              className="h-auto w-full rounded object-contain"
            />
          </div>
        );
      case 'image':
        return (
          <img
            src={state.asset.fileUrl}
            alt={`シーン ${scene.order + 1} - 画像`}
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

  // 画像カラムでimage_genタイプの場合は専用UIを使う（左右分離レイアウト）
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

        {/* 左右分離レイアウト: 左=プロンプト、右=画像 */}
        <div className="flex gap-3">
          {/* 左側: プロンプト専用 */}
          <div className="flex-1 min-w-0 border-r border-dashed pr-3">
            {/* ヘッダー行 */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1">
                {hasImagePrompt ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : isPromptGenerating ? (
                  <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">①</span>
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
            {/* プロンプトプレビュー */}
            <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2 min-h-[4rem]">
              {hasImagePrompt ? (
                <span className="whitespace-pre-wrap break-words">{generatedPrompt}</span>
              ) : (
                <span className="italic">プロンプト未設定</span>
              )}
            </div>
          </div>

          {/* 右側: 画像専用 */}
          <div className="flex-1 min-w-0">
            {/* ヘッダー行 */}
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-1">
                {hasImage ? (
                  <Check className="h-3 w-3 text-green-500" />
                ) : isImageGenerating ? (
                  <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />
                ) : (
                  <Circle className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="text-xs text-muted-foreground">②</span>
              </div>
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
            {/* 画像プレビュー */}
            <div className="flex justify-center">
              {hasImage && state.asset ? (
                <img
                  src={state.asset.fileUrl}
                  alt={`シーン ${scene.order + 1} - 画像`}
                  className="h-auto rounded object-contain max-h-28 border"
                />
              ) : (
                <div className="w-full h-[4rem] rounded border border-dashed flex items-center justify-center bg-muted/30">
                  <ImageIcon className="h-6 w-6 text-muted-foreground/50" />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* エラー表示 */}
        {state.error && (
          <div className="mt-2 text-xs text-destructive bg-destructive/10 p-1.5 rounded">
            {state.error}
          </div>
        )}
      </div>
    );
  }

  // 音声カラムの場合は編集可能なUIを表示
  if (columnType === 'voice') {
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
        {/* ヘッダー */}
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5">
            <StatusIcon status={isSkipped ? 'completed' : state.status} />
            <ColumnIcon type={columnType} />
            <span className="font-medium text-xs">シーン {scene.order + 1}</span>
            {state.asset?.durationMs && (
              <span className="text-xs text-muted-foreground">
                ({formatDuration(state.asset.durationMs)})
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {/* 保存ボタン（変更がある場合のみ表示） */}
            {onVoiceTextSave && hasVoiceTextChanges && (
              <Button
                size="sm"
                variant="default"
                className="h-6 px-2 text-xs"
                onClick={handleVoiceTextSave}
                disabled={isVoiceTextSaving}
                title="保存"
              >
                {isVoiceTextSaving ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Save className="h-3 w-3 mr-1" />
                    保存
                  </>
                )}
              </Button>
            )}
            {/* 再生成ボタン（保存済みで変更がない場合のみ有効） */}
            {state.status === 'completed' && onRegenerate && !isSkipped && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 w-6 p-0"
                onClick={onRegenerate}
                disabled={hasVoiceTextChanges}
                title={hasVoiceTextChanges ? '先に保存してください' : '再生成'}
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

        {/* 編集可能なテキストエリア */}
        <Textarea
          value={editingVoiceText}
          onChange={(e) => setEditingVoiceText(e.target.value)}
          placeholder="読み上げるテキストを入力..."
          className="text-xs min-h-[60px] resize-none"
          disabled={isVoiceTextSaving || state.status === 'running'}
        />

        {state.error && (
          <div className="mt-1.5 text-xs text-destructive bg-destructive/10 p-1.5 rounded">
            {state.error}
          </div>
        )}

        {/* 音声プレーヤー */}
        {state.status === 'completed' && state.asset && (
          <div className="mt-2">
            {/* biome-ignore lint/a11y/useMediaCaption: Captions not available for generated audio preview */}
            <audio src={state.asset.fileUrl} controls className="w-full h-8" preload="metadata" />
          </div>
        )}
      </div>
    );
  }

  // 画像カラム以外（subtitle）または画像カラムでimage_gen以外の場合
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
          {/* プレビューボタン */}
          {state.status === 'completed' && state.asset && (
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

      {showPreview && state.asset && (
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
