import { execSync, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

/**
 * Check if ffmpeg is available on the system
 */
function isFFmpegAvailable(): boolean {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

// Skip integration tests if INTEGRATION_TEST is not set or ffmpeg is not available
const runIntegrationTests = process.env.INTEGRATION_TEST === 'true' && isFFmpegAvailable();

const OUTPUT_DIR = path.join(__dirname, '../../fixtures/output/drawtext-direct');

/**
 * Execute FFmpeg command and return a promise
 */
function executeFFmpeg(args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn('ffmpeg', args);
    let stdout = '';
    let stderr = '';

    ffmpeg.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    ffmpeg.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    ffmpeg.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr}`));
      }
    });

    ffmpeg.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Get video duration using ffprobe
 */
async function getVideoDuration(videoPath: string): Promise<number> {
  const output = execSync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${videoPath}"`,
    { encoding: 'utf-8' }
  );
  return Number.parseFloat(output.trim());
}

/**
 * Escape text for FFmpeg drawtext filter
 * Note: This is a simplified version for testing. For production, use FFmpegSubtitleGeneratorClient.escapeText()
 */
function escapeDrawtext(text: string): string {
  return text
    .replace(/\\/g, '\\\\\\\\')
    .replace(/'/g, "'\\''") // End quote, add escaped quote, restart quote
    .replace(/:/g, '\\:')
    .replace(/%/g, '\\%');
}

describe.skipIf(!runIntegrationTests)('FFmpeg Drawtext Direct Rendering Integration', () => {
  let tempDir: string;

  beforeAll(async () => {
    await fs.promises.mkdir(OUTPUT_DIR, { recursive: true });
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'drawtext-test-'));
  });

  describe('drawtext with enable expression', () => {
    it('should render multiple subtitles with time-based switching using enable expression', async () => {
      const outputPath = path.join(OUTPUT_DIR, 'drawtext_enable_test.mp4');

      // Subtitle segments with time ranges
      const segments = [
        { text: '字幕1：最初のテスト', startTime: 0, endTime: 2 },
        { text: '字幕2：二番目のテスト', startTime: 2, endTime: 4 },
        { text: '字幕3：最後のテスト', startTime: 4, endTime: 6 },
      ];

      // Build drawtext filter chain with enable expressions
      const drawtextFilters = segments
        .map((seg) => {
          const escapedText = escapeDrawtext(seg.text);
          return [
            `drawtext=text='${escapedText}'`,
            `enable='between(t,${seg.startTime},${seg.endTime})'`,
            "font='Noto Sans CJK JP'",
            'fontsize=48',
            'fontcolor=white',
            'bordercolor=black',
            'borderw=4',
            'x=(w-text_w)/2',
            'y=h*0.8',
          ].join(':');
        })
        .join(',');

      // Generate 6-second test video with drawtext subtitles
      // Using testsrc for video content
      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=6:size=1080x1920:rate=30',
        '-vf',
        drawtextFilters,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        outputPath,
      ];

      await executeFFmpeg(args);

      // Verify output exists and has expected duration
      expect(fs.existsSync(outputPath)).toBe(true);
      const duration = await getVideoDuration(outputPath);
      expect(duration).toBeCloseTo(6, 0);

      console.log(`Saved: ${outputPath}`);
      console.log('Verify manually: subtitles should switch at 0-2s, 2-4s, 4-6s');
    });

    it('should render multi-line subtitles with enable expression', async () => {
      const outputPath = path.join(OUTPUT_DIR, 'drawtext_multiline_test.mp4');

      // Multi-line subtitle using two drawtext filters
      const line1 = escapeDrawtext('これは1行目です');
      const line2 = escapeDrawtext('これは2行目です');

      // Build filter with two lines centered vertically
      const lineHeight = 60;
      const baseY = 0.75; // 75% from top
      const filter = [
        // Line 1
        [
          `drawtext=text='${line1}'`,
          "enable='between(t,0,3)'",
          "font='Noto Sans CJK JP'",
          'fontsize=48',
          'fontcolor=white',
          'bordercolor=black',
          'borderw=4',
          'x=(w-text_w)/2',
          `y=h*${baseY}-${lineHeight / 2}`,
        ].join(':'),
        // Line 2
        [
          `drawtext=text='${line2}'`,
          "enable='between(t,0,3)'",
          "font='Noto Sans CJK JP'",
          'fontsize=48',
          'fontcolor=white',
          'bordercolor=black',
          'borderw=4',
          'x=(w-text_w)/2',
          `y=h*${baseY}+${lineHeight / 2}`,
        ].join(':'),
      ].join(',');

      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=4:size=1080x1920:rate=30',
        '-vf',
        filter,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        outputPath,
      ];

      await executeFFmpeg(args);

      expect(fs.existsSync(outputPath)).toBe(true);
      const duration = await getVideoDuration(outputPath);
      expect(duration).toBeCloseTo(4, 0);

      console.log(`Saved: ${outputPath}`);
    });

    it('should handle Japanese special characters in drawtext', async () => {
      const outputPath = path.join(OUTPUT_DIR, 'drawtext_japanese_special.mp4');

      // Text with various Japanese characters and punctuation
      // Note: Single quotes are complex to escape in FFmpeg drawtext, tested separately
      const testTexts = [
        { text: '「これは引用符です」', startTime: 0, endTime: 2 },
        { text: '100%の確率で成功！', startTime: 2, endTime: 4 },
        { text: 'コロンテスト：成功', startTime: 4, endTime: 6 },
      ];

      const drawtextFilters = testTexts
        .map((seg) => {
          const escapedText = escapeDrawtext(seg.text);
          return [
            `drawtext=text='${escapedText}'`,
            `enable='between(t,${seg.startTime},${seg.endTime})'`,
            "font='Noto Sans CJK JP'",
            'fontsize=48',
            'fontcolor=white',
            'bordercolor=black',
            'borderw=4',
            'x=(w-text_w)/2',
            'y=h*0.8',
          ].join(':');
        })
        .join(',');

      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=6:size=1080x1920:rate=30',
        '-vf',
        drawtextFilters,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        outputPath,
      ];

      await executeFFmpeg(args);

      expect(fs.existsSync(outputPath)).toBe(true);
      console.log(`Saved: ${outputPath}`);
      console.log('Verify manually: Japanese quotes, percent, and colons should render correctly');
    });
  });

  describe('performance comparison', () => {
    it('should measure drawtext direct rendering time', async () => {
      const outputPath = path.join(tempDir, 'perf_drawtext.mp4');

      // 10 subtitle segments
      const segments = Array.from({ length: 10 }, (_, i) => ({
        text: `字幕セグメント ${i + 1}`,
        startTime: i,
        endTime: i + 1,
      }));

      const drawtextFilters = segments
        .map((seg) => {
          const escapedText = escapeDrawtext(seg.text);
          return [
            `drawtext=text='${escapedText}'`,
            `enable='between(t,${seg.startTime},${seg.endTime})'`,
            "font='Noto Sans CJK JP'",
            'fontsize=48',
            'fontcolor=white',
            'bordercolor=black',
            'borderw=4',
            'x=(w-text_w)/2',
            'y=h*0.8',
          ].join(':');
        })
        .join(',');

      const startTime = Date.now();

      const args = [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'testsrc=duration=10:size=1080x1920:rate=30',
        '-vf',
        drawtextFilters,
        '-c:v',
        'libx264',
        '-preset',
        'ultrafast',
        '-pix_fmt',
        'yuv420p',
        outputPath,
      ];

      await executeFFmpeg(args);

      const elapsedMs = Date.now() - startTime;
      console.log(`Drawtext direct rendering (10 segments, 10s video): ${elapsedMs}ms`);

      expect(fs.existsSync(outputPath)).toBe(true);

      // Cleanup temp file
      await fs.promises.unlink(outputPath);
    });
  });
});
