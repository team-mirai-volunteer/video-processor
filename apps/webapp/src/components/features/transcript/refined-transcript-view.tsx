import { formatTimestamp } from '@/lib/utils';
import type { GetRefinedTranscriptionResponse } from '@video-processor/shared';

interface RefinedTranscriptViewProps {
  refinedTranscription: GetRefinedTranscriptionResponse;
}

export function RefinedTranscriptView({ refinedTranscription }: RefinedTranscriptViewProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>辞書バージョン: {refinedTranscription.dictionaryVersion}</span>
        <span>文数: {refinedTranscription.sentences.length}</span>
      </div>

      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {refinedTranscription.sentences.map((sentence) => (
          <div
            key={`${sentence.startTimeSeconds}-${sentence.endTimeSeconds}`}
            className="px-3 py-2 hover:bg-muted/50 flex items-center gap-3"
          >
            <span className="font-mono text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded whitespace-nowrap">
              {formatTimestamp(sentence.startTimeSeconds)} -{' '}
              {formatTimestamp(sentence.endTimeSeconds)}
            </span>
            <p className="text-sm leading-normal flex-1">{sentence.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
