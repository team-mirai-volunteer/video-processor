'use client';

import { ClipList } from '@/components/features/clip-list';
import { StatusBadge } from '@/components/features/video-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError, apiClient } from '@/lib/api-client';
import { formatBytes, formatDate, formatDuration } from '@/lib/utils';
import type { VideoWithRelations } from '@video-processor/shared';
import { ArrowLeft, Calendar, Clock, ExternalLink, HardDrive } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

export default function VideoDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [video, setVideo] = useState<VideoWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideo() {
      try {
        const response = await apiClient.getVideo(id);
        setVideo(response);
      } catch (err) {
        if (err instanceof ApiError && err.status === 404) {
          setError('動画が見つかりません');
        } else {
          setError(err instanceof Error ? err.message : '動画の取得に失敗しました');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchVideo();
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-destructive">{error || '動画が見つかりません'}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{video.title || 'タイトルなし'}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={video.status} />
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href={video.googleDriveUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Google Driveで開く
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>動画情報</CardTitle>
          <CardDescription>{video.description || '説明はありません'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {video.durationSeconds && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  再生時間
                </div>
                <div className="font-medium">{formatDuration(video.durationSeconds)}</div>
              </div>
            )}
            {video.fileSizeBytes && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <HardDrive className="h-3 w-3" />
                  ファイルサイズ
                </div>
                <div className="font-medium">{formatBytes(Number(video.fileSizeBytes))}</div>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                登録日時
              </div>
              <div className="font-medium">{formatDate(video.createdAt)}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                更新日時
              </div>
              <div className="font-medium">{formatDate(video.updatedAt)}</div>
            </div>
          </div>

          {video.errorMessage && (
            <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {video.errorMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {video.processingJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>処理ジョブ</CardTitle>
            <CardDescription>動画に対する処理リクエストの履歴です</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {video.processingJobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">切り抜き指示</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {job.clipInstructions}
                      </div>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  {job.completedAt && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      完了: {formatDate(job.completedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>切り抜きクリップ</CardTitle>
          <CardDescription>この動画から生成されたショート動画の一覧です</CardDescription>
        </CardHeader>
        <CardContent>
          <ClipList clips={video.clips} />
        </CardContent>
      </Card>
    </div>
  );
}
