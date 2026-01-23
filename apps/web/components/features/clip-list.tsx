'use client';

import type { Clip } from '@video-processor/shared';
import { ClipCard } from './clip-card';

interface ClipListProps {
  clips: Clip[];
}

export function ClipList({ clips }: ClipListProps) {
  if (!clips.length) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">
        クリップがまだありません
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <ClipCard key={clip.id} clip={clip} />
      ))}
    </div>
  );
}
