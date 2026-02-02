'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { revalidatePath } from 'next/cache';

export interface DeleteShortsProjectResult {
  success: boolean;
  error?: string;
}

export async function deleteShortsProject(id: string): Promise<DeleteShortsProjectResult> {
  try {
    await getBackendClient().deleteShortsProject(id);
    revalidatePath('/shorts-gen');
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'プロジェクトの削除に失敗しました',
    };
  }
}
