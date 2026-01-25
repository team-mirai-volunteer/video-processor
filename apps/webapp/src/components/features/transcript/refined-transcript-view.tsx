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
            className="p-4 hover:bg-muted/50"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
              <span className="font-mono bg-muted px-2 py-0.5 rounded">
                {formatTimestamp(sentence.startTimeSeconds)} -{' '}
                {formatTimestamp(sentence.endTimeSeconds)}
              </span>
            </div>
            <p className="text-sm leading-relaxed">{sentence.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
