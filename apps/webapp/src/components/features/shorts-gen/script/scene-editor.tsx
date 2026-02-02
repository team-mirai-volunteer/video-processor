'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { Film, Image, Loader2, Plus, Square, Trash2, X } from 'lucide-react';
import { useCallback, useState } from 'react';
import type { Scene, UpdateSceneParams, VisualType } from './types';
import { VISUAL_TYPE_LABELS } from './types';

interface SceneEditorProps {
  scene: Scene;
  onSave: (sceneId: string, params: UpdateSceneParams) => Promise<void>;
  onCancel: () => void;
  isSaving?: boolean;
  className?: string;
}

const VISUAL_TYPES: VisualType[] = ['image_gen', 'stock_video', 'solid_color'];

function VisualTypeButton({
  type,
  isSelected,
  onClick,
}: {
  type: VisualType;
  isSelected: boolean;
  onClick: () => void;
}) {
  const icons: Record<VisualType, React.ReactNode> = {
    image_gen: <Image className="h-4 w-4" />,
    stock_video: <Film className="h-4 w-4" />,
    solid_color: <Square className="h-4 w-4" />,
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-md border text-sm transition-colors',
        isSelected ? 'border-primary bg-primary/10 text-primary' : 'border-input hover:bg-muted'
      )}
    >
      {icons[type]}
      {VISUAL_TYPE_LABELS[type]}
    </button>
  );
}

/** 声の種類オプション */
const VOICE_OPTIONS = [{ key: 'default', label: 'デフォルト' }];

/** スピードのデフォルト値 */
const DEFAULT_VOICE_SPEED = 1.0;

