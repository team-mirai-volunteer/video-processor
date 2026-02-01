'use client';

import { ChatUI } from '@/components/features/shorts-gen/chat';
import type { ChatMessage, ToolCall } from '@/components/features/shorts-gen/chat';
import { cn } from '@/lib/utils';
import { FileText, Pencil } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { SceneEditor } from './scene-editor';
import { SceneList } from './scene-list';
import type { Scene, Script, UpdateSceneParams } from './types';

type ScriptGenerationStatus = 'idle' | 'ready' | 'generating' | 'completed' | 'error';

/**
 * 台本生成チャットの初期メッセージ
 * バックエンドのシステムプロンプトと整合性を持たせる
 */
const SCRIPT_INITIAL_MESSAGE: ChatMessage = {
  id: 'initial-script-message',
  role: 'assistant',
  content: `企画書をもとに台本を作成します。まず動画の長さを決めましょう！（1シーン約4秒目安）

**A. ショート（8シーン / 約32秒）**
→ サクッと要点だけ伝えたいとき

**B. スタンダード（12シーン / 約48秒）**（おすすめ）
→ バランス良く伝えたいとき

**C. ロング（16シーン / 約64秒）**
→ じっくり説明したいとき

A / B / C どれがいいですか？（または希望のシーン数を教えてください）`,
  createdAt: new Date(),
};

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
        // Backend sends savedScript with script and scenes
        const result = toolCall.result as
          | {
              script?: { id: string; projectId: string; planningId: string; version: number };
              scenes?: Scene[];
            }
          | undefined;
        if (result?.script && result?.scenes) {
          // Create full Script object with timestamps
          const now = new Date().toISOString();
          const fullScript: Script = {
            ...result.script,
            scenes: result.scenes,
            createdAt: now,
            updatedAt: now,
          };
          onScriptGenerated?.(fullScript, result.scenes);
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

  // 初期メッセージをメモ化（再レンダリング時に参照が変わらないように）
  const initialMessages = useMemo(() => [SCRIPT_INITIAL_MESSAGE], []);

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

      {/* Status message - when planning is not ready */}
      {!isReady && !hasScript && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
          <p>企画書を作成してから、台本を生成できます。</p>
        </div>
      )}

      {/* AI generation chat */}
      {(isReady || hasScript) && (
        <div className="h-[800px]">
          <ChatUI
            endpoint={getEndpoint(projectId)}
            title="台本生成チャット"
            placeholder="台本に関する指示を入力... (例: 「B」「12シーン」「もう少し短く」)"
            initialMessages={initialMessages}
            onToolCall={handleToolCall}
            onComplete={handleComplete}
            disabled={!isReady && !hasScript}
            headers={{
              'X-Planning-Id': planningId || '',
              'X-Script-Id': script?.id || '',
            }}
            className="h-full"
          />
        </div>
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
          <div className="flex items-center gap-2 mb-3">
            <Pencil className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              シーンをクリックして詳細を表示、編集ボタンで編集できます
            </span>
          </div>
          <SceneList scenes={scenes} onEditScene={onSaveScene ? handleEditScene : undefined} />
        </div>
      )}

      {/* Empty state when script exists but no scenes */}
      {hasScript && scenes.length === 0 && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
          <p>台本は作成されましたが、シーンがまだありません。</p>
          <p className="mt-1">チャットでシーンを追加してください。</p>
        </div>
      )}
    </div>
  );
}
