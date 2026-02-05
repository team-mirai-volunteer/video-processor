'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import type {
  OutlineColor,
  OutputFormat,
  PaddingColor,
  SubtitleFontSize,
} from '@video-processor/shared';
import { CheckCircle, Download, ExternalLink, Loader2, RefreshCw, Video } from 'lucide-react';
import { useState } from 'react';

type CompositionStep = 'idle' | 'composing' | 'composed' | 'uploading' | 'uploaded';

interface SubtitleCompositionStatusProps {
  step: CompositionStep;
  subtitledVideoUrl?: string | null;
  subtitledVideoDriveUrl?: string | null;
  onCompose?: (
    outputFormat?: OutputFormat,
    paddingColor?: PaddingColor,
    outlineColor?: OutlineColor,
    fontSize?: SubtitleFontSize
  ) => void;
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
  const [outlineColor, setOutlineColor] = useState<OutlineColor>('#30bca7');
  const [fontSize, setFontSize] = useState<SubtitleFontSize>('large');

  const showComposeButton = step === 'idle' && canCompose;
  const showUploadButton = (step === 'composed' || subtitledVideoUrl) && !subtitledVideoDriveUrl;
  const hasComposedVideo = !!subtitledVideoUrl;
  const hasUploadedVideo = !!subtitledVideoDriveUrl;

  const handleCompose = () => {
    onCompose?.(
      outputFormat,
      outputFormat !== 'original' ? paddingColor : undefined,
      outlineColor,
      fontSize
    );
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

        {/* 設定項目 */}
        <div className="space-y-3">
          {/* サイズ */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0 w-20">サイズ</Label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-muted p-1">
              {(
                [
                  { value: 'original' as OutputFormat, label: 'オリジナル' },
                  { value: 'vertical' as OutputFormat, label: '縦動画（9:16）' },
                  { value: 'horizontal' as OutputFormat, label: '横動画（16:9）' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOutputFormat(value)}
                  disabled={isComposing}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    outputFormat === value
                      ? 'bg-background text-foreground shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  } ${isComposing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* フォントサイズ */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0 w-20">フォント</Label>
            <div className="inline-flex rounded-lg border border-gray-200 bg-muted p-1">
              {(
                [
                  { value: 'large' as SubtitleFontSize, label: '大' },
                  { value: 'medium' as SubtitleFontSize, label: '中' },
                  { value: 'small' as SubtitleFontSize, label: '小' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFontSize(value)}
                  disabled={isComposing}
                  className={`px-3 py-1.5 text-sm rounded-md transition-all ${
                    fontSize === value
                      ? 'bg-background text-foreground shadow-sm font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  } ${isComposing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* テキスト枠の色 */}
          <div className="flex items-center gap-3">
            <Label className="text-sm font-medium shrink-0 w-20">テキスト</Label>
            {(
              [
                { value: '#30bca7' as OutlineColor, label: '緑' },
                { value: '#56d6ea' as OutlineColor, label: '水色' },
                { value: '#ff7aa2' as OutlineColor, label: 'ピンク' },
                { value: '#000000' as OutlineColor, label: '黒' },
              ] as const
            ).map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => setOutlineColor(value)}
                disabled={isComposing}
                title={label}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  outlineColor === value
                    ? 'border-primary ring-2 ring-primary/30 scale-110'
                    : 'border-gray-300 hover:scale-105'
                } ${isComposing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                style={{ backgroundColor: value }}
              />
            ))}
          </div>

          {/* 余白の色 */}
          {(outputFormat === 'vertical' || outputFormat === 'horizontal') && (
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium shrink-0 w-20">背景色</Label>
              {(
                [
                  { value: '#30bca7' as PaddingColor, label: '緑' },
                  { value: '#56d6ea' as PaddingColor, label: '水色' },
                  { value: '#ff7aa2' as PaddingColor, label: 'ピンク' },
                  { value: '#000000' as PaddingColor, label: '黒' },
                  { value: '#ffffff' as PaddingColor, label: '白' },
                ] as const
              ).map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPaddingColor(value)}
                  disabled={isComposing}
                  title={label}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    paddingColor === value
                      ? 'border-primary ring-2 ring-primary/30 scale-110'
                      : 'border-gray-300 hover:scale-105'
                  } ${isComposing ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                  style={{ backgroundColor: value }}
                />
              ))}
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
