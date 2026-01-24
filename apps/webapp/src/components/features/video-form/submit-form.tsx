'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiClient } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SubmitForm() {
  const router = useRouter();
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [clipInstructions, setClipInstructions] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.submitVideo({
        googleDriveUrl,
        clipInstructions,
      });
      router.push(`/videos/${response.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError('動画の登録に失敗しました');
      }
      setLoading(false);
    }
  };

  const isValidUrl = googleDriveUrl.includes('drive.google.com');

  return (
    <Card>
      <CardHeader>
        <CardTitle>動画情報</CardTitle>
        <CardDescription>
          切り抜きたい動画のGoogle Drive URLと、切り抜き指示を入力してください
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="googleDriveUrl">Google Drive URL</Label>
            <Input
              id="googleDriveUrl"
              type="url"
              placeholder="https://drive.google.com/file/d/xxx/view"
              value={googleDriveUrl}
              onChange={(e) => setGoogleDriveUrl(e.target.value)}
              required
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              Google Driveで共有されている動画のURLを入力してください
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="clipInstructions">切り抜き指示</Label>
            <Textarea
              id="clipInstructions"
              placeholder="以下の箇所を切り抜いてください：&#10;1. 冒頭の自己紹介部分&#10;2. 政策について語っている部分（約5分あたり）&#10;3. 質疑応答のハイライト"
              value={clipInstructions}
              onChange={(e) => setClipInstructions(e.target.value)}
              rows={6}
              required
              disabled={loading}
            />
            <p className="text-sm text-muted-foreground">
              どの箇所を切り抜きたいか、具体的に指示してください。AIがこの指示を元に動画を分析し、該当箇所を特定します。
            </p>
          </div>

          {error && (
            <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
          )}

          <div className="flex justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={loading}
            >
              キャンセル
            </Button>
            <Button type="submit" disabled={loading || !isValidUrl || !clipInstructions.trim()}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登録中...
                </>
              ) : (
                '動画を登録'
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
