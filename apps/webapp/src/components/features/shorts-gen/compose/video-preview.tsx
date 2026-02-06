'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, Clock, Download, Film, Play } from 'lucide-react';
import type { VideoPreviewProps } from './types';

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'completed':
      return <Badge variant="default">完了</Badge>;
    case 'processing':
      return (
        <Badge variant="secondary" className="animate-pulse">
          処理中...
        </Badge>
      );
    case 'pending':
      return <Badge variant="outline">待機中</Badge>;
    case 'failed':
      return <Badge variant="destructive">エラー</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

const PHASE_LABELS: Record<string, string> = {
  preparing: '準備中',
  downloading: 'アセットダウンロード中',
  composing: '動画合成中',
  uploading: 'アップロード中',
};

export function VideoPreview({
  videoUrl,
  durationSeconds,
  status,
  progressPhase,
  progressPercent,
  errorMessage,
}: VideoPreviewProps) {
  const isCompleted = status === 'completed' && videoUrl;

  if (status === 'failed' && errorMessage) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
          <div>
            <h4 className="font-medium text-destructive">動画合成エラー</h4>
            <p className="text-sm text-muted-foreground mt-1">{errorMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">プレビュー</span>
        </div>
        {getStatusBadge(status)}
      </div>

      {isCompleted ? (
        <div className="space-y-3">
          <div className="relative rounded-lg overflow-hidden bg-black aspect-[9/16] max-w-[280px] mx-auto">
            <video src={videoUrl} controls className="w-full h-full object-contain" poster="">
              <track kind="captions" />
              お使いのブラウザは動画再生に対応していません
            </video>
          </div>

          <div className="flex items-center justify-between text-sm text-muted-foreground">
            {durationSeconds && (
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" />
                <span>{formatDuration(durationSeconds)}</span>
              </div>
            )}
            <Button variant="outline" size="sm" asChild>
              <a href={videoUrl} download target="_blank" rel="noopener noreferrer">
                <Download className="mr-1.5 h-3.5 w-3.5" />
                ダウンロード
              </a>
            </Button>
          </div>
        </div>
      ) : status === 'processing' || status === 'pending' ? (
        <div className="rounded-lg border bg-muted/50 aspect-[9/16] max-w-[280px] mx-auto flex flex-col items-center justify-center gap-3 px-6">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <span className="text-sm text-muted-foreground">
            {progressPhase ? PHASE_LABELS[progressPhase] || progressPhase : '動画を合成中...'}
            {progressPercent != null && ` (${progressPercent}%)`}
          </span>
          {progressPercent != null && (
            <div className="w-full bg-muted rounded-full h-2">
              <div
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-lg border bg-muted/50 aspect-[9/16] max-w-[280px] mx-auto flex flex-col items-center justify-center gap-3">
          <Play className="h-12 w-12 text-muted-foreground/50" />
          <span className="text-sm text-muted-foreground">
            動画を生成すると、ここにプレビューが表示されます
          </span>
        </div>
      )}
    </div>
  );
}
