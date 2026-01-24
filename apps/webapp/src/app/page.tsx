'use client';

import { VideoTable } from '@/components/features/video-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiClient } from '@/lib/api-client';
import type { VideoSummary } from '@video-processor/shared';
import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

export default function HomePage() {
  const [videos, setVideos] = useState<VideoSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchVideos() {
      try {
        const response = await apiClient.getVideos();
        setVideos(response.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '動画の取得に失敗しました');
      } finally {
        setLoading(false);
      }
    }

    fetchVideos();
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">動画一覧</h1>
          <p className="text-muted-foreground mt-1">登録された動画と処理状況を確認できます</p>
        </div>
        <Button asChild>
          <Link href="/submit">
            <Plus className="mr-2 h-4 w-4" />
            動画を登録
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>登録済み動画</CardTitle>
          <CardDescription>Google Driveから登録された動画の一覧です</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-12 text-destructive">{error}</div>
          ) : (
            <VideoTable videos={videos} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
