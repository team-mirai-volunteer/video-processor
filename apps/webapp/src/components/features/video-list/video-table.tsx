'use client';

import { StatusBadge } from '@/components/features/video-list/status-badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import type { VideoSummary } from '@video-processor/shared';
import Link from 'next/link';

interface VideoTableProps {
  videos: VideoSummary[];
}

export function VideoTable({ videos }: VideoTableProps) {
  if (videos.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">動画がまだ登録されていません。</div>
    );
  }

  return (
    <Table className="text-xs sm:text-sm">
      <TableHeader>
        <TableRow>
          <TableHead>タイトル</TableHead>
          <TableHead className="w-32">ステータス</TableHead>
          <TableHead className="text-center">クリップ数</TableHead>
          <TableHead>登録日時</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {videos.map((video) => (
          <TableRow key={video.id}>
            <TableCell className="font-medium">
              <Link href={`/videos/${video.id}`} className="underline">
                {video.title || 'タイトルなし'}
              </Link>
            </TableCell>
            <TableCell className="w-32">
              <StatusBadge status={video.status} />
            </TableCell>
            <TableCell className="text-center">{video.clipCount}</TableCell>
            <TableCell>{formatDate(video.createdAt)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
