'use client';

import { Button } from '@/components/ui/button';
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
import { StatusBadge } from './status-badge';

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
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>タイトル</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead className="text-center">クリップ数</TableHead>
          <TableHead>登録日時</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {videos.map((video) => (
          <TableRow key={video.id}>
            <TableCell className="font-medium">
              <Link href={`/videos/${video.id}`} className="hover:underline">
                {video.title || 'タイトルなし'}
              </Link>
            </TableCell>
            <TableCell>
              <StatusBadge status={video.status} />
            </TableCell>
            <TableCell className="text-center">{video.clipCount}</TableCell>
            <TableCell>{formatDate(video.createdAt)}</TableCell>
            <TableCell className="text-right">
              <Button variant="outline" size="sm" asChild>
                <Link href={`/videos/${video.id}`}>詳細</Link>
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
