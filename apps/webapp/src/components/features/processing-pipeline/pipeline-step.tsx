'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, ChevronDown, ChevronRight, Circle, Loader2 } from 'lucide-react';

export type StepStatus = 'pending' | 'ready' | 'running' | 'completed' | 'error';

export interface PipelineStepProps {
  stepNumber: number;
  title: string;
  description: string;
  status: StepStatus;
  isExpanded: boolean;
  onToggle: () => void;
  onExecute: () => void;
  canExecute: boolean;
  children?: React.ReactNode;
  error?: string;
  progressMessage?: string | null;
}

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case 'ready':
      return <Circle className="h-4 w-4 text-blue-500" />;
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
}: { status: StepStatus; progressMessage?: string | null }) {
  const statusText = {
    pending: '待機中',
    ready: '実行可能',
    running: '実行中...',
    completed: '完了',
    error: 'エラー',
  };

  const statusClass = {
    pending: 'text-muted-foreground',
    ready: 'text-blue-500',
    running: 'text-blue-500',
    completed: 'text-green-500',
    error: 'text-destructive',
  };

  // Show progress message if available during running status
  const displayText =
    status === 'running' && progressMessage ? progressMessage : statusText[status];

  return <span className={cn('text-sm font-medium', statusClass[status])}>{displayText}</span>;
}

export function PipelineStep({
  stepNumber,
  title,
  description,
  status,
  isExpanded,
  onToggle,
  onExecute,
  canExecute,
  children,
  error,
  progressMessage,
}: PipelineStepProps) {
  const isRunning = status === 'running';

  return (
    <div className="border rounded-lg">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="font-medium text-muted-foreground">{stepNumber}</span>
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
            <p className="text-sm text-muted-foreground">{description}</p>

            {error && (
              <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                {error}
              </div>
            )}

            {children && <div className="space-y-2 text-sm">{children}</div>}

            <div className="flex justify-end pt-2">
              <Button
                size="sm"
                variant={status === 'completed' ? 'outline' : 'default'}
                onClick={(e) => {
                  e.stopPropagation();
                  onExecute();
                }}
                disabled={!canExecute || isRunning}
              >
                {isRunning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isRunning ? '実行中...' : status === 'completed' ? '再実行' : '実行'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
