'use client';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { ShortsProjectStatus } from '@video-processor/shared';

interface ProjectStatusBadgeProps {
  status: ShortsProjectStatus;
}

const STATUS_CONFIG: Record<
  ShortsProjectStatus,
  { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }
> = {
  created: { label: '作成済み', variant: 'outline' },
  planning_in_progress: { label: '企画書作成中', variant: 'secondary' },
  planning_completed: { label: '企画書完了', variant: 'default' },
  script_in_progress: { label: '台本作成中', variant: 'secondary' },
  script_completed: { label: '台本完了', variant: 'default' },
  assets_generating: { label: 'アセット生成中', variant: 'secondary' },
  assets_completed: { label: 'アセット完了', variant: 'default' },
  composing: { label: '動画合成中', variant: 'secondary' },
  completed: { label: '完了', variant: 'default' },
  failed: { label: 'エラー', variant: 'destructive' },
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = STATUS_CONFIG[status];

  return (
    <Badge
      variant={config.variant}
      className={cn(
        status === 'completed' && 'bg-green-500 hover:bg-green-600',
        (status === 'planning_in_progress' ||
          status === 'script_in_progress' ||
          status === 'assets_generating' ||
          status === 'composing') &&
          'bg-blue-500 hover:bg-blue-600 text-white'
      )}
    >
      {config.label}
    </Badge>
  );
}
