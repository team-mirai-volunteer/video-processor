import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

/**
 * PATCH /api/shorts-gen/projects/:projectId/planning/:planningId
 * Proxy to backend planning update endpoint
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { projectId: string; planningId: string } }
) {
  const { projectId } = params;

  try {
    const body = await request.json();

    // Backend expects PATCH to /api/shorts-gen/projects/:projectId/planning
    const backendUrl = `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/planning`;

    const response = await fetch(backendUrl, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_API_KEY && { 'X-API-Key': BACKEND_API_KEY }),
      },
      body: JSON.stringify({
        content: body.content,
      }),
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
    console.error('Error proxying planning update request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