export function SceneEditor({
  scene,
  onSave,
  onCancel,
  isSaving = false,
  className,
}: SceneEditorProps) {
  const [summary, setSummary] = useState(scene.summary);
  const [visualType, setVisualType] = useState<VisualType>(scene.visualType);
  const [voiceText, setVoiceText] = useState(scene.voiceText || '');
  const [subtitles, setSubtitles] = useState<string[]>(scene.subtitles || []);
  const [silenceDurationMs, setSilenceDurationMs] = useState<string>(
    scene.silenceDurationMs !== null ? String(scene.silenceDurationMs) : ''
  );
  const [stockVideoKey, setStockVideoKey] = useState(scene.stockVideoKey || '');
  const [solidColor, setSolidColor] = useState(scene.solidColor || '#000000');
  const [imageStyleHint, setImageStyleHint] = useState(scene.imageStyleHint || '');
  const [voiceKey, setVoiceKey] = useState(scene.voiceKey || 'default');
  const [voiceSpeed, setVoiceSpeed] = useState(scene.voiceSpeed ?? DEFAULT_VOICE_SPEED);

  const handleAddSubtitle = useCallback(() => {
    setSubtitles((prev) => [...prev, '']);
  }, []);

  const handleRemoveSubtitle = useCallback((index: number) => {
    setSubtitles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleSubtitleChange = useCallback((index: number, value: string) => {
    setSubtitles((prev) => prev.map((s, i) => (i === index ? value : s)));
  }, []);

  const handleSave = useCallback(async () => {
    const params: UpdateSceneParams = {
      summary: summary.trim(),
      visualType,
      voiceText: voiceText.trim() || null,
      subtitles: subtitles.filter((s) => s.trim().length > 0),
      silenceDurationMs: silenceDurationMs ? Number.parseInt(silenceDurationMs, 10) : null,
      stockVideoKey: visualType === 'stock_video' ? stockVideoKey.trim() || null : null,
      solidColor: visualType === 'solid_color' ? solidColor : null,
      imageStyleHint: visualType === 'image_gen' ? imageStyleHint.trim() || null : null,
      voiceKey: voiceKey || null,
      voiceSpeed: voiceSpeed !== DEFAULT_VOICE_SPEED ? voiceSpeed : null,
    };

    await onSave(scene.id, params);
  }, [
    scene.id,
    summary,
    visualType,
    voiceText,
    subtitles,
    silenceDurationMs,
    stockVideoKey,
    solidColor,
    imageStyleHint,
    voiceKey,
    voiceSpeed,
    onSave,
  ]);

  return (
    <Card className={cn('', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-base">Scene {scene.order + 1} を編集</CardTitle>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={isSaving}>
          <X className="h-4 w-4" />
          <span className="sr-only">キャンセル</span>
        </Button>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="space-y-2">
          <Label htmlFor="summary">概要</Label>
          <Textarea
            id="summary"
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder="シーンの概要を入力..."
            rows={2}
            disabled={isSaving}
          />
        </div>

        {/* Visual Type */}
        <div className="space-y-2">
          <Label>映像タイプ</Label>
          <div className="flex flex-wrap gap-2">
            {VISUAL_TYPES.map((type) => (
              <VisualTypeButton
                key={type}
                type={type}
                isSelected={visualType === type}
                onClick={() => setVisualType(type)}
              />
            ))}
          </div>
        </div>

        {/* Visual Type Specific Fields */}
        {visualType === 'stock_video' && (
          <div className="space-y-2">
            <Label htmlFor="stockVideoKey">動画素材キー</Label>
            <Input
              id="stockVideoKey"
              value={stockVideoKey}
              onChange={(e) => setStockVideoKey(e.target.value)}
              placeholder="例: party_leader_speech_01"
              disabled={isSaving}
            />
          </div>
        )}

        {visualType === 'solid_color' && (
          <div className="space-y-2">
            <Label htmlFor="solidColor">背景色</Label>
            <div className="flex items-center gap-2">
              <Input
                id="solidColor"
                type="color"
                value={solidColor}
                onChange={(e) => setSolidColor(e.target.value)}
                className="w-16 h-10 p-1 cursor-pointer"
                disabled={isSaving}
              />
              <Input
                value={solidColor}
                onChange={(e) => setSolidColor(e.target.value)}
                placeholder="#000000"
                className="flex-1"
                disabled={isSaving}
              />
            </div>
          </div>
        )}

        {visualType === 'image_gen' && (
          <div className="space-y-2">
            <Label htmlFor="imageStyleHint">画像スタイルヒント（オプション）</Label>
            <Textarea
              id="imageStyleHint"
              value={imageStyleHint}
              onChange={(e) => setImageStyleHint(e.target.value)}
              placeholder="例: 猫キャラクターを使った可愛いイラスト風"
              rows={2}
              disabled={isSaving}
            />
          </div>
        )}

        {/* Voice Text */}
        <div className="space-y-2">
          <Label htmlFor="voiceText">音声テキスト</Label>
          <Textarea
            id="voiceText"
            value={voiceText}
            onChange={(e) => setVoiceText(e.target.value)}
            placeholder="読み上げるテキストを入力..."
            rows={3}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            音声テキストがない場合は、無音区間を設定してください
          </p>
        </div>

        {/* Voice Settings */}
        <div className="space-y-4 border-t pt-4">
          <h4 className="text-sm font-medium">音声設定</h4>

          {/* Voice Key */}
          <div className="space-y-2">
            <Label htmlFor="voiceKey">声の種類</Label>
            <select
              id="voiceKey"
              value={voiceKey}
              onChange={(e) => setVoiceKey(e.target.value)}
              disabled={isSaving}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {VOICE_OPTIONS.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Voice Speed */}
          <div className="space-y-2">
            <Label htmlFor="voiceSpeed">音声スピード: {voiceSpeed.toFixed(1)}x</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">0.5x</span>
              <input
                type="range"
                id="voiceSpeed"
                min={0.5}
                max={2.0}
                step={0.1}
                value={voiceSpeed}
                onChange={(e) => setVoiceSpeed(Number.parseFloat(e.target.value))}
                disabled={isSaving}
                className="flex-1 h-2 bg-secondary rounded-lg appearance-none cursor-pointer"
              />
              <span className="text-xs text-muted-foreground">2.0x</span>
            </div>
            <p className="text-xs text-muted-foreground">1.0が標準速度です</p>
          </div>
        </div>

        {/* Silence Duration */}
        <div className="space-y-2">
          <Label htmlFor="silenceDurationMs">無音区間（ミリ秒）</Label>
          <Input
            id="silenceDurationMs"
            type="number"
            value={silenceDurationMs}
            onChange={(e) => setSilenceDurationMs(e.target.value)}
            placeholder="例: 2000"
            min={0}
            disabled={isSaving}
          />
          <p className="text-xs text-muted-foreground">
            音声テキストがない場合のシーン長さをミリ秒で指定
          </p>
        </div>

        {/* Subtitles */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>字幕</Label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddSubtitle}
              disabled={isSaving}
            >
              <Plus className="h-3.5 w-3.5 mr-1" />
              追加
            </Button>
          </div>
          {subtitles.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">字幕がありません</p>
          ) : (
            <div className="space-y-2">
              {subtitles.map((subtitle, index) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: index is stable for editable list with controlled state
                <div key={index} className="flex items-start gap-2">
                  <span className="text-xs text-muted-foreground mt-2.5 w-6 shrink-0">
                    {index + 1}.
                  </span>
                  <Textarea
                    value={subtitle}
                    onChange={(e) => handleSubtitleChange(index, e.target.value)}
                    placeholder="字幕テキストを入力..."
                    rows={1}
                    className="flex-1 min-h-[40px]"
                    disabled={isSaving}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveSubtitle(index)}
                    disabled={isSaving}
                    className="h-10 w-10 p-0 shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                    <span className="sr-only">削除</span>
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          キャンセル
        </Button>
        <Button onClick={handleSave} disabled={isSaving || !summary.trim()}>
          {isSaving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
          保存
        </Button>
      </CardFooter>
    </Card>
  );
}
