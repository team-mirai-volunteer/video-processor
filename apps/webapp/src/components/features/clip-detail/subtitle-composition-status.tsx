'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type { OutputFormat, PaddingColor } from '@video-processor/shared';
import { CheckCircle, Download, ExternalLink, Loader2, RefreshCw, Video } from 'lucide-react';
import { useState } from 'react';

type CompositionStep = 'idle' | 'composing' | 'composed' | 'uploading' | 'uploaded';

interface SubtitleCompositionStatusProps {
  step: CompositionStep;
  subtitledVideoUrl?: string | null;
  subtitledVideoDriveUrl?: string | null;
  onCompose?: (outputFormat?: OutputFormat, paddingColor?: PaddingColor) => void;
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
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('original');
  const [paddingColor, setPaddingColor] = useState<PaddingColor>('#000000');

  const showComposeButton = step === 'idle' && canCompose;
  const showUploadButton = (step === 'composed' || subtitledVideoUrl) && !subtitledVideoDriveUrl;
  const hasComposedVideo = !!subtitledVideoUrl;
  const hasUploadedVideo = !!subtitledVideoDriveUrl;

  const handleCompose = () => {
    onCompose?.(outputFormat, outputFormat !== 'original' ? paddingColor : undefined);
  };

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

        {/* 出力フォーマット選択 */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label className="text-sm font-medium">出力フォーマット</Label>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="composeOutputFormat"
                  value="original"
                  checked={outputFormat === 'original'}
                  onChange={() => setOutputFormat('original')}
                  disabled={isComposing}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">オリジナル</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="composeOutputFormat"
                  value="vertical"
                  checked={outputFormat === 'vertical'}
                  onChange={() => setOutputFormat('vertical')}
                  disabled={isComposing}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">縦動画（9:16）</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="composeOutputFormat"
                  value="horizontal"
                  checked={outputFormat === 'horizontal'}
                  onChange={() => setOutputFormat('horizontal')}
                  disabled={isComposing}
                  className="w-4 h-4 text-primary"
                />
                <span className="text-sm">横動画（16:9）</span>
              </label>
            </div>
          </div>

          {(outputFormat === 'vertical' || outputFormat === 'horizontal') && (
            <div className="space-y-2">
              <Label className="text-sm font-medium">余白の色</Label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="composePaddingColor"
                    value="#000000"
                    checked={paddingColor === '#000000'}
                    onChange={() => setPaddingColor('#000000')}
                    disabled={isComposing}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: '#000000' }}
                    />
                    黒
                  </span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="composePaddingColor"
                    value="#30bca7"
                    checked={paddingColor === '#30bca7'}
                    onChange={() => setPaddingColor('#30bca7')}
                    disabled={isComposing}
                    className="w-4 h-4 text-primary"
                  />
                  <span className="flex items-center gap-2 text-sm">
                    <span
                      className="w-4 h-4 rounded border border-gray-300"
                      style={{ backgroundColor: '#30bca7' }}
                    />
                    チームみらいグリーン
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {showComposeButton && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCompose}
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
              <Button variant="outline" size="sm" onClick={handleCompose} disabled={isComposing}>
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

        {hasComposedVideo && subtitledVideoUrl && (
          <div className="flex justify-center">
            {/* biome-ignore lint/a11y/useMediaCaption: subtitles are burned into the video */}
            <video
              src={subtitledVideoUrl}
              controls
              className="max-w-full max-h-[480px] rounded-md"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
