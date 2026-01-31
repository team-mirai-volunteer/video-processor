import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { Film, Image, Pencil, Square } from 'lucide-react';
import type { Scene } from './types';
import { VISUAL_TYPE_COLORS, VISUAL_TYPE_LABELS } from './types';

interface SceneCardProps {
  scene: Scene;
  onEdit?: (scene: Scene) => void;
  className?: string;
}

function VisualTypeIcon({ type }: { type: Scene['visualType'] }) {
  switch (type) {
    case 'image_gen':
      return <Image className="h-3.5 w-3.5" />;
    case 'stock_video':
      return <Film className="h-3.5 w-3.5" />;
    case 'solid_color':
      return <Square className="h-3.5 w-3.5" />;
  }
}

export function SceneCard({ scene, onEdit, className }: SceneCardProps) {
  const hasVoice = scene.voiceText && scene.voiceText.length > 0;
  const hasSubtitles = scene.subtitles && scene.subtitles.length > 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="p-3 pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">
              Scene {scene.order + 1}
            </span>
            <Badge
              variant="outline"
              className={cn('text-xs', VISUAL_TYPE_COLORS[scene.visualType])}
            >
              <VisualTypeIcon type={scene.visualType} />
              <span className="ml-1">{VISUAL_TYPE_LABELS[scene.visualType]}</span>
            </Badge>
          </div>

          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(scene)}
              className="h-8 w-8 p-0 shrink-0"
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">編集</span>
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-3 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* セリフ（voiceText） */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1.5">📢 セリフ</h4>
            {hasVoice ? (
              <p className="text-sm">{scene.voiceText}</p>
            ) : (
              <p className="text-sm text-muted-foreground">（セリフなし）</p>
            )}
          </div>

          {/* 字幕（subtitles） */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1.5">💬 字幕</h4>
            {hasSubtitles ? (
              <ol className="text-sm space-y-0.5">
                {scene.subtitles.map((subtitle, index) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: subtitles are static, order won't change
                  <li key={index}>
                    {index + 1}. {subtitle}
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted-foreground">（字幕なし）</p>
            )}
          </div>

          {/* 概要（summary） */}
          <div>
            <h4 className="text-xs font-medium text-muted-foreground mb-1.5">📝 概要</h4>
            <p className="text-xs text-muted-foreground">{scene.summary}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
