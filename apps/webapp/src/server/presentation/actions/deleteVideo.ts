'use server';

import { revalidatePath } from 'next/cache';
import { getBackendClient } from '../../infrastructure/clients/get-backend-client';

export async function deleteVideo(id: string): Promise<void> {
  await getBackendClient().deleteVideo(id);
  revalidatePath('/');
}
