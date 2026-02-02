'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { revalidatePath } from 'next/cache';

export type ResetStep = 'cache' | 'audio' | 'transcribe' | 'refine' | 'all';

export async function resetVideo(
  videoId: string,
  step?: ResetStep
): Promise<{ videoId: string; status: string; resetStep: string }> {
  const result = await getBackendClient().resetVideo(videoId, step);
  revalidatePath(`/videos/${videoId}`);
  return result;
}
