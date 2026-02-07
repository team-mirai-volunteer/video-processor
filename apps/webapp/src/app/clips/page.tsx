import { ClipListTable } from '@/components/features/clip-list/clip-list-table';
import { loadAllClips } from '@/server/presentation/clip-video/loaders/loadAllClips';

export const dynamic = 'force-dynamic';

interface ClipsPageProps {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function ClipsPage({ searchParams }: ClipsPageProps) {
  const params = await searchParams;
  const page = params.page ? Number.parseInt(params.page, 10) : 1;
  const limit = params.limit ? Number.parseInt(params.limit, 10) : 50;

  const response = await loadAllClips({ page, limit });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">クリップ一覧</h1>
        <p className="text-muted-foreground mt-1">
          気に入ったクリップを選んで、字幕をつけてSNSに投稿しよう！
        </p>
      </div>

      <ClipListTable clips={response.data} pagination={response.pagination} />
    </div>
  );
}
