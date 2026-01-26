'use client';

import { RefinedTranscriptView } from '@/components/features/transcript/refined-transcript-view';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type {
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
} from '@video-processor/shared';
import { Check, Copy, Loader2, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';

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
  const [copiedTab, setCopiedTab] = useState<string | null>(null);

  const rawJson = useMemo(() => {
    if (!rawTranscription) return '';
    return JSON.stringify(rawTranscription, null, 2);
  }, [rawTranscription]);

  const refinedText = useMemo(() => {
    if (!refinedTranscription) return '';
    return refinedTranscription.sentences.map((s) => s.text).join('\n');
  }, [refinedTranscription]);

  const refinedJson = useMemo(() => {
    if (!refinedTranscription) return '';
    const filtered = {
      ...refinedTranscription,
      sentences: refinedTranscription.sentences.map(
        ({ originalSegmentIndices: _, ...rest }) => rest
      ),
    };
    return JSON.stringify(filtered, null, 2);
  }, [refinedTranscription]);

  const handleCopy = async (text: string, tab: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedTab(tab);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  if (!rawTranscription) {
    return null;
  }

  const hasRefined = refinedTranscription !== null;
  const defaultTab = hasRefined ? 'timeline' : 'raw-json';

  return (
    <Tabs defaultValue={defaultTab} className="w-full">
      <div className="flex items-center justify-between mb-4">
        <TabsList>
          <TabsTrigger value="timeline" disabled={!hasRefined && !isLoadingRefined}>
            タイムライン
            {isLoadingRefined && <Loader2 className="ml-2 h-3 w-3 animate-spin" />}
          </TabsTrigger>
          <TabsTrigger value="plain-text" disabled={!hasRefined}>
            PlainText
          </TabsTrigger>
          <TabsTrigger value="json" disabled={!hasRefined}>
            JSON
          </TabsTrigger>
          <TabsTrigger value="raw-json">文字起こし（校正前）</TabsTrigger>
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

      <TabsContent value="timeline">
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
            <p>校正済みの文字起こしはまだありません。</p>
            <p className="text-sm mt-2">「AIで校正する」ボタンをクリックして作成できます。</p>
          </div>
        )}
      </TabsContent>

      <TabsContent value="plain-text">
        {refinedTranscription && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 z-10"
              onClick={() => handleCopy(refinedText, 'plain-text')}
            >
              {copiedTab === 'plain-text' ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </Button>
            <pre className="border rounded-lg p-4 max-h-96 overflow-y-auto text-sm whitespace-pre-wrap bg-muted/30">
              {refinedText}
            </pre>
          </div>
        )}
      </TabsContent>

      <TabsContent value="json">
        {refinedTranscription && (
          <div className="relative">
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2 z-10"
              onClick={() => handleCopy(refinedJson, 'json')}
            >
              {copiedTab === 'json' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
            <pre className="border rounded-lg p-4 max-h-96 overflow-y-auto text-sm font-mono bg-muted/30 overflow-x-auto">
              {refinedJson}
            </pre>
          </div>
        )}
      </TabsContent>

      <TabsContent value="raw-json">
        <div className="relative">
          <Button
            variant="outline"
            size="sm"
            className="absolute top-2 right-2 z-10"
            onClick={() => handleCopy(rawJson, 'raw-json')}
          >
            {copiedTab === 'raw-json' ? (
              <Check className="h-4 w-4" />
            ) : (
              <Copy className="h-4 w-4" />
            )}
          </Button>
          <pre className="border rounded-lg p-4 max-h-96 overflow-y-auto text-sm font-mono bg-muted/30 overflow-x-auto">
            {rawJson}
          </pre>
        </div>
      </TabsContent>
    </Tabs>
  );
}
