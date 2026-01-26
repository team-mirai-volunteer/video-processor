'use client';

import { ClipList } from '@/components/features/clip-list';
import { TranscriptViewer } from '@/components/features/transcript';
import { StatusBadge } from '@/components/features/video-list';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { formatBytes, formatDate, formatDuration } from '@/lib/utils';
import { extractClips } from '@/server/presentation/actions/extractClips';
import { getVideoStatus } from '@/server/presentation/actions/getVideoStatus';
import { refineTranscript } from '@/server/presentation/actions/refineTranscript';
import { transcribeVideo } from '@/server/presentation/actions/transcribeVideo';
import type {
  GetRefinedTranscriptionResponse,
  GetTranscriptionResponse,
  VideoWithRelations,
} from '@video-processor/shared';
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
import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  video: VideoWithRelations;
  initialTranscription: GetTranscriptionResponse | null;
  initialRefinedTranscription: GetRefinedTranscriptionResponse | null;
}

const POLLING_INTERVAL = 3000; // 3秒

export function VideoDetailClient({
  video: initialVideo,
  initialTranscription,
  initialRefinedTranscription,
}: Props) {
  const [video, setVideo] = useState(initialVideo);
  const [transcription, setTranscription] = useState(initialTranscription);
  const [refinedTranscription, setRefinedTranscription] = useState(initialRefinedTranscription);
  const [error, setError] = useState<string | null>(null);
  const [transcribing, setTranscribing] = useState(false);
  const [isRefining, setIsRefining] = useState(false);
  const [clipInstructions, setClipInstructions] = useState('');
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  // ポーリングが必要なステータスかどうか判定
  const shouldPoll = video.status === 'transcribing' || video.status === 'extracting';

  // ポーリング処理
  const pollStatus = useCallback(async () => {
    try {
      const result = await getVideoStatus(video.id);
      setVideo(result.video as VideoWithRelations);
      if (result.transcription) {
        setTranscription(result.transcription);
      }
      if (result.refinedTranscription) {
        setRefinedTranscription(result.refinedTranscription);
      }
    } catch (err) {
      console.error('ポーリングエラー:', err);
    }
  }, [video.id]);

  // ポーリングの開始/停止
  useEffect(() => {
    if (shouldPoll) {
      pollingRef.current = setInterval(pollStatus, POLLING_INTERVAL);
    }

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [shouldPoll, pollStatus]);

  const handleTranscribe = async () => {
    setTranscribing(true);
    try {
      const transcribeResponse = await transcribeVideo(video.id);
      setVideo({ ...video, status: transcribeResponse.status });
    } catch (err) {
      setError(err instanceof Error ? err.message : '文字起こし作成に失敗しました');
    } finally {
      setTranscribing(false);
    }
  };

  const handleExtractClips = async () => {
    if (!clipInstructions.trim()) return;

    setExtracting(true);
    setExtractError(null);

    try {
      await extractClips(video.id, { clipInstructions });
      await pollStatus();
      setClipInstructions('');
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : '切り抜き処理の開始に失敗しました');
    } finally {
      setExtracting(false);
    }
  };

  const handleRefineTranscript = async () => {
    setIsRefining(true);
    try {
      await refineTranscript(video.id);
      await pollStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : '文字起こし校正に失敗しました');
    } finally {
      setIsRefining(false);
    }
  };

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

      {error && (
        <div className="p-3 text-sm text-destructive bg-destructive/10 rounded-md">{error}</div>
      )}

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

      {/* 文字起こしカード */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            文字起こし
          </CardTitle>
          <CardDescription>動画の文字起こし結果です</CardDescription>
        </CardHeader>
        <CardContent>
          {video.status === 'pending' && (
            <div className="text-center py-8">
              <p className="text-muted-foreground mb-4">
                文字起こしを作成して、動画の内容を文字に起こします。
              </p>
              <Button onClick={handleTranscribe} disabled={transcribing}>
                {transcribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transcribing ? '作成中...' : '文字起こし作成'}
              </Button>
            </div>
          )}
          {video.status === 'transcribing' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                {video.transcriptionPhase === 'downloading' && '動画をダウンロード中...'}
                {video.transcriptionPhase === 'extracting_audio' && '音声を抽出中...'}
                {video.transcriptionPhase === 'transcribing' && '文字起こし中...'}
                {video.transcriptionPhase === 'saving' && '文字起こしを保存中...'}
                {video.transcriptionPhase === 'uploading' && 'ファイルをアップロード中...'}
                {video.transcriptionPhase === 'refining' && 'AIで校正中...'}
                {!video.transcriptionPhase && '文字起こしを作成中です...'}
              </p>
              <p className="text-xs text-muted-foreground mt-2">自動的に更新されます</p>
            </div>
          )}
          {video.status === 'failed' && (
            <div className="text-center py-8">
              <div className="text-destructive mb-4">
                <p className="font-medium">文字起こしの作成に失敗しました</p>
                {video.errorMessage && <p className="text-sm mt-2">{video.errorMessage}</p>}
              </div>
              <Button onClick={handleTranscribe} disabled={transcribing}>
                {transcribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {transcribing ? '再試行中...' : '再試行する'}
              </Button>
            </div>
          )}
          {transcription && (
            <div className="space-y-4">
              <TranscriptViewer
                rawTranscription={transcription}
                refinedTranscription={refinedTranscription}
                onRefine={handleRefineTranscript}
                isRefining={isRefining}
                isLoadingRefined={false}
              />
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleTranscribe}
                  disabled={transcribing}
                >
                  {transcribing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {transcribing ? '再作成中...' : '文字起こし再作成'}
                </Button>
              </div>
            </div>
          )}
          {!transcription &&
            (video.status === 'transcribed' ||
              video.status === 'extracting' ||
              video.status === 'completed') && (
              <div className="text-center py-8 text-muted-foreground">
                文字起こしが見つかりません
              </div>
            )}
        </CardContent>
      </Card>

      {/* 切り抜き指示フォーム - transcribedまたはcompleted状態の時に表示 */}
      {(video.status === 'transcribed' || video.status === 'completed') && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scissors className="h-5 w-5" />
              切り抜き作成
            </CardTitle>
            <CardDescription>
              文字起こしを元に、切り抜きたい箇所を指示してください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            {refinedTranscription ? (
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
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground mb-4">
                  切り抜き作成には文字起こしの校正が必要です。
                </p>
                <p className="text-sm text-muted-foreground">
                  文字起こしカードの「Refined」タブから校正を実行してください。
                </p>
              </div>
            )}
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
                  この処理には数分かかる場合があります。自動的に更新されます。
                </p>
              </div>
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
