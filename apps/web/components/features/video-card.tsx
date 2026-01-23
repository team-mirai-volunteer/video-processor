'use client';

import Link from 'next/link';
import { Film, Clock, Scissors, ExternalLink } from 'lucide-react';
import type { VideoListItem } from '@video-processor/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils';

interface VideoCardProps {
  video: VideoListItem;
}

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

export function VideoCard({ video }: VideoCardProps) {
  return (
    <Link href={`/videos/${video.id}`}>
      <Card className="cursor-pointer transition-shadow hover:shadow-md">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{video.title || '無題の動画'}</span>
            </CardTitle>
            <Badge variant={getStatusBadgeVariant(video.status)}>
              {getStatusLabel(video.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Scissors className="h-3.5 w-3.5" />
              <span>{video.clipCount} クリップ</span>
            </div>
            <div className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              <span>{formatDate(video.createdAt)}</span>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
            <ExternalLink className="h-3 w-3" />
            <span className="truncate">{video.googleDriveUrl}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
