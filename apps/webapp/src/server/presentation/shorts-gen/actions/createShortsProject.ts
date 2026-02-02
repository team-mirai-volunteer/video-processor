'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import type { CreateShortsProjectRequest, ShortsProject } from '@video-processor/shared';
import { revalidatePath } from 'next/cache';

export interface CreateShortsProjectResult {
  success: boolean;
  data?: ShortsProject;
  error?: string;
}

export async function createShortsProject(
  request: CreateShortsProjectRequest
): Promise<CreateShortsProjectResult> {
  try {
    const response = await getBackendClient().createShortsProject(request);
    revalidatePath('/shorts-gen');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'プロジェクトの作成に失敗しました',
    };
  }
}
