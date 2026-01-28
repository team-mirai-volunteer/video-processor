'use server';

import type { GeneratePublishTextResponse, GetPublishTextResponse } from '@video-processor/shared';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function generatePublishText(projectId: string): Promise<GeneratePublishTextResponse> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/publish`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`公開テキストの生成に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function getPublishTextByProject(
  projectId: string
): Promise<GetPublishTextResponse | null> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/publish/project/${projectId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`公開テキストの取得に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function getPublishText(id: string): Promise<GetPublishTextResponse | null> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/publish/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`公開テキストの取得に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function updatePublishText(
  id: string,
  title?: string,
  description?: string
): Promise<GetPublishTextResponse> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/publish/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, description }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`公開テキストの更新に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function deletePublishText(id: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/publish/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`公開テキストの削除に失敗しました: ${errorText}`);
  }
}
