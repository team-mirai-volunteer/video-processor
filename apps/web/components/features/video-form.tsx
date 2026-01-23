'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiClient } from '@/lib/api-client';

export function VideoForm() {
  const router = useRouter();
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [clipInstructions, setClipInstructions] = useState('');

  const mutation = useMutation({
    mutationFn: () =>
      apiClient.createVideo({
        googleDriveUrl,
        clipInstructions,
      }),
    onSuccess: (data) => {
      router.push(`/videos/${data.id}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!googleDriveUrl.trim() || !clipInstructions.trim()) {
      return;
    }
    mutation.mutate();
  };

  const isValid = googleDriveUrl.trim() && clipInstructions.trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>動画を登録</CardTitle>
        <CardDescription>
          Google Driveの動画URLと切り抜き指示を入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="url" className="text-sm font-medium">
              Google Drive URL
            </label>
            <Input
              id="url"
              type="url"
              placeholder="https://drive.google.com/file/d/xxx/view"
              value={googleDriveUrl}
              onChange={(e) => setGoogleDriveUrl(e.target.value)}
              disabled={mutation.isPending}
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="instructions" className="text-sm font-medium">
              切り抜き指示
            </label>
            <Textarea
              id="instructions"
              placeholder={`以下の箇所を切り抜いてください：
1. 冒頭の自己紹介部分
2. 政策について語っている部分
3. 質疑応答のハイライト`}
              rows={6}
              value={clipInstructions}
              onChange={(e) => setClipInstructions(e.target.value)}
              disabled={mutation.isPending}
            />
            <p className="text-xs text-muted-foreground">
              切り抜きたい箇所を自然言語で記述してください。複数箇所ある場合は番号をつけて記載すると効果的です。
            </p>
          </div>

          {mutation.isError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              エラーが発生しました。もう一度お試しください。
            </div>
          )}

          <Button type="submit" disabled={!isValid || mutation.isPending} className="w-full">
            {mutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                送信中...
              </>
            ) : (
              '登録する'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
