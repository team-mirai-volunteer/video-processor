'use client';

import { use } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ExternalLink,
  Clock,
  HardDrive,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ClipList } from '@/components/features/clip-list';
import { apiClient } from '@/lib/api-client';
import { formatDate, formatDuration, formatBytes, cn } from '@/lib/utils';

function getStatusBadgeVariant(status: string) {
  switch (status) {
    case 'completed':
      return 'success';
    case 'processing':
      return 'warning';
    case 'failed':
      return 'destructive';
    default:
      return 'secondary';
  }
}

function getStatusLabel(status: string) {
  switch (status) {
    case 'pending':
      return '待機中';
    case 'processing':
      return '処理中';
    case 'completed':
      return '完了';
    case 'failed':
      return '失敗';
    default:
      return status;
  }
}

export default function VideoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data: video, isLoading, error } = useQuery({
    queryKey: ['video', id],
    queryFn: () => apiClient.getVideo(id),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="space-y-4">
        <Link
          href="/videos"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          戻る
        </Link>
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
          動画が見つかりませんでした
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/videos"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        動画一覧に戻る
      </Link>

      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {video.title || '無題の動画'}
            </h1>
            {video.description && (
              <p className="mt-1 text-muted-foreground">{video.description}</p>
            )}
          </div>
          <Badge variant={getStatusBadgeVariant(video.status)} className="shrink-0">
            {getStatusLabel(video.status)}
          </Badge>
        </div>

        {video.status === 'failed' && video.errorMessage && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">エラーが発生しました</p>
              <p className="text-sm">{video.errorMessage}</p>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">動画情報</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <dt className="text-sm font-medium text-muted-foreground">登録日時</dt>
                <dd className="mt-1 flex items-center gap-1 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatDate(video.createdAt)}
                </dd>
              </div>
              {video.durationSeconds && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">動画長</dt>
                  <dd className="mt-1 text-sm">{formatDuration(video.durationSeconds)}</dd>
                </div>
              )}
              {video.fileSizeBytes && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">ファイルサイズ</dt>
                  <dd className="mt-1 flex items-center gap-1 text-sm">
                    <HardDrive className="h-3.5 w-3.5 text-muted-foreground" />
                    {formatBytes(video.fileSizeBytes)}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-sm font-medium text-muted-foreground">Google Drive</dt>
                <dd className="mt-1">
                  <a
                    href={video.googleDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    元動画を開く
                  </a>
                </dd>
              </div>
            </dl>
          </CardContent>
        </Card>

        {video.processingJobs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">処理ジョブ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {video.processingJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">切り抜き指示</span>
                      <Badge variant={getStatusBadgeVariant(job.status)} className="text-xs">
                        {getStatusLabel(job.status)}
                      </Badge>
                    </div>
                    <pre className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
                      {job.clipInstructions}
                    </pre>
                    {job.completedAt && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        完了: {formatDate(job.completedAt)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <div>
          <h2 className="mb-4 text-lg font-semibold">
            クリップ一覧 ({video.clips.length})
          </h2>
          <ClipList clips={video.clips} />
        </div>
      </div>
    </div>
  );
}
