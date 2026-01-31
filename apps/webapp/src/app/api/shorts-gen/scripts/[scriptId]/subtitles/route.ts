import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

// 字幕一括生成は時間がかかるため、タイムアウトを5分に設定
export const maxDuration = 300;

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

    // fetch のタイムアウトを5分に設定
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 300000);

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_API_KEY && { 'X-API-Key': BACKEND_API_KEY }),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

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

    // AbortErrorの場合はタイムアウトエラーとして処理
    if (error instanceof Error && error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ error: 'Request timeout: subtitle generation took too long' }),
        {
          status: 504,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
