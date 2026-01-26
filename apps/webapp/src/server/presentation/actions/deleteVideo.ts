'use server';

import { revalidatePath } from 'next/cache';
import { backendClient } from '../../infrastructure/clients/backend-client';

export async function deleteVideo(id: string): Promise<void> {
  await backendClient.deleteVideo(id);
  revalidatePath('/');
}
