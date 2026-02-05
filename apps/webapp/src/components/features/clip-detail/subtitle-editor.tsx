'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { composeSubtitledClip } from '@/server/presentation/clip-video/actions/composeSubtitledClip';
import { confirmClipSubtitles } from '@/server/presentation/clip-video/actions/confirmClipSubtitles';
import { generateClipSubtitles } from '@/server/presentation/clip-video/actions/generateClipSubtitles';
import { updateClipSubtitles } from '@/server/presentation/clip-video/actions/updateClipSubtitles';
import { uploadSubtitledClipToDrive } from '@/server/presentation/clip-video/actions/uploadSubtitledClipToDrive';
import type { ClipSubtitle, ClipSubtitleSegment } from '@video-processor/shared';
import { AlertCircle, CheckCircle, Loader2, Pencil, Sparkles, Undo } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';
import { SubtitleCompositionStatus } from './subtitle-composition-status';
import { SubtitleSegmentRow } from './subtitle-segment-row';

interface SubtitleEditorProps {
  clipId: string;
  initialSubtitle: ClipSubtitle | null;
  currentTimeSeconds?: number;
  subtitledVideoUrl?: string | null;
  subtitledVideoDriveUrl?: string | null;
  onSeek?: (timeSeconds: number) => void;
  onSubtitleUpdate?: (subtitle: ClipSubtitle) => void;
}

type MessageType = 'success' | 'error' | 'warning';

interface Message {
  type: MessageType;
  text: string;
}

