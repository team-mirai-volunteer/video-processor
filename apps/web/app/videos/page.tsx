import Link from 'next/link';
import { Plus } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { VideoList } from '@/components/features/video-list';

export default function VideosPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">動画一覧</h1>
          <p className="text-muted-foreground">
            登録済みの動画と処理ステータスを確認できます
          </p>
        </div>
        <Link href="/submit" className={buttonVariants()}>
          <Plus className="mr-2 h-4 w-4" />
          新規登録
        </Link>
      </div>

      <VideoList />
    </div>
  );
}
