'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { getClipComposeStatus } from '@/server/presentation/clip-video/actions/composeSubtitledClip';
import type {
  ComposeProgressPhase,
  ComposeStatus,
  OutlineColor,
  OutputFormat,
  PaddingColor,
  SubtitleFontSize,
} from '@video-processor/shared';
import {
  AlertTriangle,
  CheckCircle,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  Video,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

function useElapsedTime(isRunning: boolean): number {
  const [elapsed, setElapsed] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now();
      setElapsed(0);
      const interval = setInterval(() => {
        if (startTimeRef.current) {
          setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }
      }, 1000);
      return () => clearInterval(interval);
    }
    startTimeRef.current = null;
    setElapsed(0);
    return undefined;
  }, [isRunning]);

  return elapsed;
}

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getPhaseLabel(phase: ComposeProgressPhase | null): string {
  switch (phase) {
    case 'downloading':
      return '動画をダウンロード中...';
    case 'converting':
      return 'フォーマット変換中...';
    case 'composing':
      return '字幕を合成中...';
    case 'uploading':
      return 'アップロード中...';
    default:
      return '処理中...';
  }
}

type CompositionStep = 'idle' | 'composing' | 'composed' | 'uploading' | 'uploaded';

interface SubtitleCompositionStatusProps {
  clipId: string;
  clipDurationSeconds?: number;
  step: CompositionStep;
  subtitledVideoUrl?: string | null;
  subtitledVideoDriveUrl?: string | null;
  onCompose?: (
    outputFormat?: OutputFormat,
    paddingColor?: PaddingColor,
    outlineColor?: OutlineColor,
    fontSize?: SubtitleFontSize
  ) => void;
  onUpload?: () => void;
  onComposeComplete?: (subtitledVideoUrl: string | null) => void;
  isComposing?: boolean;
  isUploading?: boolean;
  canCompose?: boolean;
  exceedsMaxDuration?: boolean;
  initialComposeStatus?: ComposeStatus | null;
  initialProgressPhase?: ComposeProgressPhase | null;
  initialProgressPercent?: number | null;
}

