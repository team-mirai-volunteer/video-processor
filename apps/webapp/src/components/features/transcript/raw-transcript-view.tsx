import { formatTimestamp } from '@/lib/utils';
import type { GetTranscriptionResponse } from '@video-processor/shared';
import { useState } from 'react';

interface RawTranscriptViewProps {
  transcription: GetTranscriptionResponse;
  showSegments?: boolean;
}

export function RawTranscriptView({
  transcription,
  showSegments: initialShowSegments = false,
}: RawTranscriptViewProps) {
  const [showSegments, setShowSegments] = useState(initialShowSegments);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span>言語: {transcription.languageCode}</span>
          <span>セグメント数: {transcription.segments.length}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowSegments(!showSegments)}
          className="text-sm text-primary hover:underline"
        >
          {showSegments ? 'セグメント詳細を隠す' : 'セグメント詳細を表示'}
        </button>
      </div>

      {showSegments ? (
        <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
          {transcription.segments.map((segment) => (
            <div
              key={`${segment.startTimeSeconds}-${segment.endTimeSeconds}`}
              className="p-3 hover:bg-muted/50"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="font-mono">
                  [{formatTimestamp(segment.startTimeSeconds)} -{' '}
                  {formatTimestamp(segment.endTimeSeconds)}]
                </span>
                <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                  信頼度: {(segment.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <p className="text-sm">{segment.text}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
          <p className="whitespace-pre-wrap text-sm">{transcription.fullText}</p>
        </div>
      )}
    </div>
  );
}
