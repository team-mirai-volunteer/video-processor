'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Copy, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Planning } from './types';

interface PlanningDisplayProps {
  planning: Planning;
  onEdit?: () => void;
  className?: string;
}

export function PlanningDisplay({ planning, onEdit, className }: PlanningDisplayProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(planning.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [planning.content]);

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>バージョン {planning.version}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={handleCopy} className="h-8 w-8 p-0">
              <Copy className="h-4 w-4" />
              <span className="sr-only">{copied ? 'コピー済み' : 'コピー'}</span>
            </Button>
            {onEdit && (
              <Button variant="ghost" size="sm" onClick={onEdit} className="h-8 w-8 p-0">
                <Pencil className="h-4 w-4" />
                <span className="sr-only">編集</span>
              </Button>
            )}
          </div>
        </div>

        {/* Markdown content rendered as prose */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <div className="whitespace-pre-wrap text-sm leading-relaxed">{planning.content}</div>
        </div>
      </CardContent>
    </Card>
  );
}
