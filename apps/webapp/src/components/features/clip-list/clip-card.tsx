'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDuration } from '@/lib/utils';
import type { Clip } from '@video-processor/shared';
import { Clock, ExternalLink, FileText } from 'lucide-react';
import Link from 'next/link';

interface ClipCardProps {
  clip: Clip;
}

const statusConfig = {
  pending: { label: '待機中', variant: 'secondary' as const },
  processing: { label: '処理中', variant: 'warning' as const },
  completed: { label: '完了', variant: 'success' as const },
  failed: { label: 'エラー', variant: 'destructive' as const },
};

export function ClipCard({ clip }: ClipCardProps) {
  const config = statusConfig[clip.status];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg">
              <Link href={`/clips/${clip.id}`} className="hover:underline hover:text-primary">
                {clip.title || 'タイトルなし'}
              </Link>
            </CardTitle>
            <CardDescription className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {formatDuration(clip.startTimeSeconds)} - {formatDuration(clip.endTimeSeconds)}
              </span>
              <span>({formatDuration(clip.durationSeconds)})</span>
            </CardDescription>
          </div>
          <Badge variant={config.variant}>{config.label}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {clip.transcript && (
          <div className="space-y-2">
            <div className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
              <FileText className="h-3 w-3" />
              文字起こし
            </div>
            <p className="text-sm bg-muted p-3 rounded-md">{clip.transcript}</p>
          </div>
        )}

        {clip.googleDriveUrl && clip.status === 'completed' && (
          <div className="flex justify-end">
            <Button variant="outline" size="sm" asChild>
              <a href={clip.googleDriveUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="mr-2 h-3 w-3" />
                Google Driveで開く
              </a>
            </Button>
          </div>
        )}

        {clip.errorMessage && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {clip.errorMessage}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
