'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { AlertCircle, Check, Circle, Loader2, RefreshCw } from 'lucide-react';

export type ItemStatus = 'pending' | 'running' | 'completed' | 'error';

export interface ProgressItem {
  id: string;
  label: string;
  status: ItemStatus;
  error?: string;
}

export interface ProgressIndicatorProps {
  title: string;
  items: ProgressItem[];
  onGenerate?: () => void;
  onRetryItem?: (itemId: string) => void;
  canGenerate?: boolean;
  isGenerating?: boolean;
}

function ItemStatusIcon({ status }: { status: ItemStatus }) {
  switch (status) {
    case 'pending':
      return <Circle className="h-4 w-4 text-muted-foreground" />;
    case 'running':
      return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
    case 'completed':
      return <Check className="h-4 w-4 text-green-500" />;
    case 'error':
      return <AlertCircle className="h-4 w-4 text-destructive" />;
  }
}

function getStatusText(status: ItemStatus): string {
  switch (status) {
    case 'pending':
      return '待機中';
    case 'running':
      return '処理中';
    case 'completed':
      return '完了';
    case 'error':
      return 'エラー';
  }
}

export function ProgressIndicator({
  title,
  items,
  onGenerate,
  onRetryItem,
  canGenerate = true,
  isGenerating = false,
}: ProgressIndicatorProps) {
  const completedCount = items.filter((item) => item.status === 'completed').length;
  const totalCount = items.length;
  const hasErrors = items.some((item) => item.status === 'error');
  const allCompleted = completedCount === totalCount && totalCount > 0;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium text-sm">{title}</h4>
        {onGenerate && (
          <Button
            size="sm"
            variant={allCompleted ? 'outline' : 'default'}
            onClick={onGenerate}
            disabled={!canGenerate || isGenerating}
          >
            {isGenerating && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
            {isGenerating ? '生成中...' : allCompleted ? '再生成' : '生成'}
          </Button>
        )}
      </div>

      {totalCount > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {completedCount} / {totalCount} 完了
            </span>
            {hasErrors && <span className="text-destructive">エラーあり</span>}
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-300',
                hasErrors ? 'bg-destructive' : 'bg-green-500'
              )}
              style={{ width: `${(completedCount / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item) => (
            <div
              key={item.id}
              className={cn(
                'flex items-center justify-between p-2 rounded-md text-sm',
                item.status === 'error' && 'bg-destructive/5'
              )}
            >
              <div className="flex items-center gap-2 min-w-0">
                <ItemStatusIcon status={item.status} />
                <span className="truncate">{item.label}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {getStatusText(item.status)}
                </span>
              </div>
              {item.status === 'error' && onRetryItem && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={() => onRetryItem(item.id)}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {items.length === 0 && (
        <p className="text-sm text-muted-foreground py-2">シーンがありません</p>
      )}
    </div>
  );
}

export interface ParallelProgressProps {
  columns: {
    id: string;
    title: string;
    items: ProgressItem[];
    onGenerate?: () => void;
    onRetryItem?: (itemId: string) => void;
    canGenerate?: boolean;
    isGenerating?: boolean;
  }[];
}

export function ParallelProgress({ columns }: ParallelProgressProps) {
  return (
    <div className="grid grid-cols-3 gap-4">
      {columns.map((column) => (
        <div key={column.id} className="border rounded-lg p-4">
          <ProgressIndicator
            title={column.title}
            items={column.items}
            onGenerate={column.onGenerate}
            onRetryItem={column.onRetryItem}
            canGenerate={column.canGenerate}
            isGenerating={column.isGenerating}
          />
        </div>
      ))}
    </div>
  );
}
