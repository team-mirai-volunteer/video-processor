'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Check, Copy, Pencil } from 'lucide-react';
import { useState } from 'react';
import type { PublishTextDisplayProps } from './types';

export function PublishTextDisplay({
  title,
  description,
  onEdit,
  onCopy,
}: PublishTextDisplayProps) {
  const [copiedField, setCopiedField] = useState<'title' | 'description' | null>(null);

  const handleCopy = async (text: string, field: 'title' | 'description') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      onCopy(text);
      setTimeout(() => setCopiedField(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">タイトル</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => handleCopy(title, 'title')}
            >
              {copiedField === 'title' ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm">{title}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">説明文</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2"
              onClick={() => handleCopy(description, 'description')}
            >
              {copiedField === 'description' ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm whitespace-pre-wrap">{description}</p>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button variant="outline" size="sm" onClick={onEdit}>
          <Pencil className="mr-1.5 h-3.5 w-3.5" />
          編集
        </Button>
      </div>
    </div>
  );
}
