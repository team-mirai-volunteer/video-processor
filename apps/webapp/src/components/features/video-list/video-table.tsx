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
    <div className="overflow-x-auto">
      <Table className="text-xs sm:text-sm">
        <TableHeader>
          <TableRow>
            <TableHead className="px-2">タイトル</TableHead>
            <TableHead className="px-2 min-w-32 whitespace-nowrap">ステータス</TableHead>
            <TableHead className="px-2 min-w-24 whitespace-nowrap text-center">
              クリップ数
            </TableHead>
            <TableHead className="px-2 min-w-28 whitespace-nowrap">登録日時</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {videos.map((video) => (
            <TableRow key={video.id}>
              <TableCell className="px-2 font-medium min-w-52">
                <Link href={`/videos/${video.id}`} className="underline">
                  {video.title || 'タイトルなし'}
                </Link>
              </TableCell>
              <TableCell className="px-2 min-w-32">
                <StatusBadge status={video.status} />
              </TableCell>
              <TableCell className="px-2 min-w-24 text-center">{video.clipCount}</TableCell>
              <TableCell className="px-2 min-w-28">{formatDate(video.createdAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
