import type { ClipExtractionData } from '@video-processor/shared';
import { parseTimeToSeconds } from '../models/clip.js';

export interface ExtractedTimestamp {
  title: string;
  startTimeSeconds: number;
  endTimeSeconds: number;
  transcript: string;
  reason: string;
}

/**
 * Service for extracting and validating timestamps from AI response
 */
export class TimestampExtractorService {
  /**
   * Convert AI clip data to domain format
   */
  extractTimestamps(clips: ClipExtractionData[]): ExtractedTimestamp[] {
    return clips.map((clip) => ({
      title: clip.title,
      startTimeSeconds: parseTimeToSeconds(clip.startTime),
      endTimeSeconds: parseTimeToSeconds(clip.endTime),
      transcript: clip.transcript,
      reason: clip.reason,
    }));
  }

  /**
   * Validate that timestamps are within video duration
   */
  validateTimestamps(
    timestamps: ExtractedTimestamp[],
    videoDurationSeconds: number | null
  ): ExtractedTimestamp[] {
    if (videoDurationSeconds === null) {
      return timestamps;
    }

    return timestamps.filter((ts) => {
      // Ensure start time is within video duration
      if (ts.startTimeSeconds >= videoDurationSeconds) {
        return false;
      }
      // Ensure end time is within video duration
      if (ts.endTimeSeconds > videoDurationSeconds) {
        return false;
      }
      // Ensure valid time range
      if (ts.startTimeSeconds >= ts.endTimeSeconds) {
        return false;
      }
      return true;
    });
  }

  /**
   * Sort timestamps by start time
   */
  sortByStartTime(timestamps: ExtractedTimestamp[]): ExtractedTimestamp[] {
    return [...timestamps].sort((a, b) => a.startTimeSeconds - b.startTimeSeconds);
  }

  /**
   * Check for overlapping timestamps
   */
  findOverlaps(timestamps: ExtractedTimestamp[]): Array<{ index1: number; index2: number }> {
    const sorted = this.sortByStartTime(timestamps);
    const overlaps: Array<{ index1: number; index2: number }> = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i];
      const next = sorted[i + 1];
      if (current && next && current.endTimeSeconds > next.startTimeSeconds) {
        overlaps.push({ index1: i, index2: i + 1 });
      }
    }

    return overlaps;
  }
}
