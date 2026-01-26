import { getBackendClient } from '@/server/infrastructure/clients/get-backend-client';
import { NextResponse } from 'next/server';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const client = getBackendClient();
    const video = await client.getVideo(id, { revalidate: false });

    return NextResponse.json({
      progressMessage: video.progressMessage,
      status: video.status,
    });
  } catch (error) {
    console.error('Failed to get video progress:', error);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }
}
