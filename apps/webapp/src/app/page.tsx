import { VideoTable } from '@/components/features/video-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadVideos } from '@/server/presentation/loaders/loadVideos';
import { Plus } from 'lucide-react';
import Link from 'next/link';

export default async function HomePage() {
  const response = await loadVideos();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">動画一覧</h1>
          <p className="text-muted-foreground mt-1">登録された動画と処理状況を確認できます</p>
        </div>
        <Button asChild>
          <Link href="/submit">
            <Plus className="mr-2 h-4 w-4" />
            動画を登録
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>登録済み動画</CardTitle>
          <CardDescription>Google Driveから登録された動画の一覧です</CardDescription>
        </CardHeader>
        <CardContent>
          <VideoTable videos={response.data} />
        </CardContent>
      </Card>
    </div>
  );
}
