'use client';

import { ClipCard } from '@/components/features/clip-list/clip-card';
import type { Clip } from '@video-processor/shared';

interface ClipListProps {
  clips: Clip[];
  onClipDelete?: (clipId: string) => void;
}

export function ClipList({ clips, onClipDelete }: ClipListProps) {
  if (clips.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        クリップがまだありません。処理が完了するとここに表示されます。
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} onDelete={onClipDelete} />
      ))}
    </div>
  );
}
