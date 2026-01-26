'use server';

import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { revalidatePath } from 'next/cache';

export async function deleteVideo(id: string): Promise<void> {
  await getBackendClient().deleteVideo(id);
  revalidatePath('/');
}
