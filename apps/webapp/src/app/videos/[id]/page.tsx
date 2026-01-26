import { VideoDetailClient } from '@/app/videos/[id]/video-detail-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BackendApiError } from '@/server/infrastructure/clients/backend-client';
import { loadRefinedTranscription } from '@/server/presentation/loaders/loadRefinedTranscription';
import { loadTranscription } from '@/server/presentation/loaders/loadTranscription';
import { loadVideo } from '@/server/presentation/loaders/loadVideo';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function VideoDetailPage({ params }: Props) {
  const { id } = await params;

  try {
    const video = await loadVideo(id);

    // Fetch transcription data if available
    let transcription = null;
    let refinedTranscription = null;

    if (
      video.status === 'transcribed' ||
      video.status === 'extracting' ||
      video.status === 'completed'
    ) {
      try {
        [transcription, refinedTranscription] = await Promise.all([
          loadTranscription(id),
          loadRefinedTranscription(id),
        ]);
      } catch {
        // Transcription might not exist yet
      }
    }

    return (
      <VideoDetailClient
        video={video}
        initialTranscription={transcription}
        initialRefinedTranscription={refinedTranscription}
      />
    );
  } catch (err) {
    const errorMessage =
      err instanceof BackendApiError && err.status === 404
        ? '動画が見つかりません'
        : '動画の取得に失敗しました';

    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-destructive">{errorMessage}</div>
          </CardContent>
        </Card>
      </div>
    );
  }
}
