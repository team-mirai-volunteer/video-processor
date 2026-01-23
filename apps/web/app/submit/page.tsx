import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { buttonVariants } from '@/components/ui/button';
import { VideoForm } from '@/components/features/video-form';
import { cn } from '@/lib/utils';

export default function SubmitPage() {
  return (
    <div className="space-y-6">
      <Link
        href="/videos"
        className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }))}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        動画一覧に戻る
      </Link>

      <div>
        <h1 className="text-2xl font-bold tracking-tight">動画を登録</h1>
        <p className="text-muted-foreground">
          Google Driveの動画を登録して、AIに切り抜き箇所を指示します
        </p>
      </div>

      <div className="max-w-2xl">
        <VideoForm />
      </div>
    </div>
  );
}
