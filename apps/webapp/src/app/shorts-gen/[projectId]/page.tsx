import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { loadShortsProject } from '@/server/presentation/shorts-gen/loaders/loadShortsProject';
import { AlertTriangle } from 'lucide-react';
import { notFound } from 'next/navigation';
import { ProjectDetailClient } from './project-detail-client';

export const dynamic = 'force-dynamic';

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;

  try {
    const [projectResponse, planningResponse, scriptResponse, referenceCharactersResponse] =
      await Promise.all([
        loadShortsProject(projectId),
        getBackendClient().getShortsPlanning(projectId, { revalidate: false }),
        getBackendClient().getShortsScript(projectId, { revalidate: false }),
        getBackendClient().getReferenceCharacters(projectId, { revalidate: false }),
      ]);

    const initialPlanning = planningResponse ?? null;
    const initialScenes = scriptResponse
      ? scriptResponse.scenes.map((s) => ({ ...s, scriptId: scriptResponse.id }))
      : [];
    const initialScript = scriptResponse
      ? {
          id: scriptResponse.id,
          projectId: scriptResponse.projectId,
          planningId: scriptResponse.planningId,
          version: scriptResponse.version,
          scenes: initialScenes,
          createdAt: scriptResponse.createdAt,
          updatedAt: scriptResponse.updatedAt,
        }
      : null;

    // Fetch assets if script exists
    let initialAssets = null;
    if (scriptResponse) {
      const [voiceResponse, subtitlesResponse, imagesResponse] = await Promise.all([
        getBackendClient().getShortsVoice(scriptResponse.id, { revalidate: false }),
        getBackendClient().getShortsSubtitles(scriptResponse.id, { revalidate: false }),
        getBackendClient().getShortsImages(scriptResponse.id, { revalidate: false }),
      ]);
      initialAssets = {
        voice: voiceResponse,
        subtitles: subtitlesResponse,
        images: imagesResponse,
      };
    }

    return (
      <div className="space-y-6">
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0 text-destructive" />
            <ul className="list-disc list-inside text-sm text-destructive space-y-1">
              <li>この機能は実装中で動作に不安定な部分があります。</li>
              <li>他者が権利を持つキャラクターを使っての生成は絶対に行わないでください。</li>
            </ul>
          </div>
        </div>
        <ProjectDetailClient
          project={projectResponse.data}
          initialPlanning={initialPlanning}
          initialScript={initialScript}
          initialScenes={initialScenes}
          initialAssets={initialAssets}
          initialReferenceCharacters={referenceCharactersResponse?.characters ?? []}
        />
      </div>
    );
  } catch {
    notFound();
  }
}
