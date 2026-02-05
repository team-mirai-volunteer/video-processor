'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Download, ExternalLink, Loader2, RefreshCw, Video } from 'lucide-react';

type CompositionStep = 'idle' | 'composing' | 'composed' | 'uploading' | 'uploaded';

interface SubtitleCompositionStatusProps {
  step: CompositionStep;
  subtitledVideoUrl?: string | null;
  subtitledVideoDriveUrl?: string | null;
  onCompose?: () => void;
  onUpload?: () => void;
  isComposing?: boolean;
  isUploading?: boolean;
  canCompose?: boolean;
}

export function SubtitleCompositionStatus({
  step,
  subtitledVideoUrl,
  subtitledVideoDriveUrl,
  onCompose,
  onUpload,
  isComposing = false,
  isUploading = false,
  canCompose = false,
}: SubtitleCompositionStatusProps) {
  const showComposeButton = step === 'idle' && canCompose;
  const showUploadButton = (step === 'composed' || subtitledVideoUrl) && !subtitledVideoDriveUrl;
  const hasComposedVideo = !!subtitledVideoUrl;
  const hasUploadedVideo = !!subtitledVideoDriveUrl;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Video className="h-4 w-4" />
          字幕付き動画
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            variant={hasComposedVideo ? 'default' : 'secondary'}
            className="flex items-center gap-1"
          >
            {isComposing ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                合成中...
              </>
            ) : hasComposedVideo ? (
              <>
                <CheckCircle className="h-3 w-3" />
                合成済み
              </>
            ) : (
              '未合成'
            )}
          </Badge>

          <Badge
            variant={hasUploadedVideo ? 'default' : 'secondary'}
            className="flex items-center gap-1"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" />
                アップロード中...
              </>
            ) : hasUploadedVideo ? (
              <>
                <CheckCircle className="h-3 w-3" />
                Drive保存済み
              </>
            ) : (
              '未アップロード'
            )}
          </Badge>
        </div>

        <div className="flex flex-wrap gap-2">
          {showComposeButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCompose}
              disabled={isComposing || !canCompose}
            >
              {isComposing ? (
                <>
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                  動画を合成中...
                </>
              ) : (
                '動画を合成'
              )}
            </Button>
          )}

          {hasComposedVideo && subtitledVideoUrl && (
            <>
              <Button variant="outline" size="sm" onClick={onCompose} disabled={isComposing}>
                {isComposing ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    再合成中...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-3 w-3" />
                    再合成
                  </>
                )}
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={subtitledVideoUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="mr-2 h-3 w-3" />
                  プレビュー
                </a>
              </Button>
              <Button variant="outline" size="sm" asChild>
                <a href={subtitledVideoUrl} download>
                  <Download className="mr-2 h-3 w-3" />
                  ダウンロード
                </a>
              </Button>
              {showUploadButton && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUpload}
                  disabled={isUploading || !hasComposedVideo}
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                      Driveにアップロード中...
                    </>
                  ) : (
                    'Driveにアップロード'
                  )}
                </Button>
              )}
              {hasUploadedVideo && subtitledVideoDriveUrl && (
                <Button variant="outline" size="sm" asChild>
                  <a href={subtitledVideoDriveUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="mr-2 h-3 w-3" />
                    Google Driveで開く
                  </a>
                </Button>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
