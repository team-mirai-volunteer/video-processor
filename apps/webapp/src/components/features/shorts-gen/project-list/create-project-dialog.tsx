'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createShortsProject } from '@/server/presentation/actions/createShortsProject';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function CreateProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const response = await createShortsProject({ title: title.trim() });
      setOpen(false);
      setTitle('');
      router.push(`/shorts-gen/${response.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'プロジェクトの作成に失敗しました');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          新規プロジェクト
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>新規プロジェクト作成</AlertDialogTitle>
          <AlertDialogDescription>
            ショート動画生成プロジェクトを作成します。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">プロジェクトタイトル</Label>
            <Input
              id="title"
              placeholder="例: AIについて解説するショート動画"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isCreating) {
                  handleCreate();
                }
              }}
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="text-sm text-muted-foreground">
            <p>デフォルト設定:</p>
            <ul className="list-disc list-inside ml-2 mt-1">
              <li>アスペクト比: 9:16（縦型）</li>
              <li>解像度: 1080x1920</li>
            </ul>
          </div>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isCreating}>キャンセル</AlertDialogCancel>
          <AlertDialogAction onClick={handleCreate} disabled={isCreating || !title.trim()}>
            {isCreating ? '作成中...' : '作成'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
