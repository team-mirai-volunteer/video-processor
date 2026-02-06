'use client';

import { Button } from '@/components/ui/button';
import { formatTimestamp } from '@/lib/utils';
import type { GetRefinedTranscriptionResponse, RefinedSentence } from '@video-processor/shared';
import { AlertTriangle, Check, Loader2, Scissors, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

/** 最大クリップ長（秒） = 10分 */
const MAX_CLIP_DURATION_SECONDS = 600;

interface TimelineClipSelectorProps {
  refinedTranscription: GetRefinedTranscriptionResponse;
  onExtract: (startTimeSeconds: number, endTimeSeconds: number, title?: string) => Promise<void>;
  disabled?: boolean;
}

/** 選択されたインデックスが連続しているかチェック */
function isContiguous(indices: Set<number>): boolean {
  if (indices.size <= 1) return true;
  const sorted = [...indices].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if ((sorted[i] as number) !== (sorted[i - 1] as number) + 1) return false;
  }
  return true;
}

export function TimelineClipSelector({
  refinedTranscription,
  onExtract,
  disabled = false,
}: TimelineClipSelectorProps) {
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sentences } = refinedTranscription;

  // 連続性チェック
  const contiguous = useMemo(() => isContiguous(selectedIndices), [selectedIndices]);

  // 選択範囲の時間情報を計算
  const selectionInfo = useMemo(() => {
    if (selectedIndices.size === 0) return null;

    const sorted = [...selectedIndices].sort((a, b) => a - b);
    const firstIndex = sorted[0];
    const lastIndex = sorted[sorted.length - 1];

    if (firstIndex === undefined || lastIndex === undefined) return null;

    const startSentence = sentences[firstIndex];
    const endSentence = sentences[lastIndex];

    if (!startSentence || !endSentence) return null;

    const startTimeSeconds = startSentence.startTimeSeconds;
    const endTimeSeconds = endSentence.endTimeSeconds;
    const durationSeconds = endTimeSeconds - startTimeSeconds;

    // 選択範囲のテキストを連結
    const selectedText = sorted.map((i) => sentences[i]?.text ?? '').join('');

    return {
      startTimeSeconds,
      endTimeSeconds,
      durationSeconds,
      selectedText,
    };
  }, [selectedIndices, sentences]);

  // バリデーション（連続性以外）
  const validationError = useMemo(() => {
    if (!selectionInfo) return null;

    if (selectionInfo.durationSeconds > MAX_CLIP_DURATION_SECONDS) {
      return `クリップは最大${MAX_CLIP_DURATION_SECONDS / 60}分までです（現在: ${(selectionInfo.durationSeconds / 60).toFixed(1)}分）`;
    }

    return null;
  }, [selectionInfo]);

  const handleSentenceClick = useCallback(
    (index: number) => {
      if (disabled || isExtracting) return;

      setError(null);

      setSelectedIndices((prev) => {
        const next = new Set(prev);
        if (next.has(index)) {
          next.delete(index);
        } else {
          next.add(index);
        }
        return next;
      });
    },
    [disabled, isExtracting]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedIndices(new Set());
    setError(null);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!selectionInfo || validationError || !contiguous) return;

    setIsExtracting(true);
    setError(null);

    try {
      await onExtract(selectionInfo.startTimeSeconds, selectionInfo.endTimeSeconds);
      // 成功時は選択をクリア
      setSelectedIndices(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : '切り抜き処理に失敗しました');
    } finally {
      setIsExtracting(false);
    }
  }, [selectionInfo, validationError, contiguous, onExtract]);

  const isSelected = useCallback((index: number) => selectedIndices.has(index), [selectedIndices]);

  const hasSelection = selectedIndices.size > 0;
  const canExtract = hasSelection && contiguous && !validationError;

  return (
    <div className="space-y-4">
      {/* 使い方の説明 */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
        <p>切り抜きたい範囲を連続する形で選択してください（複数選択可）。</p>
      </div>

      {/* 選択情報・アクションバー（常時表示） */}
      <div className="border rounded-lg p-4 bg-primary/5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            {selectionInfo ? (
              <>
                <div className="flex items-center gap-4 text-sm">
                  <span className="font-mono bg-muted px-2 py-0.5 rounded">
                    {formatTimestamp(selectionInfo.startTimeSeconds)} -{' '}
                    {formatTimestamp(selectionInfo.endTimeSeconds)}
                  </span>
                  <span className="text-muted-foreground">
                    {selectionInfo.durationSeconds.toFixed(1)}秒
                  </span>
                </div>
                {!contiguous && (
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    連続したセクションを選択してください（間が空いています）
                  </p>
                )}
                {contiguous && validationError && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <X className="h-3 w-3" />
                    {validationError}
                  </p>
                )}
                {contiguous && !validationError && (
                  <p className="text-sm text-green-600 flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    切り抜き可能な範囲が選択されています
                  </p>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                セクションを選択すると切り抜きできます
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearSelection}
              disabled={!hasSelection || isExtracting}
            >
              選択解除
            </Button>
            <Button
              size="sm"
              onClick={handleExtract}
              disabled={isExtracting || !canExtract || disabled}
            >
              {isExtracting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  処理中...
                </>
              ) : (
                <>
                  <Scissors className="mr-2 h-4 w-4" />
                  この範囲を切り抜き
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* エラー表示 */}
      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
      )}

      {/* センテンスリスト */}
      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {sentences.map((sentence, index) => (
          <SentenceRow
            key={`${sentence.startTimeSeconds}-${sentence.endTimeSeconds}`}
            sentence={sentence}
            index={index}
            isSelected={isSelected(index)}
            onClick={handleSentenceClick}
            disabled={disabled || isExtracting}
          />
        ))}
      </div>

      {sentences.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          文字起こしの校正結果がありません
        </div>
      )}
    </div>
  );
}

interface SentenceRowProps {
  sentence: RefinedSentence;
  index: number;
  isSelected: boolean;
  onClick: (index: number) => void;
  disabled: boolean;
}

function SentenceRow({ sentence, index, isSelected, onClick, disabled }: SentenceRowProps) {
  const handleClick = useCallback(() => {
    onClick(index);
  }, [index, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-3 flex items-center gap-3 transition-colors active:bg-primary/20 ${
        isSelected
          ? 'bg-primary/10 hover:bg-primary/15 border-l-4 border-l-primary'
          : 'hover:bg-muted/50 border-l-4 border-l-transparent'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {/* チェックボックス風インジケーター */}
      <span
        className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
          isSelected
            ? 'bg-primary border-primary text-primary-foreground'
            : 'border-muted-foreground/40 bg-background'
        }`}
      >
        {isSelected && <Check className="h-3 w-3" />}
      </span>
      <div className="flex-1 min-w-0">
        <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded whitespace-nowrap">
          {formatTimestamp(sentence.startTimeSeconds)} - {formatTimestamp(sentence.endTimeSeconds)}
        </span>
        <p className="text-sm leading-normal mt-1">{sentence.text}</p>
      </div>
    </button>
  );
}
