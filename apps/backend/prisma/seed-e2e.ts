import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function seedE2E() {
  // クリーンアップ（依存関係順）
  await prisma.refinedTranscription.deleteMany();
  await prisma.transcription.deleteMany();
  await prisma.clip.deleteMany();
  await prisma.processingJob.deleteMany();
  await prisma.video.deleteMany();

  // 動画データ作成
  const videos = await Promise.all([
    // 1. 完了済み動画（クリップ・文字起こしあり）
    prisma.video.create({
      data: {
        id: 'e2e-video-completed',
        googleDriveFileId: 'e2e-drive-file-1',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-1/view',
        title: 'E2Eテスト動画 - 完了',
        description: 'E2Eテスト用の完了済み動画',
        durationSeconds: 600,
        fileSizeBytes: 100000000n,
        status: 'completed',
        clips: {
          create: [
            {
              id: 'e2e-clip-1',
              title: 'クリップ1',
              startTimeSeconds: 0,
              endTimeSeconds: 30,
              durationSeconds: 30,
              status: 'completed',
              googleDriveFileId: 'e2e-clip-drive-1',
              googleDriveUrl: 'https://drive.google.com/file/d/e2e-clip-1/view',
            },
            {
              id: 'e2e-clip-2',
              title: 'クリップ2',
              startTimeSeconds: 60,
              endTimeSeconds: 120,
              durationSeconds: 60,
              status: 'completed',
              googleDriveFileId: 'e2e-clip-drive-2',
              googleDriveUrl: 'https://drive.google.com/file/d/e2e-clip-2/view',
            },
          ],
        },
        transcription: {
          create: {
            id: 'e2e-transcription-1',
            fullText: 'これはE2Eテスト用の文字起こしです。テスト動画の内容を表しています。',
            segments: [
              { start: 0, end: 5, text: 'これはE2Eテスト用の' },
              { start: 5, end: 10, text: '文字起こしです。' },
              { start: 10, end: 15, text: 'テスト動画の内容を表しています。' },
            ],
            languageCode: 'ja',
            durationSeconds: 15,
          },
        },
        processingJobs: {
          create: {
            id: 'e2e-job-1',
            clipInstructions: '面白い部分を切り抜いて',
            status: 'completed',
            startedAt: new Date(),
            completedAt: new Date(),
          },
        },
      },
    }),

    // 2. 処理中動画
    prisma.video.create({
      data: {
        id: 'e2e-video-processing',
        googleDriveFileId: 'e2e-drive-file-2',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-2/view',
        title: 'E2Eテスト動画 - 処理中',
        status: 'transcribing',
        durationSeconds: 300,
        fileSizeBytes: 50000000n,
      },
    }),

    // 3. 未処理動画
    prisma.video.create({
      data: {
        id: 'e2e-video-pending',
        googleDriveFileId: 'e2e-drive-file-3',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-3/view',
        title: 'E2Eテスト動画 - 未処理',
        status: 'pending',
      },
    }),

    // 4. エラー動画
    prisma.video.create({
      data: {
        id: 'e2e-video-error',
        googleDriveFileId: 'e2e-drive-file-4',
        googleDriveUrl: 'https://drive.google.com/file/d/e2e-drive-file-4/view',
        title: 'E2Eテスト動画 - エラー',
        status: 'failed',
        errorMessage: 'テスト用のエラーメッセージ',
      },
    }),
  ]);

  console.log(`Seeded ${videos.length} videos for E2E tests`);
  return videos;
}

export async function cleanupE2E() {
  await prisma.refinedTranscription.deleteMany();
  await prisma.transcription.deleteMany();
  await prisma.clip.deleteMany();
  await prisma.processingJob.deleteMany();
  await prisma.video.deleteMany();
  console.log('E2E test data cleaned up');
}

// CLI実行用
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  seedE2E()
    .then(() => prisma.$disconnect())
    .catch((e) => {
      console.error(e);
      prisma.$disconnect();
      process.exit(1);
    });
}
