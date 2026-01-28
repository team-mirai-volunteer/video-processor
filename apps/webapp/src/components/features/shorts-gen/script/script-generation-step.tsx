'use client';

import { ChatUI } from '@/components/features/shorts-gen/chat';
import type { ToolCall } from '@/components/features/shorts-gen/chat';
import { cn } from '@/lib/utils';
import { FileText, Pencil } from 'lucide-react';
import { useCallback, useState } from 'react';
import { SceneEditor } from './scene-editor';
import { SceneList } from './scene-list';
import type { Scene, Script, UpdateSceneParams } from './types';

export type ScriptGenerationStatus = 'idle' | 'ready' | 'generating' | 'completed' | 'error';

interface ScriptGenerationStepProps {
  projectId: string;
  planningId: string | null;
  script: Script | null;
  scenes: Scene[];
  status: ScriptGenerationStatus;
  onScriptGenerated?: (script: Script, scenes: Scene[]) => void;
  onSceneUpdated?: (scene: Scene) => void;
  onSaveScene?: (sceneId: string, params: UpdateSceneParams) => Promise<void>;
  className?: string;
}

function getEndpoint(projectId: string): string {
  // API endpoint for script generation
  // Format: /api/shorts-gen/projects/:projectId/script/generate
  return `/api/shorts-gen/projects/${projectId}/script/generate`;
}

export function ScriptGenerationStep({
  projectId,
  planningId,
  script,
  scenes,
  status,
  onScriptGenerated,
  onSceneUpdated,
  onSaveScene,
  className,
}: ScriptGenerationStepProps) {
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleToolCall = useCallback(
    (toolCall: ToolCall) => {
      // Handle save_script tool call from AI
      if (toolCall.name === 'save_script' && toolCall.status === 'completed') {
        const result = toolCall.result as { script?: Script; scenes?: Scene[] } | undefined;
        if (result?.script && result?.scenes) {
          onScriptGenerated?.(result.script, result.scenes);
        }
      }
    },
    [onScriptGenerated]
  );

  const handleComplete = useCallback(() => {
    // Chat completed
  }, []);

  const handleEditScene = useCallback((scene: Scene) => {
    setEditingScene(scene);
  }, []);

  const handleCancelEdit = useCallback(() => {
    setEditingScene(null);
  }, []);

  const handleSaveScene = useCallback(
    async (sceneId: string, params: UpdateSceneParams) => {
      if (!onSaveScene) return;

      setIsSaving(true);
      try {
        await onSaveScene(sceneId, params);
        // Update local scene data
        const updatedScene = scenes.find((s) => s.id === sceneId);
        if (updatedScene) {
          onSceneUpdated?.({ ...updatedScene, ...params } as Scene);
        }
        setEditingScene(null);
      } finally {
        setIsSaving(false);
      }
    },
    [onSaveScene, scenes, onSceneUpdated]
  );

  const isReady = status === 'ready' && planningId !== null;
  const hasScript = script !== null;
  const isGenerating = status === 'generating';

  return (
    <div className={cn('space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div>
          <h3 className="font-medium">台本を作成</h3>
          <p className="text-sm text-muted-foreground">
            企画書をもとに、シーンごとの台本を生成します
          </p>
        </div>
      </div>

      {/* Status message */}
      {!isReady && !hasScript && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
          <p>企画書を作成してから、台本を生成できます。</p>
        </div>
      )}

      {/* Chat UI for generation */}
      {(isReady || hasScript) && (
        <ChatUI
          endpoint={getEndpoint(projectId)}
          title="台本生成チャット"
          placeholder="台本に関する指示を入力... (例: 「シーンを5つに分けて台本を作成してください」)"
          onToolCall={handleToolCall}
          onComplete={handleComplete}
          disabled={!isReady && !hasScript}
          headers={{
            'X-Planning-Id': planningId || '',
            'X-Script-Id': script?.id || '',
          }}
          className="min-h-[300px]"
        />
      )}

      {/* Scene editing */}
      {editingScene && (
        <div className="border-t pt-4">
          <SceneEditor
            scene={editingScene}
            onSave={handleSaveScene}
            onCancel={handleCancelEdit}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Scene list */}
      {hasScript && !editingScene && scenes.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                シーンをクリックして詳細を表示、編集ボタンで編集できます
              </span>
            </div>
          </div>
          <SceneList scenes={scenes} onEditScene={onSaveScene ? handleEditScene : undefined} />
        </div>
      )}

      {/* Empty state when script exists but no scenes */}
      {hasScript && scenes.length === 0 && !isGenerating && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
          <p>台本は作成されましたが、シーンがまだありません。</p>
          <p className="mt-1">チャットでシーンを追加してください。</p>
        </div>
      )}
    </div>
  );
}
