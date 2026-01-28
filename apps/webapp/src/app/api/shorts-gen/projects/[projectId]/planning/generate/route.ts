import type { NextRequest } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || '';
const BACKEND_API_KEY = process.env.BACKEND_API_KEY || '';

/**
 * POST /api/shorts-gen/projects/:projectId/planning/generate
 * Proxy to backend planning generation SSE endpoint
 */
export async function POST(request: NextRequest, { params }: { params: { projectId: string } }) {
  const { projectId } = params;

  try {
    const body = await request.json();

    // Transform request body from ChatUI format to backend format
    // ChatUI sends: { message, history }
    // Backend expects: { userMessage, conversationHistory }
    const backendBody = {
      userMessage: body.message,
      conversationHistory: body.history,
    };

    const backendUrl = `${BACKEND_URL}/api/shorts-gen/projects/${projectId}/planning/generate`;

    const response = await fetch(backendUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(BACKEND_API_KEY && { 'X-API-Key': BACKEND_API_KEY }),
      },
      body: JSON.stringify(backendBody),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(errorText, {
        status: response.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Stream SSE response from backend
    return new Response(response.body, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('Error proxying planning generate request:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
