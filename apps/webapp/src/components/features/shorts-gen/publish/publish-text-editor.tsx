'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, X } from 'lucide-react';
import type { PublishTextEditorProps } from './types';

export function PublishTextEditor({
  title,
  description,
  onTitleChange,
  onDescriptionChange,
  onSave,
  onCancel,
  isSaving,
}: PublishTextEditorProps) {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">タイトル</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="動画タイトルを入力..."
          disabled={isSaving}
          maxLength={100}
        />
        <p className="text-xs text-muted-foreground">{title.length}/100</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">説明文</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder="動画の説明文を入力..."
          disabled={isSaving}
          rows={6}
          maxLength={5000}
        />
        <p className="text-xs text-muted-foreground">{description.length}/5000</p>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="mr-1.5 h-3.5 w-3.5" />
          キャンセル
        </Button>
        <Button size="sm" onClick={onSave} disabled={isSaving || !title.trim()}>
          {isSaving ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              保存中...
            </>
          ) : (
            <>
              <Save className="mr-1.5 h-3.5 w-3.5" />
              保存
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
