import type { RefinedSentence } from '../models/refined-transcription.js';
import type { TranscriptionSegment } from '../models/transcription.js';

/**
 * Subtitle entry for SRT format
 */
interface SubtitleEntry {
  text: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
}

/**
 * Format seconds to SRT time format (HH:MM:SS,mmm)
 * Example: 65.5 -> "00:01:05,500"
 */
function formatSrtTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const milliseconds = Math.round((seconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${milliseconds.toString().padStart(3, '0')}`;
}

/**
 * Convert subtitle entries to SRT format
 */
function entriesToSrt(entries: SubtitleEntry[]): string {
  return entries
    .map((entry, index) => {
      const sequenceNumber = index + 1;
      const startTime = formatSrtTime(entry.startTimeSeconds);
      const endTime = formatSrtTime(entry.endTimeSeconds);

      return `${sequenceNumber}\n${startTime} --> ${endTime}\n${entry.text}`;
    })
    .join('\n\n');
}

/**
 * Convert transcription segments to SRT format
 * Groups consecutive segments into subtitles for better readability
 */
export function transcriptionToSrt(segments: TranscriptionSegment[]): string {
  if (segments.length === 0) {
    return '';
  }

  // Group segments into subtitles (max ~10 seconds or ~50 characters per subtitle)
  const MAX_DURATION = 10;
  const MAX_CHARS = 50;

  const entries: SubtitleEntry[] = [];
  let currentEntry: SubtitleEntry | null = null;

  for (const segment of segments) {
    if (!currentEntry) {
      currentEntry = {
        text: segment.text,
        startTimeSeconds: segment.startTimeSeconds,
        endTimeSeconds: segment.endTimeSeconds,
      };
      continue;
    }

    const wouldExceedDuration =
      segment.endTimeSeconds - currentEntry.startTimeSeconds > MAX_DURATION;
    const wouldExceedChars = currentEntry.text.length + segment.text.length > MAX_CHARS;

    if (wouldExceedDuration || wouldExceedChars) {
      entries.push(currentEntry);
      currentEntry = {
        text: segment.text,
        startTimeSeconds: segment.startTimeSeconds,
        endTimeSeconds: segment.endTimeSeconds,
      };
    } else {
      currentEntry.text += segment.text;
      currentEntry.endTimeSeconds = segment.endTimeSeconds;
    }
  }

  if (currentEntry) {
    entries.push(currentEntry);
  }

  return entriesToSrt(entries);
}

/**
 * Convert refined sentences to SRT format
 * Each sentence becomes one subtitle entry
 */
export function refinedTranscriptionToSrt(sentences: RefinedSentence[]): string {
  if (sentences.length === 0) {
    return '';
  }

  const entries: SubtitleEntry[] = sentences.map((sentence) => ({
    text: sentence.text,
    startTimeSeconds: sentence.startTimeSeconds,
    endTimeSeconds: sentence.endTimeSeconds,
  }));

  return entriesToSrt(entries);
}
