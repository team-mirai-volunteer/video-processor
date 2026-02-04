'use client';

import { Skeleton } from '@/components/ui/skeleton';
import { getClipVideoUrl } from '@/server/presentation/clip-video/actions/getClipVideoUrl';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

interface ClipVideoPlayerProps {
  clipId: string;
  onTimeUpdate?: (currentTime: number) => void;
}

export function ClipVideoPlayer({ clipId, onTimeUpdate }: ClipVideoPlayerProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideoUrl = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getClipVideoUrl(clipId);
      if (response) {
        setVideoUrl(response.videoUrl);
      } else {
        setError('動画URLの取得に失敗しました');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : '動画の読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, [clipId]);

  useEffect(() => {
    fetchVideoUrl();
  }, [fetchVideoUrl]);

  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    if (onTimeUpdate) {
      onTimeUpdate(e.currentTarget.currentTime);
    }
  };

  if (loading) {
    return (
      <div className="w-full aspect-video">
        <Skeleton className="w-full h-full" />
      </div>
    );
  }

  if (error || !videoUrl) {
    return (
      <div className="w-full aspect-video bg-muted rounded-lg flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <p className="text-muted-foreground text-sm">{error || '動画を読み込めません'}</p>
        <button
          type="button"
          onClick={fetchVideoUrl}
          className="flex items-center gap-2 px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          <RefreshCw className="h-4 w-4" />
          再読み込み
        </button>
      </div>
    );
  }

  return (
    <div className="w-full aspect-video bg-black rounded-lg overflow-hidden">
      <video
        src={videoUrl}
        controls
        className="w-full h-full"
        onTimeUpdate={handleTimeUpdate}
        playsInline
      >
        <track kind="captions" />
      </video>
    </div>
  );
}
