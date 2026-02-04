import { VideoTable } from '@/components/features/video-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadVideos } from '@/server/presentation/clip-video/loaders/loadVideos';

export const dynamic = 'force-dynamic';

export default async function VideosPage() {
  const response = await loadVideos();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">動画一覧</h1>
        <p className="text-muted-foreground mt-1">登録された動画と処理状況を確認できます</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>登録済み動画</CardTitle>
          <CardDescription>Google Driveから登録された動画の一覧です</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <VideoTable videos={response.data} />
        </CardContent>
      </Card>
    </div>
  );
}
