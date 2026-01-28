'use client';

import { ProjectStatusBadge } from '@/components/features/shorts-gen/project-list/project-status-badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
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
import { deleteShortsProject } from '@/server/presentation/actions/deleteShortsProject';
import type { ShortsProjectSummary } from '@video-processor/shared';
import { Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface ProjectTableProps {
  projects: ShortsProjectSummary[];
}

export function ProjectTable({ projects }: ProjectTableProps) {
  const router = useRouter();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (projectId: string) => {
    setDeletingId(projectId);
    try {
      await deleteShortsProject(projectId);
      router.refresh();
    } finally {
      setDeletingId(null);
    }
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        プロジェクトがまだ作成されていません。
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>タイトル</TableHead>
          <TableHead>ステータス</TableHead>
          <TableHead>アスペクト比</TableHead>
          <TableHead>解像度</TableHead>
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
              <ProjectStatusBadge status={project.status} />
            </TableCell>
            <TableCell>{project.aspectRatio}</TableCell>
            <TableCell>
              {project.resolutionWidth}x{project.resolutionHeight}
            </TableCell>
            <TableCell>{formatDate(project.createdAt)}</TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/shorts-gen/${project.id}`}>詳細</Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={deletingId === project.id}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>プロジェクトを削除しますか？</AlertDialogTitle>
                      <AlertDialogDescription>
                        「{project.title}」を削除します。
                        関連する企画書、台本、生成アセット、動画も削除されます。
                        この操作は取り消せません。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>キャンセル</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(project.id)}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        削除
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
