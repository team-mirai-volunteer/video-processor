'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronRight,
  Circle,
  Loader2,
  Pencil,
  RefreshCw,
} from 'lucide-react';

export type StepStatus = 'pending' | 'ready' | 'running' | 'completed' | 'error';

export interface StepCardProps {
  stepNumber: number;
  title: string;
  description?: string;
  status: StepStatus;
  isExpanded: boolean;
  onToggle: () => void;
  onRegenerate?: () => void;
  onEdit?: () => void;
  canRegenerate?: boolean;
  canEdit?: boolean;
  children?: React.ReactNode;
  error?: string;
  progressMessage?: string | null;
}

const CIRCLED_NUMBERS: Record<number, string> = {
  1: '①',
  2: '②',
  3: '③',
  4: '④',
  5: '⑤',
  6: '⑥',
  7: '⑦',
  8: '⑧',
  9: '⑨',
  10: '⑩',
};

function getCircledNumber(num: number): string {
  return CIRCLED_NUMBERS[num] ?? `(${num})`;
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case 'ready':
      return <Circle className="h-4 w-4 text-blue-500 fill-blue-500/20" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
}

function StatusBadge({
  status,
  progressMessage,
}: {
  status: StepStatus;
  progressMessage?: string | null;
}) {
  const statusText: Record<StepStatus, string> = {
    pending: '待機中',
    ready: '実行可能',
    running: '実行中...',
    completed: '完了',
    error: 'エラー',
  };

  const statusClass: Record<StepStatus, string> = {
    pending: 'text-muted-foreground',
    ready: 'text-blue-500',
    running: 'text-blue-500',
    completed: 'text-green-500',
    error: 'text-destructive',
  };

  const displayText =
    status === 'running' && progressMessage ? progressMessage : statusText[status];

  return <span className={cn('text-sm font-medium', statusClass[status])}>{displayText}</span>;
}

export function StepCard({
  stepNumber,
  title,
  description,
  status,
  isExpanded,
  onToggle,
  onRegenerate,
  onEdit,
  canRegenerate = true,
  canEdit = false,
  children,
  error,
  progressMessage,
}: StepCardProps) {
  const isRunning = status === 'running';
  const showActions = status === 'completed' || status === 'error';

  return (
    <div className="border rounded-lg bg-card">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          )}
          <span className="font-medium text-lg">{getCircledNumber(stepNumber)}</span>
          <span className="font-medium">{title}</span>
        </div>
        <div className="flex items-center gap-3">
          <StatusIcon status={status} />
          <StatusBadge status={status} progressMessage={progressMessage} />
        </div>
      </button>

      {isExpanded && (
        <div className="px-4 pb-4 pt-0 border-t">
          <div className="pt-4 space-y-3">
            {description && <p className="text-sm text-muted-foreground">{description}</p>}

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            {children && <div className="space-y-4">{children}</div>}

            {showActions && (onRegenerate || onEdit) && (
              <div className="flex justify-end gap-2 pt-2">
                {onEdit && canEdit && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit();
                    }}
                    disabled={isRunning}
                  >
                    <Pencil className="mr-1.5 h-3.5 w-3.5" />
                    編集
                  </Button>
                )}
                {onRegenerate && canRegenerate && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRegenerate();
                    }}
                    disabled={isRunning}
                  >
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                    再生成
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
