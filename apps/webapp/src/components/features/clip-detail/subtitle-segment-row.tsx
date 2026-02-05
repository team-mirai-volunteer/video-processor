'use client';

import { Input } from '@/components/ui/input';
import { cn, formatDuration } from '@/lib/utils';
import {
  type ClipSubtitleSegment,
  SUBTITLE_MAX_CHARS_PER_LINE,
  SUBTITLE_MAX_LINES,
} from '@video-processor/shared';

function formatTimeValue(seconds: number): string {
  return (Math.round(seconds * 100) / 100).toFixed(2);
}

interface SubtitleSegmentRowProps {
  segment: ClipSubtitleSegment;
  isActive?: boolean;
  isEditable?: boolean;
  onLinesChange?: (index: number, lines: string[]) => void;
  onTimeChange?: (
    index: number,
    field: 'startTimeSeconds' | 'endTimeSeconds',
    value: number
  ) => void;
  onSeek?: (timeSeconds: number) => void;
}

export function SubtitleSegmentRow({
  segment,
  isActive = false,
  isEditable = true,
  onLinesChange,
  onTimeChange,
  onSeek,
}: SubtitleSegmentRowProps) {
  const handleLineChange = (lineIndex: number, value: string) => {
    const newLines = [...segment.lines];
    newLines[lineIndex] = value;
    onLinesChange?.(segment.index, newLines);
  };

  const handleAddLine = () => {
    if (segment.lines.length < SUBTITLE_MAX_LINES) {
      onLinesChange?.(segment.index, [...segment.lines, '']);
    }
  };

  const handleRemoveLine = (lineIndex: number) => {
    if (segment.lines.length > 1) {
      const newLines = segment.lines.filter((_, i) => i !== lineIndex);
      onLinesChange?.(segment.index, newLines);
    }
  };

  const handleStartTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value);
    if (!Number.isNaN(value) && value >= 0) {
      onTimeChange?.(segment.index, 'startTimeSeconds', value);
    }
  };

  const handleEndTimeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number.parseFloat(e.target.value);
    if (!Number.isNaN(value) && value >= 0) {
      onTimeChange?.(segment.index, 'endTimeSeconds', value);
    }
  };

  const handleSeek = () => {
    onSeek?.(segment.startTimeSeconds);
  };

  // 各行の文字数超過チェック
  const hasOverflowLine = segment.lines.some((line) => line.length > SUBTITLE_MAX_CHARS_PER_LINE);

  return (
    <div
      className={cn(
        'flex items-start gap-3 p-2 rounded-md transition-colors',
        isActive && 'bg-primary/10 border border-primary/30',
        !isActive && 'hover:bg-muted/50'
      )}
    >
      <span className="text-xs text-muted-foreground w-6 text-center shrink-0 pt-2">
        {segment.index + 1}
      </span>

      <button
        type="button"
        onClick={handleSeek}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 w-24 text-left pt-2"
        title="この位置から再生"
      >
        {formatDuration(segment.startTimeSeconds)} - {formatDuration(segment.endTimeSeconds)}
      </button>

      <div className="flex-1 flex flex-col gap-1">
        {segment.lines.map((line, lineIndex) => (
          <div key={`line-${segment.index}-${lineIndex}`} className="flex items-center gap-1">
            {isEditable ? (
              <>
                <Input
                  value={line}
                  onChange={(e) => handleLineChange(lineIndex, e.target.value)}
                  className={cn(
                    'flex-1 h-8 text-sm',
                    line.length > SUBTITLE_MAX_CHARS_PER_LINE && 'border-red-500'
                  )}
                  placeholder={`${lineIndex + 1}行目 (${SUBTITLE_MAX_CHARS_PER_LINE}文字以内)`}
                  maxLength={SUBTITLE_MAX_CHARS_PER_LINE + 10} // 少し余裕を持たせる
                />
                <span
                  className={cn(
                    'text-xs w-10 text-right',
                    line.length > SUBTITLE_MAX_CHARS_PER_LINE
                      ? 'text-red-500'
                      : 'text-muted-foreground'
                  )}
                >
                  {line.length}
                </span>
                {segment.lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => handleRemoveLine(lineIndex)}
                    className="text-xs text-muted-foreground hover:text-red-500 px-1"
                    title="この行を削除"
                  >
                    ✕
                  </button>
                )}
              </>
            ) : (
              <span className="text-sm">{line}</span>
            )}
          </div>
        ))}
        {isEditable && segment.lines.length < SUBTITLE_MAX_LINES && (
          <button
            type="button"
            onClick={handleAddLine}
            className="text-xs text-muted-foreground hover:text-primary self-start"
          >
            + 行を追加
          </button>
        )}
      </div>

      {isEditable && (
        <div className="flex items-center gap-1 shrink-0 pt-1">
          <Input
            type="number"
            value={formatTimeValue(segment.startTimeSeconds)}
            onChange={handleStartTimeChange}
            className="w-20 h-8 text-xs"
            step={0.1}
            min={0}
            title="開始時間（秒）"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            value={formatTimeValue(segment.endTimeSeconds)}
            onChange={handleEndTimeChange}
            className="w-20 h-8 text-xs"
            step={0.1}
            min={0}
            title="終了時間（秒）"
          />
        </div>
      )}

      {hasOverflowLine && (
        <span className="text-xs text-red-500 shrink-0 pt-2" title="16文字を超えている行があります">
          超過
        </span>
      )}
    </div>
  );
}
