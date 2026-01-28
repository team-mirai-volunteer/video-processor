'use client';

import { useState } from 'react';
import { AssetGenerationStep } from './asset-generation-step';
import { createMockHandlers } from './mock-handlers';
import type { Scene } from './types';

const SAMPLE_SCENES: Scene[] = [
  {
    id: 'scene-1',
    order: 0,
    summary: 'オープニング：AIの時代が到来',
    visualType: 'image_gen',
    voiceText:
      'みなさんこんにちは。今日はAIがどのように私たちの生活を変えているかについてお話しします。',
    subtitles: ['AIの時代が', '到来しました'],
    silenceDurationMs: null,
    imagePrompt: 'Futuristic city with AI robots helping humans, anime style, vibrant colors',
  },
  {
    id: 'scene-2',
    order: 1,
    summary: 'AIの活用事例紹介',
    visualType: 'image_gen',
    voiceText: 'AIは医療、教育、エンターテインメントなど様々な分野で活用されています。',
    subtitles: ['医療・教育・', 'エンタメで活躍'],
    silenceDurationMs: null,
    imagePrompt: 'Split screen showing AI in healthcare, education, and entertainment',
  },
  {
    id: 'scene-3',
    order: 2,
    summary: '静止画：データグラフ',
    visualType: 'stock_video',
    voiceText: null,
    subtitles: ['AI市場は', '年々拡大中'],
    silenceDurationMs: 3000,
    imagePrompt: null,
  },
  {
    id: 'scene-4',
    order: 3,
    summary: 'まとめと締めくくり',
    visualType: 'image_gen',
    voiceText: 'これからもAIの進化から目が離せません。ご視聴ありがとうございました。',
    subtitles: ['AIの進化に', '注目！'],
    silenceDurationMs: null,
    imagePrompt: 'Thank you screen with futuristic theme, anime style',
  },
];

export function AssetGenerationDemo() {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isCompleted, setIsCompleted] = useState(false);
  const mockHandlers = createMockHandlers(SAMPLE_SCENES);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">素材生成UI デモ (E6)</h1>
      <p className="text-muted-foreground">
        このデモはバックエンドなしでAssetGenerationStepコンポーネントの動作を確認できます。
        「生成」ボタンをクリックすると、モックデータを使った生成処理がシミュレートされます。
      </p>

      <div className="space-y-4">
        <AssetGenerationStep
          projectId="demo-project"
          scenes={SAMPLE_SCENES}
          isExpanded={isExpanded}
          onToggle={() => setIsExpanded(!isExpanded)}
          onComplete={() => setIsCompleted(true)}
          canStart={true}
          onVoiceGenerate={mockHandlers.onVoiceGenerate}
          onSubtitleGenerate={mockHandlers.onSubtitleGenerate}
          onImageGenerate={mockHandlers.onImageGenerate}
          onAllVoicesGenerate={mockHandlers.onAllVoicesGenerate}
          onAllSubtitlesGenerate={mockHandlers.onAllSubtitlesGenerate}
          onAllImagesGenerate={mockHandlers.onAllImagesGenerate}
        />

        {isCompleted && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800">
              ✅ すべての素材が生成されました！次のステップ（⑧ Compose）に進めます。
            </p>
          </div>
        )}
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <h2 className="font-semibold mb-2">使用方法</h2>
        <pre className="text-xs overflow-x-auto bg-background p-3 rounded">
          {`import { AssetGenerationStep } from '@/components/features/shorts-gen/asset-generation';
import { generateVoice, generateAllVoices } from '@/server/presentation/actions/shorts-gen';

// In your component:
<AssetGenerationStep
  projectId={project.id}
  scenes={script.scenes}
  isExpanded={isExpanded}
  onToggle={() => setIsExpanded(!isExpanded)}
  onComplete={() => setCanCompose(true)}
  canStart={hasScript}
  onVoiceGenerate={(sceneId) => generateVoice(project.id, sceneId)}
  onAllVoicesGenerate={() => generateAllVoices(project.id)}
  // ... other handlers
/>`}
        </pre>
      </div>
    </div>
  );
}
