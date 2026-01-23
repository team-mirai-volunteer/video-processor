'use client';

import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import { VideoCard } from './video-card';

export function VideoList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['videos'],
    queryFn: () => apiClient.getVideos(),
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-center text-destructive">
        データの取得に失敗しました
      </div>
    );
  }

  if (!data?.data.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        動画がまだ登録されていません
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {data.data.map((video) => (
        <VideoCard key={video.id} video={video} />
      ))}
    </div>
  );
}
