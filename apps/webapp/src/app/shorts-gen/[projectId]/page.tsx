import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { loadShortsProject } from '@/server/presentation/loaders/loadShortsProject';
import { notFound } from 'next/navigation';
import { ProjectDetailClient } from './project-detail-client';

export const dynamic = 'force-dynamic';

interface ProjectDetailPageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ProjectDetailPage({ params }: ProjectDetailPageProps) {
  const { projectId } = await params;

  try {
    const [projectResponse, planningResponse, scriptResponse] = await Promise.all([
      loadShortsProject(projectId),
      getBackendClient().getShortsPlanning(projectId, { revalidate: false }),
      getBackendClient().getShortsScript(projectId, { revalidate: false }),
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

    return (
      <ProjectDetailClient
        project={projectResponse.data}
        initialPlanning={initialPlanning}
        initialScript={initialScript}
        initialScenes={initialScenes}
      />
    );
  } catch {
    notFound();
  }
}
