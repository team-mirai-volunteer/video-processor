'use client';

import { Badge } from '@/components/ui/badge';
import type { VideoStatus } from '@video-processor/shared';

interface StatusBadgeProps {
  status: VideoStatus;
}

const statusConfig: Record<
  VideoStatus,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  pending: { label: '待機中', variant: 'secondary' },
  processing: { label: '処理中', variant: 'warning' },
  completed: { label: '完了', variant: 'success' },
  failed: { label: 'エラー', variant: 'destructive' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
