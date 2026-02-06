'use client';

import { Button } from '@/components/ui/button';
import { formatDate } from '@/lib/utils';
import type { AllClipSummary, Pagination } from '@video-processor/shared';
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  FileText,
  Subtitles,
  Video,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

interface ClipListTableProps {
  clips: AllClipSummary[];
  pagination: Pagination;
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
    <div className="space-y-4">
      <div className="grid gap-3 px-4">
        {clips.map((clip) => (
          <div
            key={clip.id}
            className="border rounded-lg p-4 space-y-3 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <Link
                href={`/clips/${clip.id}`}
                className="text-sm font-semibold hover:underline leading-snug"
              >
                {clip.title || 'タイトルなし'}
              </Link>
              <div className="flex items-center gap-1 shrink-0">
                <Link
                  href={`/clips/${clip.id}`}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors"
                >
                  <Subtitles className="h-3 w-3" />
                  字幕をつける
                </Link>
                {clip.googleDriveUrl && (
                  <a
                    href={clip.googleDriveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-white bg-black rounded hover:bg-gray-800 transition-colors"
                  >
                    <Download className="h-3 w-3" />
                    DL
                  </a>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <Video className="h-3 w-3" />
                <Link href={`/videos/${clip.videoId}`} className="underline hover:text-foreground">
                  {clip.videoTitle || 'タイトルなし'}
                </Link>
              </span>
              <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                <Clock className="h-3 w-3" />
                {formatDuration(clip.durationSeconds)}
              </span>
              {clip.hasSubtitledVideo && (
                <span className="inline-flex items-center gap-1 text-blue-600">
                  <Subtitles className="h-3 w-3" />
                  字幕付き
                </span>
              )}
              <span>{formatDate(clip.createdAt)}</span>
            </div>

            {clip.transcript && (
              <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                <FileText className="h-3 w-3 inline mr-1 align-text-top" />
                {clip.transcript}
              </p>
            )}
          </div>
        ))}
      </div>

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
  );
}
