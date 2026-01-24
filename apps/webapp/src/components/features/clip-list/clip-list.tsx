'use client';

import type { Clip } from '@video-processor/shared';
import { ClipCard } from './clip-card';

interface ClipListProps {
  clips: Clip[];
}

export function ClipList({ clips }: ClipListProps) {
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
        <ClipCard key={clip.id} clip={clip} />
      ))}
    </div>
  );
}
