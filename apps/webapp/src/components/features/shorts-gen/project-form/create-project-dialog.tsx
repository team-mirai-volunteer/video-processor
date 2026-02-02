'use client';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createShortsProject } from '@/server/presentation/shorts-gen/actions/createShortsProject';
import { Loader2, Plus } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const ASPECT_RATIOS = [
  { value: '9:16', label: '9:16 (縦動画)', width: 1080, height: 1920 },
  { value: '16:9', label: '16:9 (横動画)', width: 1920, height: 1080 },
  { value: '1:1', label: '1:1 (正方形)', width: 1080, height: 1080 },
  { value: '4:5', label: '4:5 (Instagram)', width: 1080, height: 1350 },
] as const;

const DEFAULT_ASPECT = ASPECT_RATIOS[0];

export function CreateProjectDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [aspectRatio, setAspectRatio] = useState('9:16');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedAspect = ASPECT_RATIOS.find((ar) => ar.value === aspectRatio) ?? DEFAULT_ASPECT;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('タイトルを入力してください');
      return;
    }

    setIsCreating(true);
    setError(null);

    const result = await createShortsProject({
      title: title.trim(),
      aspectRatio: selectedAspect.value,
      resolutionWidth: selectedAspect.width,
      resolutionHeight: selectedAspect.height,
    });

    if (result.success && result.data) {
      setOpen(false);
      setTitle('');
      setAspectRatio('9:16');
      router.push(`/shorts-gen/${result.data.id}`);
    } else {
      setError(result.error ?? 'プロジェクトの作成に失敗しました');
    }

    setIsCreating(false);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!isCreating) {
      setOpen(newOpen);
      if (!newOpen) {
        setTitle('');
        setAspectRatio('9:16');
        setError(null);
      }
    }
  };

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="mr-2 h-4 w-4" />
        新規作成
      </Button>

      <AlertDialog open={open} onOpenChange={handleOpenChange}>
        <AlertDialogContent>
          <form onSubmit={handleSubmit}>
            <AlertDialogHeader>
              <AlertDialogTitle>新しいプロジェクトを作成</AlertDialogTitle>
              <AlertDialogDescription>
                ショート動画生成プロジェクトを作成します。タイトルとアスペクト比を設定してください。
              </AlertDialogDescription>
            </AlertDialogHeader>

            <div className="py-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">プロジェクトタイトル</Label>
                <Input
                  id="title"
                  placeholder="例: AIについて解説"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={isCreating}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="aspectRatio">アスペクト比</Label>
                <div className="grid grid-cols-2 gap-2">
                  {ASPECT_RATIOS.map((ar) => (
                    <button
                      key={ar.value}
                      type="button"
                      onClick={() => setAspectRatio(ar.value)}
                      disabled={isCreating}
                      className={`p-3 border rounded-md text-left transition-colors ${
                        aspectRatio === ar.value
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <div className="font-medium text-sm">{ar.label}</div>
                      <div className="text-xs text-muted-foreground">
                        {ar.width} x {ar.height}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {error && <div className="text-sm text-destructive">{error}</div>}
            </div>

            <AlertDialogFooter>
              <AlertDialogCancel disabled={isCreating}>キャンセル</AlertDialogCancel>
              <Button type="submit" disabled={isCreating || !title.trim()}>
                {isCreating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                作成
              </Button>
            </AlertDialogFooter>
          </form>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
