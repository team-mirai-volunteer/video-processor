'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, RefreshCw, Video } from 'lucide-react';
import { BgmSelector } from './bgm-selector';
import type { ComposeStepProps } from './types';
import { useCompose } from './use-compose';
import { VideoPreview } from './video-preview';

export function ComposeStep({
  projectId,
  scriptId,
  isEnabled,
  onComposeComplete,
}: ComposeStepProps) {
  const { state, isComposing, canCompose, startCompose, setSelectedBgmKey, reset } = useCompose({
    projectId,
    scriptId,
    onComposeComplete,
  });

  if (!isEnabled) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>素材生成が完了すると、動画合成が可能になります</p>
      </div>
    );
  }

  if (!scriptId) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>台本が必要です</p>
        <p className="text-sm mt-1">先に台本を生成してください</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Video className="h-4 w-4" />
            動画合成設定
          </CardTitle>
          <CardDescription>生成された素材を組み合わせて最終動画を作成します</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <BgmSelector
            selectedKey={state.selectedBgmKey}
            onSelect={setSelectedBgmKey}
            disabled={isComposing}
          />

          {state.error && (
            <div className="flex items-start gap-2 p-3 rounded-md bg-destructive/10 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{state.error}</span>
            </div>
          )}

          <div className="flex justify-end gap-2">
            {state.composedVideo && (
              <Button variant="outline" size="sm" onClick={reset} disabled={isComposing}>
                リセット
              </Button>
            )}
            <Button onClick={startCompose} disabled={!canCompose} size="sm">
              {isComposing ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  合成中...
                </>
              ) : state.composedVideo?.status === 'completed' ? (
                <>
                  <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  再合成
                </>
              ) : (
                <>
                  <Video className="mr-1.5 h-3.5 w-3.5" />
                  動画を合成
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <VideoPreview
        videoUrl={state.composedVideo?.fileUrl ?? null}
        durationSeconds={state.composedVideo?.durationSeconds ?? null}
        status={state.composedVideo?.status ?? 'idle'}
        errorMessage={state.composedVideo?.errorMessage ?? null}
      />
    </div>
  );
}
