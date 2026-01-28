'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Loader2, Save, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Planning, UpdatePlanningParams } from './types';

interface PlanningEditorProps {
  planning: Planning;
  onSave: (planningId: string, params: UpdatePlanningParams) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  className?: string;
}

export function PlanningEditor({
  planning,
  onSave,
  onCancel,
  isSaving = false,
  className,
}: PlanningEditorProps) {
  const [content, setContent] = useState(planning.content);

  const hasChanges = content !== planning.content;

  const handleSave = useCallback(async () => {
    if (!hasChanges || isSaving) return;

    await onSave(planning.id, { content });
  }, [hasChanges, isSaving, onSave, planning.id, content]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ctrl/Cmd + S to save
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
      // Escape to cancel
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    },
    [handleSave, onCancel]
  );

  return (
    <Card className={cn('', className)}>
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">企画書を編集</span>
            <span className="text-xs text-muted-foreground">Ctrl+S で保存、Esc でキャンセル</span>
          </div>

          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="企画書の内容を入力..."
            className="min-h-[300px] font-mono text-sm resize-y"
            disabled={isSaving}
          />
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2 p-4 pt-0">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="mr-2 h-4 w-4" />
          キャンセル
        </Button>
        <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          保存
        </Button>
      </CardFooter>
    </Card>
  );
}
