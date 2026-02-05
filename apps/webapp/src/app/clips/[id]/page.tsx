import { ClipDetailClient } from '@/app/clips/[id]/clip-detail-client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { BackendApiError } from '@/server/infrastructure/clients/backend-client';
import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { loadClipDetail } from '@/server/presentation/clip-video/loaders/loadClipDetail';
import { loadVideo } from '@/server/presentation/clip-video/loaders/loadVideo';
import type { ClipSubtitle } from '@video-processor/shared';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ClipDetailPage({ params }: Props) {
  const { id } = await params;

  try {
    const clip = await loadClipDetail(id);

    if (!clip) {
      return (
        <div className="space-y-6">
          <Button variant="ghost" asChild>
            <Link href="/clips">
              <ArrowLeft className="mr-2 h-4 w-4" />
              一覧に戻る
            </Link>
          </Button>
          <Card>
            <CardContent className="py-12">
              <div className="text-center text-destructive">クリップが見つかりません</div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // Fetch video information and subtitle in parallel
    let videoTitle: string | null = null;
    let initialSubtitle: ClipSubtitle | null = null;

    const [videoResult, subtitleResult] = await Promise.allSettled([
      loadVideo(clip.videoId),
      getBackendClient().getClipSubtitle(clip.id, { revalidate: false }),
    ]);

    if (videoResult.status === 'fulfilled') {
      videoTitle = videoResult.value.title;
    }
    if (subtitleResult.status === 'fulfilled' && subtitleResult.value.subtitle) {
      initialSubtitle = subtitleResult.value.subtitle;
    }

    return (
      <ClipDetailClient clip={clip} videoTitle={videoTitle} initialSubtitle={initialSubtitle} />
    );
  } catch (err) {
    const errorMessage =
      err instanceof BackendApiError && err.status === 404
        ? 'クリップが見つかりません'
        : 'クリップの取得に失敗しました';

    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/clips">
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
