import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { formatDate } from '@/lib/utils';
import type { ShortsProjectSummary } from '@video-processor/shared';
import { CheckCircle2, Circle } from 'lucide-react';
import Link from 'next/link';
import { DeleteProjectButton } from './delete-project-button';

interface ProjectTableProps {
  projects: ShortsProjectSummary[];
}

function ProgressIndicator({ completed, label }: { completed: boolean; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      {completed ? (
        <CheckCircle2 className="h-4 w-4 text-green-500" />
      ) : (
        <Circle className="h-4 w-4 text-muted-foreground" />
      )}
      <span className={completed ? 'text-foreground' : 'text-muted-foreground'}>{label}</span>
    </div>
  );
}

export function ProjectTable({ projects }: ProjectTableProps) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        プロジェクトがまだありません。「新規作成」から始めましょう。
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>タイトル</TableHead>
          <TableHead>アスペクト比</TableHead>
          <TableHead>進捗</TableHead>
          <TableHead>作成日時</TableHead>
          <TableHead className="text-right">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {projects.map((project) => (
          <TableRow key={project.id}>
            <TableCell className="font-medium">
              <Link href={`/shorts-gen/${project.id}`} className="hover:underline">
                {project.title}
              </Link>
            </TableCell>
            <TableCell>
              <Badge variant="outline">{project.aspectRatio}</Badge>
            </TableCell>
            <TableCell>
              <div className="flex gap-4 text-sm">
                <ProgressIndicator completed={project.hasPlan} label="企画" />
                <ProgressIndicator completed={project.hasScript} label="台本" />
                <ProgressIndicator completed={project.hasComposedVideo} label="動画" />
              </div>
            </TableCell>
            <TableCell>{formatDate(project.createdAt)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/shorts-gen/${project.id}`}>編集</Link>
                </Button>
                <DeleteProjectButton projectId={project.id} projectTitle={project.title} />
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
