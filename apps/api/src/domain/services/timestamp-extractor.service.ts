import type { ClipTimestamp } from '@video-processor/shared';
import type { CreateClipParams } from '../models/clip.js';

/**
 * Convert time string (HH:MM:SS) to seconds
 */
function timeStringToSeconds(timeStr: string): number {
  const parts = timeStr.split(':').map(Number);

  if (parts.length === 3) {
    const [hours, minutes, seconds] = parts;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const [minutes, seconds] = parts;
    return minutes * 60 + seconds;
  } else if (parts.length === 1) {
    return parts[0];
  }

  return 0;
}

/**
 * Timestamp extractor domain service
 * Handles conversion of AI-extracted timestamps to clip creation parameters
 */
export class TimestampExtractorService {
  /**
   * Convert AI clip timestamps to clip creation parameters
   */
  extractClipParams(
    videoId: string,
    timestamps: ClipTimestamp[]
  ): CreateClipParams[] {
    return timestamps.map((timestamp) => {
      const startTimeSeconds = timeStringToSeconds(timestamp.startTime);
      const endTimeSeconds = timeStringToSeconds(timestamp.endTime);
      const durationSeconds = endTimeSeconds - startTimeSeconds;

      return {
        videoId,
        title: timestamp.title,
        startTimeSeconds,
        endTimeSeconds,
        durationSeconds,
        transcript: timestamp.transcript || null,
      };
    });
  }

  /**
   * Validate clip timestamps
   * Returns validation errors if any
   */
  validateTimestamps(timestamps: ClipTimestamp[]): string[] {
    const errors: string[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const timestamp = timestamps[i];
      const startSeconds = timeStringToSeconds(timestamp.startTime);
      const endSeconds = timeStringToSeconds(timestamp.endTime);
      const duration = endSeconds - startSeconds;

      if (startSeconds >= endSeconds) {
        errors.push(
          `Clip ${i + 1}: Start time (${timestamp.startTime}) must be before end time (${timestamp.endTime})`
        );
      }

      if (duration < 10) {
        errors.push(
          `Clip ${i + 1}: Duration (${duration}s) is too short. Minimum is 10 seconds.`
        );
      }

      if (duration > 120) {
        errors.push(
          `Clip ${i + 1}: Duration (${duration}s) is too long. Maximum is 120 seconds.`
        );
      }
    }

    return errors;
  }
}
