'use client';

import { StatusBadge } from '@/components/features/video-list/status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { deleteVideo } from '@/server/presentation/actions/deleteVideo';
import type { VideoSummary } from '@video-processor/shared';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';

interface VideoTableProps {
  videos: VideoSummary[];
}

export function VideoTable({ videos }: VideoTableProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (videoId: string) => {
    setDeletingId(videoId);
    try {
      await deleteVideo(videoId);
    } finally {
      setDeletingId(null);
    }
  };

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
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/videos/${video.id}`}>詳細</Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={deletingId === video.id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>動画を削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        「{video.title || 'タイトルなし'}」を削除します。
                        関連するクリップ、文字起こし、処理ジョブも削除されます。
                        この操作は取り消せません。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(video.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        削除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
