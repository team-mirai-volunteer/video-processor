import { CreateProjectDialog } from '@/components/features/shorts-gen/project-form';
import { ProjectTable } from '@/components/features/shorts-gen/project-list';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { loadShortsProjects } from '@/server/presentation/loaders/loadShortsProjects';

export const dynamic = 'force-dynamic';

export default async function ShortsGenPage() {
  const response = await loadShortsProjects();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">ショート動画生成</h1>
          <p className="text-muted-foreground mt-1">AIを活用してショート動画を自動生成します</p>
        </div>
        <CreateProjectDialog />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>プロジェクト一覧</CardTitle>
          <CardDescription>作成したショート動画生成プロジェクトの一覧です</CardDescription>
        </CardHeader>
        <CardContent>
          <ProjectTable projects={response.data} />
        </CardContent>
      </Card>
    </div>
  );
}