export function SubtitleCompositionStatus({
  clipId,
  clipDurationSeconds,
  step,
  subtitledVideoUrl,
  subtitledVideoDriveUrl,
  onCompose,
  onUpload,
  onComposeComplete,
  isComposing = false,
  isUploading = false,
  canCompose = false,
  exceedsMaxDuration = false,
  initialComposeStatus = null,
  initialProgressPhase = null,
  initialProgressPercent = null,
}: SubtitleCompositionStatusProps) {
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('original');
  const [paddingColor, setPaddingColor] = useState<PaddingColor>('#000000');
  const [outlineColor, setOutlineColor] = useState<OutlineColor>('#30bca7');
  const [fontSize, setFontSize] = useState<SubtitleFontSize>('large');

  // Progress polling state
  const [composeStatus, setComposeStatus] = useState<ComposeStatus | null>(initialComposeStatus);
  const [progressPhase, setProgressPhase] = useState<ComposeProgressPhase | null>(
    initialProgressPhase
  );
  const [progressPercent, setProgressPercent] = useState<number | null>(initialProgressPercent);
  const [composeError, setComposeError] = useState<string | null>(null);

  const isPolling = composeStatus === 'processing' || isComposing;

  const composeElapsed = useElapsedTime(isPolling);
  const uploadElapsed = useElapsedTime(isUploading);

  // Poll for compose status when processing
  const pollComposeStatus = useCallback(async () => {
    try {
      const status = await getClipComposeStatus(clipId);
      setComposeStatus(status.composeStatus);
      setProgressPhase(status.composeProgressPhase);
      setProgressPercent(status.composeProgressPercent);
      setComposeError(status.composeErrorMessage);

      if (status.composeStatus === 'completed') {
        onComposeComplete?.(status.subtitledVideoUrl);
      }
    } catch (error) {
      console.error('Failed to fetch compose status:', error);
    }
  }, [clipId, onComposeComplete]);

  useEffect(() => {
    if (!isPolling) return;

    // Initial poll
    pollComposeStatus();

    // Poll every 2 seconds
    const interval = setInterval(pollComposeStatus, 2000);
    return () => clearInterval(interval);
  }, [isPolling, pollComposeStatus]);

  const showComposeButton = step === 'idle' && canCompose;
  const showUploadButton = (step === 'composed' || subtitledVideoUrl) && !subtitledVideoDriveUrl;
  const hasComposedVideo = !!subtitledVideoUrl;
  const hasUploadedVideo = !!subtitledVideoDriveUrl;

  const handleCompose = () => {
    onCompose?.(
      outputFormat,
      outputFormat !== 'original' ? paddingColor : undefined,
      outlineColor,
      fontSize
    );
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Video className="h-4 w-4" />
          字幕付き動画
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={
              hasComposedVideo
                ? 'default'
                : composeStatus === 'failed'
                  ? 'destructive'
                  : 'secondary'
            }
            className="flex items-center gap-1"
          >
            {isPolling ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                合成中...
              </>
            ) : composeStatus === 'failed' ? (
              'エラー'
            ) : hasComposedVideo ? (
              <>
                <CheckCircle className="h-3 w-3" />
                合成済み
              </>
            ) : (
              '未合成'
            )}
          </Badge>

          <Badge
            variant={hasUploadedVideo ? 'default' : 'secondary'}
            className="flex items-center gap-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                アップロード中...
              </>
            ) : hasUploadedVideo ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Drive保存済み
              </>
            ) : (
              '未アップロード'
            )}
          </Badge>
        </div>

        {/* 設定項目 */}
        <div className="space-y-3">
          {/* サイズ */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0 w-20">サイズ</Label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-muted p-1">
              {(
                [
                  { value: 'original' as OutputFormat, label: 'オリジナル' },
                  { value: 'vertical' as OutputFormat, label: '縦動画（9:16）' },
                  { value: 'horizontal' as OutputFormat, label: '横動画（16:9）' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOutputFormat(value)}
                  disabled={isPolling}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    outputFormat === value
                      ? 'bg-background text-foreground shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  } ${isPolling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* フォントサイズ */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0 w-20">フォント</Label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-muted p-1">
              {(
                [
                  { value: 'large' as SubtitleFontSize, label: '大' },
                  { value: 'medium' as SubtitleFontSize, label: '中' },
                  { value: 'small' as SubtitleFontSize, label: '小' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFontSize(value)}
                  disabled={isPolling}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    fontSize === value
                      ? 'bg-background text-foreground shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  } ${isPolling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* テキスト枠の色 */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0 w-20">テキスト</Label>
            {(
              [
                { value: '#30bca7' as OutlineColor, label: '緑' },
                { value: '#56d6ea' as OutlineColor, label: '水色' },
                { value: '#ff7aa2' as OutlineColor, label: 'ピンク' },
                { value: '#000000' as OutlineColor, label: '黒' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutlineColor(value)}
                disabled={isPolling}
                title={label}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  outlineColor === value
                    ? 'border-primary ring-2 ring-primary/30 scale-110'
                    : 'border-gray-300 hover:scale-105'
                } ${isPolling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>

          {/* 余白の色 */}
          {(outputFormat === 'vertical' || outputFormat === 'horizontal') && (
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium shrink-0 w-20">背景色</Label>
              {(
                [
                  { value: '#30bca7' as PaddingColor, label: '緑' },
                  { value: '#56d6ea' as PaddingColor, label: '水色' },
                  { value: '#ff7aa2' as PaddingColor, label: 'ピンク' },
                  { value: '#000000' as PaddingColor, label: '黒' },
                  { value: '#ffffff' as PaddingColor, label: '白' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaddingColor(value)}
                  disabled={isPolling}
                  title={label}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    paddingColor === value
                      ? 'border-primary ring-2 ring-primary/30 scale-110'
                      : 'border-gray-300 hover:scale-105'
                  } ${isPolling ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ backgroundColor: value }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Clip length warning */}
        {clipDurationSeconds != null && clipDurationSeconds > 90 && (
          <div className="flex items-center gap-2 rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>負荷軽減のため、1.5分を超えるクリップの生成は一時的にお控えください</span>
          </div>
        )}

        {/* Progress display during composition */}
        {isPolling && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{getPhaseLabel(progressPhase)}</span>
              <span className="font-medium">{progressPercent ?? 0}%</span>
            </div>
            <Progress value={progressPercent ?? 0} className="h-2" />
            <p className="text-xs text-muted-foreground">
              経過時間: {formatElapsed(composeElapsed)}
            </p>
          </div>
        )}

        {/* Error display */}
        {composeStatus === 'failed' && composeError && (
          <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {composeError}
          </div>
        )}

        {exceedsMaxDuration && (
          <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3 text-sm text-yellow-800">
            現在、120秒を超える動画の字幕合成は一時的に制限されています。
          </div>
        )}

        {!isPolling && !exceedsMaxDuration && (
          <p className="text-xs text-muted-foreground">
            長い動画では合成に1〜2分かかります。バックグラウンドで処理されます。
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {showComposeButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompose}
              disabled={isPolling || !canCompose}
            >
              {isPolling ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  合成中...
                </>
              ) : (
                '動画を合成'
              )}
            </Button>
          )}

          {hasComposedVideo && subtitledVideoUrl && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleCompose}
                disabled={isPolling || exceedsMaxDuration}
              >
                {isPolling ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    再合成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    再合成
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={subtitledVideoUrl} download>
                  <Download className="mr-2 h-3 w-3" />
                  ダウンロード
                </a>
              </Button>
              {showUploadButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUpload}
                  disabled={isUploading || !hasComposedVideo}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      アップロード中... {formatElapsed(uploadElapsed)}
                    </>
                  ) : (
                    'Driveにアップロード'
                  )}
                </Button>
              )}
              {hasUploadedVideo && subtitledVideoDriveUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={subtitledVideoDriveUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Google Driveで開く
                  </a>
                </Button>
              )}
            </>
          )}
        </div>

        {hasComposedVideo && subtitledVideoUrl && (
          <div className="flex justify-center">
            {/* biome-ignore lint/a11y/useMediaCaption: subtitles are burned into the video */}
            <video
              src={subtitledVideoUrl}
              controls
              className="max-w-full max-h-[480px] rounded-md"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
