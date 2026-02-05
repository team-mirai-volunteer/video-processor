'use client';

import { Button } from '@/components/ui/button';
import { formatTimestamp } from '@/lib/utils';
import type { GetRefinedTranscriptionResponse, RefinedSentence } from '@video-processor/shared';
import { Check, Loader2, Scissors, X } from 'lucide-react';
import { useCallback, useMemo, useState } from 'react';

/** 最小クリップ長（秒） */
const MIN_CLIP_DURATION_SECONDS = 5;
/** 最大クリップ長（秒） = 10分 */
const MAX_CLIP_DURATION_SECONDS = 600;

interface TimeRange {
  startIndex: number;
  endIndex: number;
}

interface TimelineClipSelectorProps {
  refinedTranscription: GetRefinedTranscriptionResponse;
  onExtract: (startTimeSeconds: number, endTimeSeconds: number, title?: string) => Promise<void>;
  disabled?: boolean;
}

export function TimelineClipSelector({
  refinedTranscription,
  onExtract,
  disabled = false,
}: TimelineClipSelectorProps) {
  const [selectedRange, setSelectedRange] = useState<TimeRange | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { sentences } = refinedTranscription;

  // 選択範囲の時間情報を計算
  const selectionInfo = useMemo(() => {
    if (!selectedRange) return null;

    const startSentence = sentences[selectedRange.startIndex];
    const endSentence = sentences[selectedRange.endIndex];

    if (!startSentence || !endSentence) return null;

    const startTimeSeconds = startSentence.startTimeSeconds;
    const endTimeSeconds = endSentence.endTimeSeconds;
    const durationSeconds = endTimeSeconds - startTimeSeconds;

    // 選択範囲のテキストを連結
    const selectedText = sentences
      .slice(selectedRange.startIndex, selectedRange.endIndex + 1)
      .map((s) => s.text)
      .join('');

    return {
      startTimeSeconds,
      endTimeSeconds,
      durationSeconds,
      selectedText,
    };
  }, [selectedRange, sentences]);

  // バリデーション
  const validationError = useMemo(() => {
    if (!selectionInfo) return null;

    if (selectionInfo.durationSeconds < MIN_CLIP_DURATION_SECONDS) {
      return `クリップは最低${MIN_CLIP_DURATION_SECONDS}秒以上必要です（現在: ${selectionInfo.durationSeconds.toFixed(1)}秒）`;
    }

    if (selectionInfo.durationSeconds > MAX_CLIP_DURATION_SECONDS) {
      return `クリップは最大${MAX_CLIP_DURATION_SECONDS / 60}分までです（現在: ${(selectionInfo.durationSeconds / 60).toFixed(1)}分）`;
    }

    return null;
  }, [selectionInfo]);

  const handleSentenceClick = useCallback(
    (index: number, event: React.MouseEvent) => {
      if (disabled || isExtracting) return;

      setError(null);

      if (event.shiftKey && selectedRange !== null) {
        // Shift+クリックで範囲拡張
        const newStartIndex = Math.min(selectedRange.startIndex, index);
        const newEndIndex = Math.max(selectedRange.endIndex, index);
        setSelectedRange({ startIndex: newStartIndex, endIndex: newEndIndex });
      } else {
        // 通常クリックで新規選択開始
        setSelectedRange({ startIndex: index, endIndex: index });
      }
    },
    [disabled, isExtracting, selectedRange]
  );

  const handleClearSelection = useCallback(() => {
    setSelectedRange(null);
    setError(null);
  }, []);

  const handleExtract = useCallback(async () => {
    if (!selectionInfo || validationError) return;

    setIsExtracting(true);
    setError(null);

    try {
      await onExtract(selectionInfo.startTimeSeconds, selectionInfo.endTimeSeconds);
      // 成功時は選択をクリア
      setSelectedRange(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '切り抜き処理に失敗しました');
    } finally {
      setIsExtracting(false);
    }
  }, [selectionInfo, validationError, onExtract]);

  const isSelected = useCallback(
    (index: number) => {
      if (!selectedRange) return false;
      return index >= selectedRange.startIndex && index <= selectedRange.endIndex;
    },
    [selectedRange]
  );

  return (
    <div className="space-y-4">
      {/* 使い方の説明 */}
      <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-md">
        <p>
          タイムラインから切り抜きたい範囲を選択してください。
          クリックで開始位置を選択し、Shift+クリックで終了位置を選択できます。
        </p>
      </div>

      {/* 選択情報の表示 */}
      {selectionInfo && (
        <div className="border rounded-lg p-4 bg-primary/5">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-4 text-sm">
                <span className="font-mono bg-muted px-2 py-0.5 rounded">
                  {formatTimestamp(selectionInfo.startTimeSeconds)} -{' '}
                  {formatTimestamp(selectionInfo.endTimeSeconds)}
                </span>
                <span className="text-muted-foreground">
                  {selectionInfo.durationSeconds.toFixed(1)}秒
                </span>
              </div>
              {validationError && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <X className="h-3 w-3" />
                  {validationError}
                </p>
              )}
              {!validationError && (
                <p className="text-sm text-green-600 flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  切り抜き可能な範囲が選択されています
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearSelection}
                disabled={isExtracting}
              >
                選択解除
              </Button>
              <Button
                size="sm"
                onClick={handleExtract}
                disabled={isExtracting || !!validationError || disabled}
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
      )}

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
  onClick: (index: number, event: React.MouseEvent) => void;
  disabled: boolean;
}

function SentenceRow({ sentence, index, isSelected, onClick, disabled }: SentenceRowProps) {
  const handleClick = useCallback(
    (event: React.MouseEvent) => {
      onClick(index, event);
    },
    [index, onClick]
  );

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled}
      className={`w-full text-left px-3 py-2 flex items-center gap-3 transition-colors ${
        isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded whitespace-nowrap">
        {formatTimestamp(sentence.startTimeSeconds)} - {formatTimestamp(sentence.endTimeSeconds)}
      </span>
      <p className="text-sm leading-normal flex-1">{sentence.text}</p>
      {isSelected && (
        <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
          選択中
        </span>
      )}
    </button>
  );
}
