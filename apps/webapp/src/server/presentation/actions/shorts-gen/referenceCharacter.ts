'use server';

import { backendClient } from '@/server/infrastructure/clients/backend-client';
import type {
  CreateReferenceCharacterResponse,
  GetReferenceCharactersResponse,
} from '@video-processor/shared';
import { revalidatePath } from 'next/cache';

export async function getReferenceCharacters(
  projectId: string
): Promise<GetReferenceCharactersResponse> {
  return backendClient.getReferenceCharacters(projectId, { revalidate: false });
}

export interface CreateReferenceCharacterResult {
  success: boolean;
  data?: CreateReferenceCharacterResponse;
  error?: string;
}

export async function createReferenceCharacter(
  projectId: string,
  formData: FormData
): Promise<CreateReferenceCharacterResult> {
  try {
    const response = await backendClient.createReferenceCharacter(projectId, formData);
    revalidatePath(`/shorts-gen/${projectId}`);
    return {
      success: true,
      data: response,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '参照キャラクターの登録に失敗しました',
    };
  }
}

export interface DeleteReferenceCharacterResult {
  success: boolean;
  error?: string;
}

export async function deleteReferenceCharacter(
  projectId: string,
  characterId: string
): Promise<DeleteReferenceCharacterResult> {
  try {
    await backendClient.deleteReferenceCharacter(projectId, characterId);
    revalidatePath(`/shorts-gen/${projectId}`);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : '参照キャラクターの削除に失敗しました',
    };
  }
}
