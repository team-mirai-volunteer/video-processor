'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Music, Volume2, VolumeX } from 'lucide-react';
import type { BgmOption, BgmSelectorProps } from './types';

const BGM_OPTIONS: BgmOption[] = [
  {
    key: 'upbeat',
    label: 'アップビート',
    description: '明るくポジティブな曲調',
  },
  {
    key: 'calm',
    label: 'カーム',
    description: '落ち着いた雰囲気',
  },
  {
    key: 'dramatic',
    label: 'ドラマチック',
    description: '印象的で力強い曲調',
  },
  {
    key: 'corporate',
    label: 'コーポレート',
    description: 'ビジネス向けのプロフェッショナルな曲調',
  },
];

export function BgmSelector({ selectedKey, onSelect, disabled }: BgmSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Music className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">BGM選択</span>
        <span className="text-xs text-muted-foreground">(オプション)</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button
          variant={selectedKey === null ? 'default' : 'outline'}
          size="sm"
          onClick={() => onSelect(null)}
          disabled={disabled}
          className="justify-start"
        >
          <VolumeX className="mr-2 h-4 w-4" />
          BGMなし
        </Button>

        {BGM_OPTIONS.map((option) => (
          <Button
            key={option.key}
            variant={selectedKey === option.key ? 'default' : 'outline'}
            size="sm"
            onClick={() => onSelect(option.key)}
            disabled={disabled}
            className="justify-start"
          >
            <Volume2
              className={cn(
                'mr-2 h-4 w-4',
                selectedKey === option.key ? 'text-primary-foreground' : 'text-muted-foreground'
              )}
            />
            <div className="text-left">
              <div>{option.label}</div>
              {option.description && (
                <div className="text-xs opacity-70 font-normal">{option.description}</div>
              )}
            </div>
          </Button>
        ))}
      </div>
    </div>
  );
}
