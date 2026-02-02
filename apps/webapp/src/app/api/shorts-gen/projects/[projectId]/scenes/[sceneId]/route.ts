import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

/**
 * PATCH /api/shorts-gen/projects/:projectId/scenes/:sceneId
 * Proxy to backend scene update endpoint
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; sceneId: string } }
) {
  const { projectId, sceneId } = params;

  try {
    const body = await request.json();

    const backendUrl = `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/script/scenes/${sceneId}`;

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_API_KEY && { 'X-API-Key': BACKEND_API_KEY }),
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error proxying scene update request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