export function SubtitleEditor({
  clipId,
  initialSubtitle,
  currentTimeSeconds = 0,
  subtitledVideoUrl: initialSubtitledVideoUrl,
  subtitledVideoDriveUrl: initialSubtitledVideoDriveUrl,
  onSeek,
  onSubtitleUpdate,
}: SubtitleEditorProps) {
  const [subtitle, setSubtitle] = useState<ClipSubtitle | null>(initialSubtitle);
  const [editedSegments, setEditedSegments] = useState<ClipSubtitleSegment[]>(
    initialSubtitle?.segments ?? []
  );
  const [subtitledVideoUrl, setSubtitledVideoUrl] = useState<string | null | undefined>(
    initialSubtitledVideoUrl
  );
  const [subtitledVideoDriveUrl, setSubtitledVideoDriveUrl] = useState<string | null | undefined>(
    initialSubtitledVideoDriveUrl
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [isComposing, setIsComposing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  const showMessage = useCallback((type: MessageType, text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 5000);
  }, []);

  const hasChanges = useMemo(() => {
    if (!subtitle) return false;
    return JSON.stringify(subtitle.segments) !== JSON.stringify(editedSegments);
  }, [subtitle, editedSegments]);

  const activeSegmentIndex = useMemo(() => {
    return editedSegments.findIndex(
      (seg) => currentTimeSeconds >= seg.startTimeSeconds && currentTimeSeconds < seg.endTimeSeconds
    );
  }, [editedSegments, currentTimeSeconds]);

  const handleGenerate = useCallback(async () => {
    setIsGenerating(true);
    setMessage(null);
    try {
      const result = await generateClipSubtitles(clipId);
      setSubtitle(result.subtitle);
      setEditedSegments(result.subtitle.segments);
      onSubtitleUpdate?.(result.subtitle);
      showMessage('success', `字幕を生成しました（${result.subtitle.segments.length}セグメント）`);
    } catch (error) {
      showMessage(
        'error',
        `字幕生成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsGenerating(false);
    }
  }, [clipId, onSubtitleUpdate, showMessage]);

  const handleLinesChange = useCallback((index: number, lines: string[]) => {
    setEditedSegments((prev) => prev.map((seg) => (seg.index === index ? { ...seg, lines } : seg)));
  }, []);

  const handleTimeChange = useCallback(
    (index: number, field: 'startTimeSeconds' | 'endTimeSeconds', value: number) => {
      setEditedSegments((prev) =>
        prev.map((seg) => (seg.index === index ? { ...seg, [field]: value } : seg))
      );
    },
    []
  );

  const handleSave = useCallback(async () => {
    if (!hasChanges) return;
    setIsUpdating(true);
    setMessage(null);
    try {
      const result = await updateClipSubtitles(clipId, { segments: editedSegments });
      setSubtitle(result.subtitle);
      setEditedSegments(result.subtitle.segments);
      onSubtitleUpdate?.(result.subtitle);
      showMessage('success', '字幕を保存しました');
    } catch (error) {
      showMessage(
        'error',
        `字幕の保存に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsUpdating(false);
    }
  }, [clipId, editedSegments, hasChanges, onSubtitleUpdate, showMessage]);

  const handleReset = useCallback(() => {
    if (subtitle) {
      setEditedSegments(subtitle.segments);
      setMessage(null);
    }
  }, [subtitle]);

  const handleConfirm = useCallback(async () => {
    if (hasChanges) {
      showMessage('warning', '確定前に編集内容を保存してください');
      return;
    }
    setIsConfirming(true);
    setMessage(null);
    try {
      const result = await confirmClipSubtitles(clipId);
      setSubtitle(result.subtitle);
      onSubtitleUpdate?.(result.subtitle);
      showMessage('success', '字幕を確定しました');
    } catch (error) {
      showMessage(
        'error',
        `字幕の確定に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsConfirming(false);
    }
  }, [clipId, hasChanges, onSubtitleUpdate, showMessage]);

  const handleCompose = useCallback(async () => {
    if (subtitle?.status !== 'confirmed') {
      showMessage('warning', '動画合成には字幕の確定が必要です');
      return;
    }
    setIsComposing(true);
    setMessage(null);
    try {
      const result = await composeSubtitledClip(clipId);
      setSubtitledVideoUrl(result.subtitledVideoUrl);
      showMessage('success', '動画の合成に成功しました');
    } catch (error) {
      showMessage(
        'error',
        `動画合成に失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsComposing(false);
    }
  }, [clipId, subtitle?.status, showMessage]);

  const handleUpload = useCallback(async () => {
    setIsUploading(true);
    setMessage(null);
    try {
      const result = await uploadSubtitledClipToDrive(clipId);
      setSubtitledVideoDriveUrl(result.driveUrl);
      showMessage('success', 'Driveにアップロードしました');
    } catch (error) {
      showMessage(
        'error',
        `アップロードに失敗しました: ${error instanceof Error ? error.message : '不明なエラー'}`
      );
    } finally {
      setIsUploading(false);
    }
  }, [clipId, showMessage]);

  const isEditable = subtitle?.status === 'draft';
  const canCompose = subtitle?.status === 'confirmed' && !subtitledVideoUrl;
  const compositionStep = subtitledVideoDriveUrl
    ? 'uploaded'
    : subtitledVideoUrl
      ? 'composed'
      : isComposing
        ? 'composing'
        : 'idle';

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={cn(
            'flex items-center gap-2 p-3 rounded-md text-sm',
            message.type === 'success' && 'bg-green-50 text-green-800 border border-green-200',
            message.type === 'warning' && 'bg-yellow-50 text-yellow-800 border border-yellow-200',
            message.type === 'error' && 'bg-red-50 text-red-800 border border-red-200'
          )}
        >
          {message.type === 'error' ? (
            <AlertCircle className="h-4 w-4 shrink-0" />
          ) : (
            <CheckCircle className="h-4 w-4 shrink-0" />
          )}
          <span>{message.text}</span>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Pencil className="h-4 w-4" />
              字幕
              {subtitle && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full ${
                    subtitle.status === 'confirmed'
                      ? 'bg-green-100 text-green-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {subtitle.status === 'confirmed' ? '確定済み' : '下書き'}
                </span>
              )}
            </CardTitle>
            {!subtitle && (
              <Button variant="outline" size="sm" onClick={handleGenerate} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-3 w-3" />
                    字幕を生成
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!subtitle ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              字幕がまだ生成されていません。「字幕を生成」ボタンをクリックしてください。
            </p>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1 max-h-96 overflow-y-auto">
                {editedSegments.map((segment) => (
                  <SubtitleSegmentRow
                    key={segment.index}
                    segment={segment}
                    isActive={segment.index === activeSegmentIndex}
                    isEditable={isEditable}
                    onLinesChange={handleLinesChange}
                    onTimeChange={handleTimeChange}
                    onSeek={onSeek}
                  />
                ))}
              </div>

              <div className="flex items-center justify-between gap-2 pt-4 border-t">
                <div className="flex items-center gap-2">
                  {isEditable && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleSave}
                        disabled={!hasChanges || isUpdating}
                      >
                        {isUpdating ? (
                          <>
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                            保存中...
                          </>
                        ) : (
                          '変更を保存'
                        )}
                      </Button>
                      {hasChanges && (
                        <Button variant="ghost" size="sm" onClick={handleReset}>
                          <Undo className="mr-2 h-3 w-3" />
                          元に戻す
                        </Button>
                      )}
                    </>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {isEditable && (
                    <Button
                      variant="default"
                      size="sm"
                      onClick={handleConfirm}
                      disabled={isConfirming || hasChanges}
                    >
                      {isConfirming ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          確定中...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="mr-2 h-3 w-3" />
                          字幕を確定
                        </>
                      )}
                    </Button>
                  )}

                  {subtitle.status === 'confirmed' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerate}
                      disabled={isGenerating}
                    >
                      {isGenerating ? (
                        <>
                          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          再生成中...
                        </>
                      ) : (
                        <>
                          <Sparkles className="mr-2 h-3 w-3" />
                          再生成
                        </>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {subtitle?.status === 'confirmed' && (
        <SubtitleCompositionStatus
          step={compositionStep}
          subtitledVideoUrl={subtitledVideoUrl}
          subtitledVideoDriveUrl={subtitledVideoDriveUrl}
          onCompose={handleCompose}
          onUpload={handleUpload}
          isComposing={isComposing}
          isUploading={isUploading}
          canCompose={canCompose}
        />
      )}
    </div>
  );
}
