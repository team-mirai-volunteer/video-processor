'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import '@blocknote/shadcn/style.css';
import { Copy, Loader2, Save } from 'lucide-react';
import dynamic from 'next/dynamic';
import { useCallback, useMemo, useState } from 'react';
import type { Planning } from './types';

const BlockNoteEditorComponent = dynamic(
  () => import('./planning-block-editor-inner').then((mod) => mod.BlockNoteEditorInner),
  { ssr: false }
);

interface PlanningBlockEditorNewProps {
  projectId: string;
  onPlanningCreated: (planning: Planning) => void;
  className?: string;
}

export function PlanningBlockEditorNew({
  projectId,
  onPlanningCreated,
  className,
}: PlanningBlockEditorNewProps) {
  const [currentContent, setCurrentContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasContent = useMemo(() => {
    return currentContent.trim().length > 0;
  }, [currentContent]);

  const handleContentChange = useCallback((markdown: string) => {
    setCurrentContent(markdown);
    setError(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (!hasContent || isSaving) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/shorts-gen/projects/${projectId}/planning`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: currentContent }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create planning');
      }

      const planning = await response.json();
      onPlanningCreated(planning);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create planning');
    } finally {
      setIsSaving(false);
    }
  }, [hasContent, isSaving, projectId, currentContent, onPlanningCreated]);

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
          <BlockNoteEditorComponent initialContent="" onChange={handleContentChange} />
        </div>

        <div className="flex items-center justify-between pt-3 border-t flex-shrink-0">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>新規作成</span>
            {hasContent && <span className="text-yellow-600">(未保存)</span>}
            {error && <span className="text-red-600">{error}</span>}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleCopy} disabled={!hasContent}>
              <Copy className="mr-2 h-4 w-4" />
              {copied ? 'Copied' : 'Copy'}
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!hasContent || isSaving}>
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
