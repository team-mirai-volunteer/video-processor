'use client';

import { ChatUI } from '@/components/features/shorts-gen/chat';
import type { ToolCall } from '@/components/features/shorts-gen/chat';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bot, FileText, Pencil, Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { SceneEditor } from './scene-editor';
import { SceneList } from './scene-list';
import type { CreateSceneParams, Scene, Script, UpdateSceneParams } from './types';

type ScriptGenerationStatus = 'idle' | 'ready' | 'generating' | 'completed' | 'error';

type ScriptCreationMode = 'select' | 'ai' | 'manual';

interface ScriptGenerationStepProps {
  projectId: string;
  planningId: string | null;
  script: Script | null;
  scenes: Scene[];
  status: ScriptGenerationStatus;
  onScriptGenerated?: (script: Script, scenes: Scene[]) => void;
  onSceneUpdated?: (scene: Scene) => void;
  onSaveScene?: (sceneId: string, params: UpdateSceneParams) => Promise<void>;
  onCreateManualScript?: (planningId: string) => Promise<Script>;
  onAddScene?: (params: CreateSceneParams) => Promise<Scene>;
  className?: string;
}

function getEndpoint(projectId: string): string {
  // API endpoint for script generation
  // Format: /api/shorts-gen/projects/:projectId/script/generate
  return `/api/shorts-gen/projects/${projectId}/script/generate`;
}

function getInitialMode(script: Script | null, scenes: Scene[]): ScriptCreationMode {
  if (!script) {
    return 'select';
  }
  // If script exists with no scenes and version 1, likely manual creation in progress
  if (script.version === 1 && scenes.length === 0) {
    return 'manual';
  }
  // Otherwise, assume AI-generated or already has content
  return 'ai';
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
  onCreateManualScript,
  onAddScene,
  className,
}: ScriptGenerationStepProps) {
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingScript, setIsCreatingScript] = useState(false);
  const [mode, setMode] = useState<ScriptCreationMode>(() => getInitialMode(script, scenes));
  const [isAddingNewScene, setIsAddingNewScene] = useState(false);

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

  const handleSelectAiMode = useCallback(() => {
    setMode('ai');
  }, []);

  const handleSelectManualMode = useCallback(async () => {
    if (!planningId || !onCreateManualScript) return;

    setIsCreatingScript(true);
    try {
      const newScript = await onCreateManualScript(planningId);
      onScriptGenerated?.(newScript, []);
      setMode('manual');
    } finally {
      setIsCreatingScript(false);
    }
  }, [planningId, onCreateManualScript, onScriptGenerated]);

  const handleAddNewScene = useCallback(() => {
    setIsAddingNewScene(true);
    setEditingScene(null);
  }, []);

  const handleSaveNewScene = useCallback(
    async (_sceneId: string, params: UpdateSceneParams) => {
      if (!onAddScene) return;

      setIsSaving(true);
      try {
        const createParams: CreateSceneParams = {
          summary: params.summary || '',
          visualType: params.visualType || 'image_gen',
          voiceText: params.voiceText,
          subtitles: params.subtitles,
          silenceDurationMs: params.silenceDurationMs,
          stockVideoKey: params.stockVideoKey,
          solidColor: params.solidColor,
          imageStyleHint: params.imageStyleHint,
        };
        await onAddScene(createParams);
        setIsAddingNewScene(false);
      } finally {
        setIsSaving(false);
      }
    },
    [onAddScene]
  );

  const handleCancelNewScene = useCallback(() => {
    setIsAddingNewScene(false);
  }, []);

  const isReady = status === 'ready' && planningId !== null;
  const hasScript = script !== null;
  const isGenerating = status === 'generating';

  // Create a placeholder scene for adding new scenes
  const newScenePlaceholder: Scene = {
    id: 'new',
    scriptId: script?.id || '',
    order: scenes.length,
    summary: '',
    visualType: 'image_gen',
    voiceText: '',
    subtitles: [],
    silenceDurationMs: null,
    stockVideoKey: null,
    solidColor: null,
    imagePrompt: null,
    imageStyleHint: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

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

      {/* Mode selection - when ready but no script yet */}
      {isReady && !hasScript && mode === 'select' && (
        <div className="bg-muted/30 p-6 rounded-lg">
          <p className="text-sm text-muted-foreground mb-4">
            台本を作成する方法を選択してください：
          </p>
          <div className="flex gap-4">
            <Button
              variant="outline"
              className="flex-1 h-auto py-4 flex flex-col items-center gap-2"
              onClick={handleSelectAiMode}
            >
              <Bot className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">AI生成</div>
                <div className="text-xs text-muted-foreground">チャットでAIに指示</div>
              </div>
            </Button>
            <Button
              variant="outline"
              className="flex-1 h-auto py-4 flex flex-col items-center gap-2"
              onClick={handleSelectManualMode}
              disabled={isCreatingScript || !onCreateManualScript}
            >
              <Pencil className="h-6 w-6" />
              <div className="text-center">
                <div className="font-medium">手動作成</div>
                <div className="text-xs text-muted-foreground">自分でシーンを追加</div>
              </div>
            </Button>
          </div>
        </div>
      )}

      {/* AI generation mode */}
      {(mode === 'ai' || (hasScript && mode !== 'manual')) && (isReady || hasScript) && (
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

      {/* Manual creation mode - adding new scene */}
      {mode === 'manual' && hasScript && isAddingNewScene && (
        <div className="border-t pt-4">
          <SceneEditor
            scene={newScenePlaceholder}
            onSave={handleSaveNewScene}
            onCancel={handleCancelNewScene}
            isSaving={isSaving}
          />
        </div>
      )}

      {/* Scene editing */}
      {editingScene && !isAddingNewScene && (
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
      {hasScript && !editingScene && !isAddingNewScene && scenes.length > 0 && (
        <div className="border-t pt-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Pencil className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                シーンをクリックして詳細を表示、編集ボタンで編集できます
              </span>
            </div>
            {mode === 'manual' && onAddScene && (
              <Button variant="outline" size="sm" onClick={handleAddNewScene}>
                <Plus className="h-4 w-4 mr-1" />
                シーンを追加
              </Button>
            )}
          </div>
          <SceneList scenes={scenes} onEditScene={onSaveScene ? handleEditScene : undefined} />
        </div>
      )}

      {/* Empty state when script exists but no scenes - manual mode */}
      {mode === 'manual' &&
        hasScript &&
        scenes.length === 0 &&
        !isGenerating &&
        !isAddingNewScene && (
          <div className="bg-muted/50 p-6 rounded-md text-center">
            <p className="text-sm text-muted-foreground mb-4">シーンがまだありません。</p>
            {onAddScene && (
              <Button variant="outline" onClick={handleAddNewScene}>
                <Plus className="h-4 w-4 mr-1" />
                最初のシーンを追加
              </Button>
            )}
          </div>
        )}

      {/* Empty state when script exists but no scenes - AI mode */}
      {mode !== 'manual' && hasScript && scenes.length === 0 && !isGenerating && (
        <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-md">
          <p>台本は作成されましたが、シーンがまだありません。</p>
          <p className="mt-1">チャットでシーンを追加してください。</p>
        </div>
      )}
    </div>
  );
}
