'use client';

import { Badge } from '@/components/ui/badge';
import type { ProcessingJobStatus, VideoStatus } from '@video-processor/shared';

type Status = VideoStatus | ProcessingJobStatus;

interface StatusBadgeProps {
  status: Status;
}

const statusConfig: Record<
  Status,
  { label: string; variant: 'default' | 'secondary' | 'success' | 'warning' | 'destructive' }
> = {
  pending: { label: '待機中', variant: 'secondary' },
  transcribing: { label: '文字起こし中', variant: 'warning' },
  transcribed: { label: '文字起こし完了', variant: 'default' },
  analyzing: { label: '分析中', variant: 'warning' },
  extracting: { label: '抽出中', variant: 'warning' },
  uploading: { label: 'アップロード中', variant: 'warning' },
  completed: { label: '完了', variant: 'success' },
  failed: { label: 'エラー', variant: 'destructive' },
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? { label: status, variant: 'default' as const };
  return <Badge variant={config.variant}>{config.label}</Badge>;
}
