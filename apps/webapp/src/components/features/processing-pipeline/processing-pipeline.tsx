'use client';

import {
  PipelineStep,
  type StepStatus,
} from '@/components/features/processing-pipeline/pipeline-step';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatDate, formatDuration } from '@/lib/utils';
import { cacheVideo } from '@/server/presentation/actions/cacheVideo';
import { extractAudio } from '@/server/presentation/actions/extractAudio';
import { refineTranscript } from '@/server/presentation/actions/refineTranscript';
import { transcribeAudio } from '@/server/presentation/actions/transcribeAudio';
import { transcribeVideo } from '@/server/presentation/actions/transcribeVideo';
import type {
  CacheVideoResponse,
  ExtractAudioResponse,
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  TranscribeAudioResponse,
  TranscriptionPhase,
  VideoWithRelations,
} from '@video-processor/shared';
import { Loader2, PlayCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface ProcessingPipelineProps {
  video: VideoWithRelations;
  transcription: GetTranscriptionResponse | null;
  refinedTranscription: GetRefinedTranscriptionResponse | null;
  onStepComplete: () => void;
}

interface StepState {
  status: StepStatus;
  result?: unknown;
  error?: string;
}

interface StepsState {
  cache: StepState;
  extractAudio: StepState;
  transcribe: StepState;
  refine: StepState;
}

/**
 * TranscriptionPhase からUIの各ステップ状態を導出する
 */
function deriveStepStatuses(
  phase: TranscriptionPhase | null,
  hasGcsUri: boolean,
  hasTranscription: boolean,
  hasRefinedTranscription: boolean
): {
  cache: StepStatus;
  extractAudio: StepStatus;
  transcribe: StepStatus;
  refine: StepStatus;
} {
  // 実行中フェーズがある場合、そのフェーズに基づいて状態を決定
  if (phase === 'downloading') {
    return {
      cache: 'running',
      extractAudio: 'pending',
      transcribe: 'pending',
      refine: 'pending',
    };
  }

  if (phase === 'extracting_audio') {
    return {
      cache: 'completed',
      extractAudio: 'running',
      transcribe: 'pending',
      refine: 'pending',
    };
  }

  if (phase === 'transcribing' || phase === 'saving' || phase === 'uploading') {
    return {
      cache: 'completed',
      extractAudio: 'completed',
      transcribe: 'running',
      refine: 'pending',
    };
  }

  if (phase === 'refining') {
    return {
      cache: 'completed',
      extractAudio: 'completed',
      transcribe: 'completed',
      refine: 'running',
    };
  }

  // フェーズがない場合、完了データの有無で判定
  return {
    cache: hasGcsUri ? 'completed' : 'ready',
    extractAudio: hasTranscription ? 'completed' : hasGcsUri ? 'ready' : 'pending',
    transcribe: hasTranscription ? 'completed' : 'pending',
    refine: hasRefinedTranscription ? 'completed' : hasTranscription ? 'ready' : 'pending',
  };
}

export function ProcessingPipeline({
  video,
  transcription,
  refinedTranscription,
  onStepComplete,
}: ProcessingPipelineProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);
  const [runningAllSteps, setRunningAllSteps] = useState(false);

  // Initialize step states based on video/transcription data and transcriptionPhase
  const initialSteps = useMemo((): StepsState => {
    const hasGcsUri = Boolean(video.gcsUri);
    const hasTranscription = Boolean(transcription);
    const hasRefinedTranscription = Boolean(refinedTranscription);

    const statuses = deriveStepStatuses(
      video.transcriptionPhase,
      hasGcsUri,
      hasTranscription,
      hasRefinedTranscription
    );

    return {
      cache: {
        status: statuses.cache,
        result: hasGcsUri
          ? {
              gcsUri: video.gcsUri,
              expiresAt: video.gcsExpiresAt,
            }
          : undefined,
      },
      extractAudio: {
        status: statuses.extractAudio,
      },
      transcribe: {
        status: statuses.transcribe,
        result:
          hasTranscription && transcription
            ? {
                transcriptionId: transcription.id,
                segmentsCount: transcription.segments.length,
                durationSeconds: transcription.durationSeconds,
              }
            : undefined,
      },
      refine: {
        status: statuses.refine,
        result:
          hasRefinedTranscription && refinedTranscription
            ? {
                sentencesCount: refinedTranscription.sentences.length,
                dictionaryVersion: refinedTranscription.dictionaryVersion,
              }
            : undefined,
      },
    };
  }, [video, transcription, refinedTranscription]);

  const [steps, setSteps] = useState<StepsState>(initialSteps);
  const [progressMessage, setProgressMessage] = useState<string | null>(video.progressMessage);

  // propsが更新されたら（ポーリングで新データが来たら）ステータスを同期
  useEffect(() => {
    const hasGcsUri = Boolean(video.gcsUri);
    const hasTranscription = Boolean(transcription);
    const hasRefinedTranscription = Boolean(refinedTranscription);

    const statuses = deriveStepStatuses(
      video.transcriptionPhase,
      hasGcsUri,
      hasTranscription,
      hasRefinedTranscription
    );

    setSteps((prev) => ({
      cache: { ...prev.cache, status: statuses.cache },
      extractAudio: { ...prev.extractAudio, status: statuses.extractAudio },
      transcribe: { ...prev.transcribe, status: statuses.transcribe },
      refine: { ...prev.refine, status: statuses.refine },
    }));
    setProgressMessage(video.progressMessage);
  }, [video, transcription, refinedTranscription]);

  // Polling for progress updates during any step running
  // Uses API Route instead of Server Action to avoid blocking during long-running operations
  useEffect(() => {
    const isRunning =
      steps.cache.status === 'running' ||
      steps.extractAudio.status === 'running' ||
      steps.transcribe.status === 'running' ||
      steps.refine.status === 'running';
    if (!isRunning) {
      return;
    }

    const pollProgress = async () => {
      try {
        // Use API Route to avoid Server Action serialization blocking
        const response = await fetch(`/api/videos/${video.id}/progress`);
        if (response.ok) {
          const data = await response.json();
          setProgressMessage(data.progressMessage);
        }
      } catch (err) {
        console.error('Failed to poll progress:', err);
      }
    };

    // Initial poll
    pollProgress();

    // Poll every 3 seconds
    const interval = setInterval(pollProgress, 3000);

    return () => clearInterval(interval);
  }, [
    steps.cache.status,
    steps.extractAudio.status,
    steps.transcribe.status,
    steps.refine.status,
    video.id,
  ]);

  const updateStepState = useCallback((stepKey: keyof StepsState, update: Partial<StepState>) => {
    setSteps((prev) => ({
      ...prev,
      [stepKey]: { ...prev[stepKey], ...update },
    }));
  }, []);

  // Step 1: Cache Video
  const handleCacheVideo = useCallback(async () => {
    updateStepState('cache', { status: 'running', error: undefined });
    try {
      const result = await cacheVideo(video.id);
      updateStepState('cache', {
        status: 'completed',
        result: {
          gcsUri: result.gcsUri,
          expiresAt: result.expiresAt,
          cached: result.cached,
        },
      });
      // Enable next step
      setSteps((prev) => ({
        ...prev,
        extractAudio: {
          ...prev.extractAudio,
          status: prev.extractAudio.status === 'pending' ? 'ready' : prev.extractAudio.status,
        },
      }));
      onStepComplete();
    } catch (err) {
      updateStepState('cache', {
        status: 'error',
        error: err instanceof Error ? err.message : '動画の読み込みに失敗しました',
      });
    }
  }, [video.id, updateStepState, onStepComplete]);

  // Step 2: Extract Audio
  const handleExtractAudio = useCallback(async () => {
    updateStepState('extractAudio', { status: 'running', error: undefined });
    try {
      const result = await extractAudio(video.id);
      updateStepState('extractAudio', {
        status: 'completed',
        result: {
          format: result.format,
          audioGcsUri: result.audioGcsUri,
        },
      });
      onStepComplete();
    } catch (err) {
      updateStepState('extractAudio', {
        status: 'error',
        error: err instanceof Error ? err.message : '音声の取り出しに失敗しました',
      });
    }
  }, [video.id, updateStepState, onStepComplete]);

  // Step 3: Transcribe Audio
  const handleTranscribeAudio = useCallback(async () => {
    updateStepState('transcribe', { status: 'running', error: undefined });
    try {
      const result = await transcribeAudio(video.id);
      updateStepState('transcribe', {
        status: 'completed',
        result: {
          transcriptionId: result.transcriptionId,
          segmentsCount: result.segmentsCount,
          durationSeconds: result.durationSeconds,
        },
      });
      // Enable next step
      setSteps((prev) => ({
        ...prev,
        refine: {
          ...prev.refine,
          status: prev.refine.status === 'pending' ? 'ready' : prev.refine.status,
        },
      }));
      onStepComplete();
    } catch (err) {
      updateStepState('transcribe', {
        status: 'error',
        error: err instanceof Error ? err.message : '文字起こしに失敗しました',
      });
    }
  }, [video.id, updateStepState, onStepComplete]);

  // Step 4: Refine Transcript
  const handleRefineTranscript = useCallback(async () => {
    updateStepState('refine', { status: 'running', error: undefined });
    try {
      await refineTranscript(video.id);
      updateStepState('refine', {
        status: 'completed',
      });
      onStepComplete();
    } catch (err) {
      updateStepState('refine', {
        status: 'error',
        error: err instanceof Error ? err.message : '字幕テキストの整形に失敗しました',
      });
    }
  }, [video.id, updateStepState, onStepComplete]);

  // Run all steps using existing transcribeVideo action
  const handleRunAllSteps = useCallback(async () => {
    setRunningAllSteps(true);
    // 最初のステップだけ running、残りは pending
    setSteps({
      cache: { status: 'running' },
      extractAudio: { status: 'pending' },
      transcribe: { status: 'pending' },
      refine: { status: 'pending' },
    });
    try {
      await transcribeVideo(video.id);
      onStepComplete();
    } catch (err) {
      // Reset to ready states on error
      setSteps((prev) => ({
        ...prev,
        cache: {
          ...prev.cache,
          status: 'error',
          error: err instanceof Error ? err.message : '処理に失敗しました',
        },
      }));
    } finally {
      setRunningAllSteps(false);
    }
  }, [video.id, onStepComplete]);

  const toggleStep = useCallback((stepKey: string) => {
    setExpandedStep((prev) => (prev === stepKey ? null : stepKey));
  }, []);

  const isAnyStepRunning =
    steps.cache.status === 'running' ||
    steps.extractAudio.status === 'running' ||
    steps.transcribe.status === 'running' ||
    steps.refine.status === 'running';

  // Render step details
  const renderCacheDetails = () => {
    const result = steps.cache.result as CacheVideoResponse | undefined;
    if (!result) return null;
    return (
      <div className="space-y-1 text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">保存先:</span> {result.gcsUri}
        </div>
        {result.expiresAt && (
          <div>
            <span className="font-medium text-foreground">有効期限:</span>{' '}
            {formatDate(new Date(result.expiresAt))}
          </div>
        )}
        {result.cached !== undefined && (
          <div>
            <span className="font-medium text-foreground">状態:</span>{' '}
            {result.cached ? '前回のデータを再利用' : '新しく読み込み完了'}
          </div>
        )}
      </div>
    );
  };

  const renderExtractAudioDetails = () => {
    const result = steps.extractAudio.result as ExtractAudioResponse | undefined;
    if (!result) return null;
    return (
      <div className="space-y-1 text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">音声形式:</span>{' '}
          {result.format?.toUpperCase()}
        </div>
        <div>
          <span className="font-medium text-foreground">保存先:</span>{' '}
          <span className="text-xs break-all">{result.audioGcsUri}</span>
        </div>
      </div>
    );
  };

  const renderTranscribeDetails = () => {
    const result = steps.transcribe.result as TranscribeAudioResponse | undefined;
    if (!result) return null;
    return (
      <div className="space-y-1 text-muted-foreground">
        <div>
          <span className="font-medium text-foreground">字幕ブロック数:</span>{' '}
          {result.segmentsCount}
        </div>
        <div>
          <span className="font-medium text-foreground">動画の長さ:</span>{' '}
          {formatDuration(result.durationSeconds)}
        </div>
      </div>
    );
  };

  const renderRefineDetails = () => {
    const result = steps.refine.result as
      | { sentencesCount?: number; dictionaryVersion?: string }
      | undefined;
    if (!result) return null;
    return (
      <div className="space-y-1 text-muted-foreground">
        {result.sentencesCount !== undefined && (
          <div>
            <span className="font-medium text-foreground">整形後の文数:</span>{' '}
            {result.sentencesCount}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>動画の準備</CardTitle>
            <CardDescription>文字起こしと字幕作成のための前処理を行います</CardDescription>
          </div>
          <Button onClick={handleRunAllSteps} disabled={isAnyStepRunning || runningAllSteps}>
            {runningAllSteps ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                処理中...
              </>
            ) : (
              <>
                <PlayCircle className="mr-2 h-4 w-4" />
                全ステップ実行
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Step 1: Cache */}
        <PipelineStep
          stepNumber={1}
          title="動画の読み込み"
          description="Google Driveから動画ファイルを取得します"
          status={steps.cache.status}
          isExpanded={expandedStep === 'cache'}
          onToggle={() => toggleStep('cache')}
          onExecute={handleCacheVideo}
          canExecute={!isAnyStepRunning}
          error={steps.cache.error}
          progressMessage={steps.cache.status === 'running' ? progressMessage : undefined}
        >
          {renderCacheDetails()}
        </PipelineStep>

        {/* Step 2: Extract Audio */}
        <PipelineStep
          stepNumber={2}
          title="音声の取り出し"
          description="動画から音声データを取り出します"
          status={steps.extractAudio.status}
          isExpanded={expandedStep === 'extractAudio'}
          onToggle={() => toggleStep('extractAudio')}
          onExecute={handleExtractAudio}
          canExecute={!isAnyStepRunning && steps.cache.status === 'completed'}
          error={steps.extractAudio.error}
          progressMessage={steps.extractAudio.status === 'running' ? progressMessage : undefined}
        >
          {renderExtractAudioDetails()}
        </PipelineStep>

        {/* Step 3: Transcribe */}
        <PipelineStep
          stepNumber={3}
          title="音声を文字に変換"
          description="音声を解析してテキストに変換します"
          status={steps.transcribe.status}
          isExpanded={expandedStep === 'transcribe'}
          onToggle={() => toggleStep('transcribe')}
          onExecute={handleTranscribeAudio}
          canExecute={
            !isAnyStepRunning &&
            (steps.extractAudio.status === 'completed' || steps.cache.status === 'completed')
          }
          error={steps.transcribe.error}
          progressMessage={steps.transcribe.status === 'running' ? progressMessage : undefined}
        >
          {renderTranscribeDetails()}
        </PipelineStep>

        {/* Step 4: Refine */}
        <PipelineStep
          stepNumber={4}
          title="字幕テキストの整形"
          description="AIが文章を読みやすく整え、誤字を修正します"
          status={steps.refine.status}
          isExpanded={expandedStep === 'refine'}
          onToggle={() => toggleStep('refine')}
          onExecute={handleRefineTranscript}
          canExecute={!isAnyStepRunning && steps.transcribe.status === 'completed'}
          error={steps.refine.error}
          progressMessage={steps.refine.status === 'running' ? progressMessage : undefined}
        >
          {renderRefineDetails()}
        </PipelineStep>
      </CardContent>
    </Card>
  );
}
