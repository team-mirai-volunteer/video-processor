'use client';

import { Input } from '@/components/ui/input';
import { cn, formatDuration } from '@/lib/utils';
import type { ClipSubtitleSegment } from '@video-processor/shared';

interface SubtitleSegmentRowProps {
  segment: ClipSubtitleSegment;
  isActive?: boolean;
  isEditable?: boolean;
  onTextChange?: (index: number, text: string) => void;
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
  onTextChange,
  onTimeChange,
  onSeek,
}: SubtitleSegmentRowProps) {
  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onTextChange?.(segment.index, e.target.value);
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

  return (
    <div
      className={cn(
        'flex items-center gap-3 p-2 rounded-md transition-colors',
        isActive && 'bg-primary/10 border border-primary/30',
        !isActive && 'hover:bg-muted/50'
      )}
    >
      <span className="text-xs text-muted-foreground w-6 text-center shrink-0">
        {segment.index + 1}
      </span>

      <button
        type="button"
        onClick={handleSeek}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors shrink-0 w-24 text-left"
        title="この位置から再生"
      >
        {formatDuration(segment.startTimeSeconds)} - {formatDuration(segment.endTimeSeconds)}
      </button>

      {isEditable ? (
        <Input
          value={segment.text}
          onChange={handleTextChange}
          className={cn('flex-1 h-8 text-sm', segment.text.length > 25 && 'border-yellow-500')}
          placeholder="字幕テキスト"
        />
      ) : (
        <span className="flex-1 text-sm">{segment.text}</span>
      )}

      {isEditable && (
        <div className="flex items-center gap-1 shrink-0">
          <Input
            type="number"
            value={segment.startTimeSeconds.toFixed(2)}
            onChange={handleStartTimeChange}
            className="w-20 h-8 text-xs"
            step={0.1}
            min={0}
            title="開始時間（秒）"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            value={segment.endTimeSeconds.toFixed(2)}
            onChange={handleEndTimeChange}
            className="w-20 h-8 text-xs"
            step={0.1}
            min={0}
            title="終了時間（秒）"
          />
        </div>
      )}

      {segment.text.length > 25 && (
        <span className="text-xs text-yellow-600" title="25文字を超えています">
          {segment.text.length}文字
        </span>
      )}
    </div>
  );
}
