import { loadShortsProject } from '@/server/presentation/loaders/loadShortsProject';
import { ProjectDetailClient } from './project-detail-client';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ projectId: string }>;
}

export default async function ShortsGenProjectPage({ params }: PageProps) {
  const { projectId } = await params;
  const project = await loadShortsProject(projectId);

  return <ProjectDetailClient project={project} />;
}
