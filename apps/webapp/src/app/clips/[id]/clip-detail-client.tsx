'use client';

import { ClipVideoPlayer, SubtitleEditor } from '@/components/features/clip-detail';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClipSubtitle, GetClipResponse } from '@video-processor/shared';
import { ArrowLeft, Clock, ExternalLink, FileText, Video } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface ClipDetailClientProps {
  clip: GetClipResponse;
  videoTitle: string | null;
  initialSubtitle: ClipSubtitle | null;
}

const statusConfig = {
  pending: { label: '待機中', variant: 'secondary' as const },
  processing: { label: '処理中', variant: 'warning' as const },
  completed: { label: '完了', variant: 'success' as const },
  failed: { label: 'エラー', variant: 'destructive' as const },
};

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function ClipDetailClient({ clip, videoTitle, initialSubtitle }: ClipDetailClientProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [subtitle, setSubtitle] = useState<ClipSubtitle | null>(initialSubtitle);
  // These values are passed as initial values to SubtitleEditor,
  // which manages its own local state for UI updates
  const subtitledVideoUrl = clip.subtitledVideoUrl ?? null;
  const subtitledVideoDriveUrl = clip.subtitledVideoDriveUrl ?? null;
  const config = statusConfig[clip.status as keyof typeof statusConfig] || statusConfig.pending;
  const videoRef = { current: null as HTMLVideoElement | null };

  const handleTimeUpdate = (time: number) => {
    setCurrentTime(time);
  };

  const handleSeek = (timeSeconds: number) => {
    if (videoRef.current) {
      videoRef.current.currentTime = timeSeconds;
    }
  };

  const handleSubtitleUpdate = (updatedSubtitle: ClipSubtitle) => {
    setSubtitle(updatedSubtitle);
  };

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <Button variant="ghost" asChild>
        <Link href="/clips">
          <ArrowLeft className="mr-2 h-4 w-4" />
          クリップ一覧へ
        </Link>
      </Button>

      {/* Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl">{clip.title || 'タイトルなし'}</CardTitle>
              <CardDescription className="space-y-1">
                <div className="flex items-center gap-2">
                  <Video className="h-3 w-3" />
                  <span>元動画: </span>
                  <Link
                    href={`/videos/${clip.videoId}`}
                    className="underline hover:text-foreground"
                  >
                    {videoTitle || '動画詳細'}
                  </Link>
                </div>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(clip.startTimeSeconds)} - {formatDuration(clip.endTimeSeconds)}
                  </span>
                  <span>({formatDuration(clip.durationSeconds)})</span>
                </div>
              </CardDescription>
            </div>
            <Badge variant={config.variant}>{config.label}</Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Video Player */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Video className="h-4 w-4" />
            動画プレイヤー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ClipVideoPlayer clipId={clip.id} onTimeUpdate={handleTimeUpdate} />
          <p className="mt-2 text-sm text-muted-foreground">
            現在位置: {formatDuration(currentTime)}
          </p>
        </CardContent>
      </Card>

      {/* Transcript */}
      {clip.transcript && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <FileText className="h-4 w-4" />
              文字起こし
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm bg-muted p-4 rounded-md whitespace-pre-wrap">{clip.transcript}</p>
          </CardContent>
        </Card>
      )}

      {/* Subtitle Editor */}
      <SubtitleEditor
        clipId={clip.id}
        initialSubtitle={subtitle}
        currentTimeSeconds={currentTime}
        subtitledVideoUrl={subtitledVideoUrl}
        subtitledVideoDriveUrl={subtitledVideoDriveUrl}
        onSeek={handleSeek}
        onSubtitleUpdate={handleSubtitleUpdate}
      />

      {/* Google Drive Link */}
      {clip.googleDriveUrl && clip.status === 'completed' && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex justify-end">
              <Button variant="outline" asChild>
                <a href={clip.googleDriveUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  元クリップをGoogle Driveで開く
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {clip.errorMessage && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-destructive bg-destructive/10 p-4 rounded-md">
              {clip.errorMessage}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
