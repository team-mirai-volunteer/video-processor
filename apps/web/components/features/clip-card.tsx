'use client';

import { ExternalLink, Clock, FileText } from 'lucide-react';
import type { Clip } from '@video-processor/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { formatDuration, cn } from '@/lib/utils';

interface ClipCardProps {
  clip: Clip;
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

export function ClipCard({ clip }: ClipCardProps) {
  const timeRange = `${formatDuration(clip.startTimeSeconds)} - ${formatDuration(clip.endTimeSeconds)}`;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{clip.title || '無題のクリップ'}</CardTitle>
          <Badge variant={getStatusBadgeVariant(clip.status)}>
            {getStatusLabel(clip.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            <span>{timeRange}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="font-medium">{formatDuration(clip.durationSeconds)}</span>
          </div>
        </div>

        {clip.transcript && (
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              <span>文字起こし</span>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-3">{clip.transcript}</p>
          </div>
        )}

        {clip.googleDriveUrl && clip.status === 'completed' && (
          <a
            href={clip.googleDriveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'w-full')}
          >
            <ExternalLink className="mr-2 h-3.5 w-3.5" />
            Google Driveで開く
          </a>
        )}
      </CardContent>
    </Card>
  );
}
