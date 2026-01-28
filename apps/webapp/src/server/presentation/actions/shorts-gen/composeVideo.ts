'use server';

import type {
  ComposeVideoAcceptedResponse,
  ComposeVideoResponse,
  GetComposedVideoResponse,
} from '@video-processor/shared';

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

export async function composeVideo(
  projectId: string,
  scriptId: string,
  bgmKey?: string | null
): Promise<ComposeVideoAcceptedResponse> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/compose`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, scriptId, bgmKey }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`動画合成の開始に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function composeVideoSync(
  projectId: string,
  scriptId: string,
  bgmKey?: string | null
): Promise<ComposeVideoResponse> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/compose/sync`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectId, scriptId, bgmKey }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`動画合成に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function getComposedVideoByProject(
  projectId: string
): Promise<GetComposedVideoResponse | null> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/compose/project/${projectId}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`合成動画の取得に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function getComposedVideo(id: string): Promise<GetComposedVideoResponse | null> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/compose/${id}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
    cache: 'no-store',
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`合成動画の取得に失敗しました: ${errorText}`);
  }

  return response.json();
}

export async function deleteComposedVideo(id: string): Promise<void> {
  const response = await fetch(`${BACKEND_URL}/api/shorts-gen/compose/${id}`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`合成動画の削除に失敗しました: ${errorText}`);
  }
}
