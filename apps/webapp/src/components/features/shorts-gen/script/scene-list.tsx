'use client';

import { cn } from '@/lib/utils';
import { FileText } from 'lucide-react';
import { SceneCard } from './scene-card';
import type { Scene } from './types';

interface SceneListProps {
  scenes: Scene[];
  onEditScene?: (scene: Scene) => void;
  className?: string;
}

export function SceneList({ scenes, onEditScene, className }: SceneListProps) {
  if (scenes.length === 0) {
    return (
      <div
        className={cn(
          'flex flex-col items-center justify-center py-8 text-muted-foreground',
          className
        )}
      >
        <FileText className="h-12 w-12 mb-2 opacity-50" />
        <p className="text-sm">シーンがありません</p>
        <p className="text-xs mt-1">チャットで台本を生成してください</p>
      </div>
    );
  }

  // Sort scenes by order
  const sortedScenes = [...scenes].sort((a, b) => a.order - b.order);

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">シーン一覧</h4>
        <span className="text-xs text-muted-foreground">{scenes.length} シーン</span>
      </div>
      <div className="space-y-2">
        {sortedScenes.map((scene) => (
          <SceneCard key={scene.id} scene={scene} onEdit={onEditScene} />
        ))}
      </div>
    </div>
  );
}
