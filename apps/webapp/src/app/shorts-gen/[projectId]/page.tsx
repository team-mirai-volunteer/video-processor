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
    const response = await loadShortsProject(projectId);

    return <ProjectDetailClient project={response.data} />;
  } catch {
    notFound();
  }
}
