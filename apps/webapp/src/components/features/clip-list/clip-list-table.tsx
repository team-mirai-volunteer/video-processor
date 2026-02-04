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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatDate } from '@/lib/utils';
import type { AllClipSummary, Pagination } from '@video-processor/shared';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface ClipListTableProps {
  clips: AllClipSummary[];
  pagination: Pagination;
}

function truncateText(text: string | null, maxLength: number): string {
  if (!text) return '-';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}...`;
}

function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

export function ClipListTable({ clips, pagination }: ClipListTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/clips?${params.toString()}`);
  };

  if (clips.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">クリップがまだありません。</div>
    );
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div className="space-y-4">
        <Table className="text-xs sm:text-sm">
          <TableHeader>
            <TableRow>
              <TableHead>元動画</TableHead>
              <TableHead>DL</TableHead>
              <TableHead className="min-w-[20ch]">クリップタイトル</TableHead>
              <TableHead>動画長</TableHead>
              <TableHead className="min-w-[20ch] max-w-2xl">切り抜き文章</TableHead>
              <TableHead>作成日時</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {clips.map((clip) => (
              <TableRow key={clip.id}>
                <TableCell className="font-medium">
                  <Link href={`/videos/${clip.videoId}`} className="hover:underline text-primary">
                    {clip.videoTitle || 'タイトルなし'}
                  </Link>
                </TableCell>
                <TableCell>
                  {clip.googleDriveUrl ? (
                    <a
                      href={clip.googleDriveUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors"
                    >
                      DL
                    </a>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>{clip.title || '-'}</TableCell>
                <TableCell>{formatDuration(clip.durationSeconds)}</TableCell>
                <TableCell className="max-w-2xl">
                  {clip.transcript && clip.transcript.length > 50 ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-default">{truncateText(clip.transcript, 50)}</span>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-2xl whitespace-pre-wrap">
                        {clip.transcript}
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span>{truncateText(clip.transcript, 50)}</span>
                  )}
                </TableCell>
                <TableCell>{formatDate(clip.createdAt)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        <div className="flex items-center justify-between px-4">
          <p className="text-sm text-muted-foreground">
            全{pagination.total}件中 {(pagination.page - 1) * pagination.limit + 1}-
            {Math.min(pagination.page * pagination.limit, pagination.total)}件を表示
          </p>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
              前へ
            </Button>
            <span className="text-sm">
              {pagination.page} / {pagination.totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
            >
              次へ
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
