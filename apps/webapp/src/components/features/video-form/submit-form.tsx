'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ApiError, apiClient } from '@/lib/api-client';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function SubmitForm() {
  const router = useRouter();
  const [googleDriveUrl, setGoogleDriveUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await apiClient.submitVideo({
        googleDriveUrl,
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
        <CardTitle>動画登録</CardTitle>
        <CardDescription>
          切り抜きたい動画のGoogle Drive URLを入力してください。
          登録後、トランスクリプトを作成してから切り抜き指示を入力できます。
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
            <Button type="submit" disabled={loading || !isValidUrl}>
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
