'use client';

import { ChatUI } from '@/components/features/shorts-gen/chat';
import type { ToolCall } from '@/components/features/shorts-gen/chat';
import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { useCallback, useState } from 'react';
import { PlanningBlockEditor } from './planning-block-editor';
import type { Planning, UpdatePlanningParams } from './types';

export type PlanningGenerationStatus = 'idle' | 'ready' | 'generating' | 'completed' | 'error';

interface PlanningGenerationStepProps {
  projectId: string;
  planning: Planning | null;
  status: PlanningGenerationStatus;
  onPlanningGenerated?: (planning: Planning) => void;
  onPlanningUpdated?: (planning: Planning) => void;
  onSavePlanning?: (planningId: string, params: UpdatePlanningParams) => Promise<void>;
  className?: string;
}

function getEndpoint(projectId: string): string {
  // API endpoint for planning generation
  // Format: /api/shorts-gen/projects/:projectId/planning/generate
  return `/api/shorts-gen/projects/${projectId}/planning/generate`;
}

export function PlanningGenerationStep({
  projectId,
  planning,
  status,
  onPlanningGenerated,
  onPlanningUpdated,
  onSavePlanning,
  className,
}: PlanningGenerationStepProps) {
  const [isSaving, setIsSaving] = useState(false);

  const handleToolCall = useCallback(
    (toolCall: ToolCall) => {
      console.log('[PlanningGenerationStep] handleToolCall:', toolCall);
      // Handle save_planning tool call from AI
      if (toolCall.name === 'save_planning' && toolCall.status === 'completed') {
        const result = toolCall.result as { planning?: Planning } | undefined;
        console.log('[PlanningGenerationStep] save_planning result:', result);
        if (result?.planning) {
          console.log(
            '[PlanningGenerationStep] calling onPlanningGenerated with:',
            result.planning
          );
          onPlanningGenerated?.(result.planning);
        }
      }
    },
    [onPlanningGenerated]
  );

  const handleComplete = useCallback(() => {
    // Chat completed
  }, []);

  const handleSavePlanning = useCallback(
    async (planningId: string, params: UpdatePlanningParams) => {
      if (!onSavePlanning) return;

      setIsSaving(true);
      try {
        await onSavePlanning(planningId, params);
        // Update local planning data
        if (planning) {
          onPlanningUpdated?.({
            ...planning,
            ...params,
            updatedAt: new Date().toISOString(),
          } as Planning);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [onSavePlanning, planning, onPlanningUpdated]
  );

  const isReady = status === 'ready';
  const hasPlanning = planning !== null;
  const isGenerating = status === 'generating';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">企画書を作成</h3>
          <p className="text-sm text-muted-foreground">
            長文やURLをもとに、ショート動画の企画書を生成します
          </p>
        </div>
      </div>

      {/* Main content: Left = Planning, Right = Chat */}
      {(isReady || hasPlanning) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left: Planning BlockNote editor */}
          <div className="order-2 lg:order-1 h-[800px]">
            {hasPlanning && onSavePlanning ? (
              <PlanningBlockEditor
                key={`${planning.id}-${planning.version}`}
                planning={planning}
                onSave={handleSavePlanning}
                isSaving={isSaving}
                className="h-full"
              />
            ) : hasPlanning ? (
              <PlanningBlockEditor
                key={`${planning.id}-${planning.version}`}
                planning={planning}
                onSave={async () => {}}
                isSaving={false}
                className="h-full"
              />
            ) : (
              <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md h-full flex items-center justify-center">
                <p>チャットで企画書を生成してください</p>
              </div>
            )}
          </div>

          {/* Right: Chat UI */}
          <div className="order-1 lg:order-2 h-[800px]">
            <ChatUI
              endpoint={getEndpoint(projectId)}
              title="企画書生成チャット"
              placeholder="企画の元になる情報を入力... (例: 「この記事の内容をショート動画にしたい: https://...」)"
              onToolCall={handleToolCall}
              onComplete={handleComplete}
              disabled={isGenerating}
              headers={{
                'X-Planning-Id': planning?.id || '',
              }}
              className="h-full"
            />
          </div>
        </div>
      )}

      {/* Empty state when not ready */}
      {!isReady && !hasPlanning && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
          <p>プロジェクトが作成されると、企画書の生成を開始できます。</p>
        </div>
      )}
    </div>
  );
}
