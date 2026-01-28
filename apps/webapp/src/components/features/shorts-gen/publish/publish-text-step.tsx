'use client';

import { Button } from '@/components/ui/button';
import { AlertCircle, FileText, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import { PublishTextDisplay } from './publish-text-display';
import { PublishTextEditor } from './publish-text-editor';
import type { PublishTextStepProps } from './types';
import { usePublishText } from './use-publish-text';

export function PublishTextStep({
  projectId,
  isEnabled,
  onPublishTextComplete,
}: PublishTextStepProps) {
  const {
    state,
    isGenerating,
    isEditing,
    isSaving,
    hasPublishText,
    generate,
    startEditing,
    cancelEditing,
    setEditedTitle,
    setEditedDescription,
    saveChanges,
  } = usePublishText({
    projectId,
    onPublishTextComplete,
  });

  if (!isEnabled) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>動画合成が完了すると、公開テキストの生成が可能になります</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">公開用テキスト</span>
        </div>

        {!isEditing && (
          <Button onClick={generate} disabled={isGenerating} size="sm">
            {isGenerating ? (
              <>
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                生成中...
              </>
            ) : hasPublishText ? (
              <>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                再生成
              </>
            ) : (
              <>
                <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                生成
              </>
            )}
          </Button>
        )}
      </div>

      {state.error && (
        <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {isGenerating && (
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            AIが動画タイトルと説明文を生成しています...
          </p>
        </div>
      )}

      {!isGenerating && hasPublishText && isEditing && (
        <PublishTextEditor
          title={state.editedTitle}
          description={state.editedDescription}
          onTitleChange={setEditedTitle}
          onDescriptionChange={setEditedDescription}
          onSave={saveChanges}
          onCancel={cancelEditing}
          isSaving={isSaving}
        />
      )}

      {!isGenerating && hasPublishText && !isEditing && state.publishText && (
        <PublishTextDisplay
          title={state.publishText.title}
          description={state.publishText.description}
          onEdit={startEditing}
          onCopy={() => {}}
        />
      )}

      {!isGenerating && !hasPublishText && (
        <div className="rounded-lg border bg-muted/50 p-8 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
          <p className="text-sm text-muted-foreground">
            「生成」ボタンをクリックすると、AIが動画タイトルと説明文を自動生成します
          </p>
        </div>
      )}
    </div>
  );
}
