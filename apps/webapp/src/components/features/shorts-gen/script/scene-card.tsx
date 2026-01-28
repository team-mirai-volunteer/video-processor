'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronRight,
  Film,
  Image,
  MessageSquare,
  Pencil,
  Square,
  Volume2,
} from 'lucide-react';
import { useState } from 'react';
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
  const [isExpanded, setIsExpanded] = useState(false);

  const hasVoice = scene.voiceText && scene.voiceText.length > 0;
  const hasSubtitles = scene.subtitles && scene.subtitles.length > 0;

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-start gap-2 text-left flex-1 min-w-0"
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-medium">Scene {scene.order + 1}</span>
                <Badge
                  variant="outline"
                  className={cn('text-xs', VISUAL_TYPE_COLORS[scene.visualType])}
                >
                  <VisualTypeIcon type={scene.visualType} />
                  <span className="ml-1">{VISUAL_TYPE_LABELS[scene.visualType]}</span>
                </Badge>
                {hasVoice && (
                  <Badge variant="secondary" className="text-xs">
                    <Volume2 className="h-3 w-3 mr-1" />
                    音声
                  </Badge>
                )}
                {hasSubtitles && (
                  <Badge variant="secondary" className="text-xs">
                    <MessageSquare className="h-3 w-3 mr-1" />
                    字幕 x{scene.subtitles.length}
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{scene.summary}</p>
            </div>
          </button>

          {onEdit && (
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                onEdit(scene);
              }}
              className="h-8 w-8 p-0 shrink-0"
            >
              <Pencil className="h-4 w-4" />
              <span className="sr-only">編集</span>
            </Button>
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-3 pt-0 border-t">
          <div className="space-y-3 pt-3">
            {/* Summary */}
            <div>
              <h4 className="text-xs font-medium text-muted-foreground mb-1">概要</h4>
              <p className="text-sm">{scene.summary}</p>
            </div>

            {/* Voice Text */}
            {hasVoice && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">音声テキスト</h4>
                <p className="text-sm bg-muted/50 p-2 rounded-md">{scene.voiceText}</p>
              </div>
            )}

            {/* Silence Duration */}
            {scene.silenceDurationMs !== null && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">無音区間</h4>
                <p className="text-sm">{(scene.silenceDurationMs / 1000).toFixed(1)} 秒</p>
              </div>
            )}

            {/* Subtitles */}
            {hasSubtitles && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">字幕</h4>
                <ul className="space-y-1">
                  {scene.subtitles.map((subtitle, index) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: subtitles are static, order won't change
                    <li key={index} className="text-sm bg-muted/50 p-2 rounded-md">
                      {subtitle}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Visual Type Specific Info */}
            {scene.visualType === 'stock_video' && scene.stockVideoKey && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">動画素材キー</h4>
                <p className="text-sm font-mono bg-muted/50 p-2 rounded-md">
                  {scene.stockVideoKey}
                </p>
              </div>
            )}

            {scene.visualType === 'solid_color' && scene.solidColor && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">背景色</h4>
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded border"
                    style={{ backgroundColor: scene.solidColor }}
                  />
                  <span className="text-sm font-mono">{scene.solidColor}</span>
                </div>
              </div>
            )}

            {scene.imageStyleHint && (
              <div>
                <h4 className="text-xs font-medium text-muted-foreground mb-1">
                  画像スタイルヒント
                </h4>
                <p className="text-sm bg-muted/50 p-2 rounded-md">{scene.imageStyleHint}</p>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
