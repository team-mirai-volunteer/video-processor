'use client';

import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
} from '@video-processor/shared';
import { Loader2, Sparkles } from 'lucide-react';
import { RawTranscriptView } from './raw-transcript-view';
import { RefinedTranscriptView } from './refined-transcript-view';

interface TranscriptViewerProps {
  rawTranscription: GetTranscriptionResponse | null;
  refinedTranscription: GetRefinedTranscriptionResponse | null;
  onRefine: () => void;
  isRefining: boolean;
  isLoadingRefined: boolean;
}

export function TranscriptViewer({
  rawTranscription,
  refinedTranscription,
  onRefine,
  isRefining,
  isLoadingRefined,
}: TranscriptViewerProps) {
  if (!rawTranscription) {
    return null;
  }

  const hasRefined = refinedTranscription !== null;
  const defaultTab = hasRefined ? 'refined' : 'raw';

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="raw">Raw (生データ)</TabsTrigger>
          <TabsTrigger value="refined" disabled={!hasRefined && !isLoadingRefined}>
            Refined (校正済み)
            {isLoadingRefined && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
          </TabsTrigger>
        </TabsList>

        {!hasRefined && !isRefining && !isLoadingRefined && (
          <Button onClick={onRefine} variant="outline" size="sm">
            <Sparkles className="mr-2 h-4 w-4" />
            AIで校正する
          </Button>
        )}

        {isRefining && (
          <Button variant="outline" size="sm" disabled>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            校正中...
          </Button>
        )}
      </div>

      <TabsContent value="raw">
        <RawTranscriptView transcription={rawTranscription} />
      </TabsContent>

      <TabsContent value="refined">
        {isLoadingRefined ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="ml-2 text-muted-foreground">校正済みデータを読み込み中...</span>
          </div>
        ) : refinedTranscription ? (
          <RefinedTranscriptView refinedTranscription={refinedTranscription} />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <Sparkles className="h-8 w-8 mx-auto mb-4 opacity-50" />
            <p>校正済みのトランスクリプトはまだありません。</p>
            <p className="text-sm mt-2">「AIで校正する」ボタンをクリックして作成できます。</p>
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
