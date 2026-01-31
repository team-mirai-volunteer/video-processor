'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import '@blocknote/shadcn/style.css';
import { Copy, Loader2, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Planning, UpdatePlanningParams } from './types';

const BlockNoteEditorComponent = dynamic(
  () => import('./planning-block-editor-inner').then((mod) => mod.BlockNoteEditorInner),
  { ssr: false }
);

interface PlanningBlockEditorProps {
  planning: Planning;
  onSave: (planningId: string, params: UpdatePlanningParams) => Promise<void>;
  isSaving?: boolean;
  className?: string;
}

export function PlanningBlockEditor({
  planning,
  onSave,
  isSaving = false,
  className,
}: PlanningBlockEditorProps) {
  const [originalContent, setOriginalContent] = useState(planning.content);
  const [currentContent, setCurrentContent] = useState(planning.content);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setOriginalContent(planning.content);
    setCurrentContent(planning.content);
  }, [planning.content]);

  const hasChanges = useMemo(() => {
    return currentContent !== originalContent;
  }, [currentContent, originalContent]);

  const handleContentChange = useCallback((markdown: string) => {
    setCurrentContent(markdown);
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasChanges || isSaving) return;

    await onSave(planning.id, { content: currentContent });
    setOriginalContent(currentContent);
  }, [hasChanges, isSaving, onSave, planning.id, currentContent]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(currentContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [currentContent]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    },
    [handleSave]
  );

  return (
    <Card className={cn('flex flex-col', className)} onKeyDown={handleKeyDown}>
      <CardContent className="p-4 flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto min-h-0">
          <BlockNoteEditorComponent
            initialContent={planning.content}
            onChange={handleContentChange}
          />
        </div>

        <div className="flex items-center justify-between pt-3 border-t flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>version {planning.version}</span>
            {hasChanges && <span className="text-yellow-600">(unsaved)</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasChanges || isSaving}>
              {isSaving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
