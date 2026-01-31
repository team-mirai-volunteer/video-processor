import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

/**
 * POST /api/shorts-gen/scripts/:scriptId/subtitles
 * Proxy to backend subtitle generation endpoint
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
  const { scriptId } = await params;

  try {
    const body = await request.json().catch(() => ({}));

    const backendUrl = `${BACKEND_URL}/api/shorts-gen/scripts/${scriptId}/subtitles`;

    const response = await fetch(backendUrl, {
      method: 'POST',
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
    console.error('Error proxying subtitle generate request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
