'use client';

import { ClipList } from '@/components/features/clip-list';
import { StatusBadge } from '@/components/features/video-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { ApiError, apiClient } from '@/lib/api-client';
import { formatBytes, formatDate, formatDuration } from '@/lib/utils';
import type { GetTranscriptionResponse, VideoWithRelations } from '@video-processor/shared';
import {
  ArrowLeft,
  Calendar,
  Clock,
  ExternalLink,
  FileText,
  HardDrive,
  Loader2,
  Scissors,
} from 'lucide-react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function VideoDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [video, setVideo] = useState<VideoWithRelations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transcription, setTranscription] = useState<GetTranscriptionResponse | null>(null);
  const [transcriptionLoading, setTranscriptionLoading] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [clipInstructions, setClipInstructions] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const fetchVideo = useCallback(async () => {
    try {
      const response = await apiClient.getVideo(id);
      setVideo(response);

      // Try to fetch transcription if video is transcribed or later
      if (
        response.status === 'transcribed' ||
        response.status === 'extracting' ||
        response.status === 'completed'
      ) {
        setTranscriptionLoading(true);
        try {
          const transcriptionResponse = await apiClient.getTranscription(id);
          setTranscription(transcriptionResponse);
        } catch {
          // Transcription might not exist yet
        } finally {
          setTranscriptionLoading(false);
        }
      }
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setError('動画が見つかりません');
      } else {
        setError(err instanceof Error ? err.message : '動画の取得に失敗しました');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVideo();
  }, [fetchVideo]);

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      await apiClient.transcribeVideo(id);
      // Refresh video to get updated status
      const response = await apiClient.getVideo(id);
      setVideo(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'トランスクリプト作成に失敗しました');
    } finally {
      setTranscribing(false);
    }
  };

  const handleExtractClips = async () => {
    if (!clipInstructions.trim()) return;

    setExtracting(true);
    setExtractError(null);

    try {
      await apiClient.extractClips(id, { clipInstructions });
      // Refresh the video data to show updated status
      await fetchVideo();
      setClipInstructions('');
    } catch (err) {
      if (err instanceof ApiError) {
        setExtractError(err.message);
      } else {
        setExtractError('切り抜き処理の開始に失敗しました');
      }
    } finally {
      setExtracting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[200px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (error || !video) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
        <Card>
          <CardContent className="py-12">
            <div className="text-center text-destructive">{error || '動画が見つかりません'}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/">
            <ArrowLeft className="mr-2 h-4 w-4" />
            一覧に戻る
          </Link>
        </Button>
      </div>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold">{video.title || 'タイトルなし'}</h1>
          <div className="flex items-center gap-2 mt-2">
            <StatusBadge status={video.status} />
          </div>
        </div>
        <Button variant="outline" asChild>
          <a href={video.googleDriveUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="mr-2 h-4 w-4" />
            Google Driveで開く
          </a>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>動画情報</CardTitle>
          <CardDescription>{video.description || '説明はありません'}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {video.durationSeconds && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  再生時間
                </div>
                <div className="font-medium">{formatDuration(video.durationSeconds)}</div>
              </div>
            )}
            {video.fileSizeBytes && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <HardDrive className="h-3 w-3" />
                  ファイルサイズ
                </div>
                <div className="font-medium">{formatBytes(Number(video.fileSizeBytes))}</div>
              </div>
            )}
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                登録日時
              </div>
              <div className="font-medium">{formatDate(video.createdAt)}</div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-3 w-3" />
                更新日時
              </div>
              <div className="font-medium">{formatDate(video.updatedAt)}</div>
            </div>
          </div>

          {video.errorMessage && (
            <div className="mt-4 p-3 text-sm text-destructive bg-destructive/10 rounded-md">
              {video.errorMessage}
            </div>
          )}
        </CardContent>
      </Card>

      {/* トランスクリプトカード */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            トランスクリプト
          </CardTitle>
          <CardDescription>動画の文字起こし結果です</CardDescription>
        </CardHeader>
        <CardContent>
          {video.status === 'pending' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                トランスクリプトを作成して、動画の内容を文字に起こします。
              </p>
              <Button onClick={handleTranscribe} disabled={transcribing}>
                {transcribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transcribing ? 'トランスクリプト作成中...' : 'トランスクリプト作成'}
              </Button>
            </div>
          )}
          {video.status === 'transcribing' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">トランスクリプトを作成中です...</p>
            </div>
          )}
          {transcriptionLoading && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">トランスクリプトを読み込み中...</p>
            </div>
          )}
          {transcription && !transcriptionLoading && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>言語: {transcription.languageCode}</span>
                <span>長さ: {formatDuration(transcription.durationSeconds)}</span>
              </div>
              <div className="border rounded-lg p-4 max-h-96 overflow-y-auto">
                <p className="whitespace-pre-wrap text-sm">{transcription.fullText}</p>
              </div>
            </div>
          )}
          {!transcription &&
            !transcriptionLoading &&
            (video.status === 'transcribed' ||
              video.status === 'extracting' ||
              video.status === 'completed') && (
              <div className="text-center py-8 text-muted-foreground">
                トランスクリプトが見つかりません
              </div>
            )}
        </CardContent>
      </Card>

      {/* 切り抜き指示フォーム - transcribed状態の時のみ表示 */}
      {video.status === 'transcribed' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              切り抜き作成
            </CardTitle>
            <CardDescription>
              トランスクリプトを元に、切り抜きたい箇所を指示してください。
              AIが指示に基づいて最適な箇所を特定し、ショート動画を作成します。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="clipInstructions">切り抜き指示</Label>
                <Textarea
                  id="clipInstructions"
                  placeholder="以下の箇所を切り抜いてください：&#10;1. 冒頭の自己紹介部分&#10;2. 政策について語っている部分&#10;3. 質疑応答のハイライト"
                  value={clipInstructions}
                  onChange={(e) => setClipInstructions(e.target.value)}
                  rows={6}
                  disabled={extracting}
                />
                <p className="text-sm text-muted-foreground">
                  どの箇所を切り抜きたいか、具体的に指示してください。
                </p>
              </div>

              {extractError && (
                <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">
                  {extractError}
                </div>
              )}

              <div className="flex justify-end">
                <Button
                  onClick={handleExtractClips}
                  disabled={extracting || !clipInstructions.trim()}
                >
                  {extracting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      処理中...
                    </>
                  ) : (
                    <>
                      <Scissors className="mr-2 h-4 w-4" />
                      切り抜きを作成
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 処理中ステータス表示 - extracting状態の時のみ */}
      {video.status === 'extracting' && (
        <Card>
          <CardContent className="py-8">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="text-center">
                <p className="font-medium">切り抜き動画を作成中...</p>
                <p className="text-sm text-muted-foreground mt-1">
                  この処理には数分かかる場合があります。ページを更新して進捗を確認できます。
                </p>
              </div>
              <Button variant="outline" onClick={() => router.refresh()}>
                更新
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {video.processingJobs.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>処理ジョブ</CardTitle>
            <CardDescription>動画に対する処理リクエストの履歴です</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {video.processingJobs.map((job) => (
                <div key={job.id} className="border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="text-sm font-medium">切り抜き指示</div>
                      <div className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {job.clipInstructions}
                      </div>
                    </div>
                    <StatusBadge status={job.status} />
                  </div>
                  {job.completedAt && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      完了: {formatDate(job.completedAt)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>切り抜きクリップ</CardTitle>
          <CardDescription>この動画から生成されたショート動画の一覧です</CardDescription>
        </CardHeader>
        <CardContent>
          <ClipList clips={video.clips} />
        </CardContent>
      </Card>
    </div>
  );
}
