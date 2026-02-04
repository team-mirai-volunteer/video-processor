'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { revalidatePath } from 'next/cache';

export async function deleteClip(
  clipId: string,
  videoId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await getBackendClient().deleteClip(clipId);
    revalidatePath('/clips');
    if (videoId) {
      revalidatePath(`/videos/${videoId}`);
    }
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'クリップの削除に失敗しました',
    };
  }
}
