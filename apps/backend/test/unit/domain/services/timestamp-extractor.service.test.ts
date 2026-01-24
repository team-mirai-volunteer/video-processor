import { describe, expect, it } from 'vitest';
import { TimestampExtractorService } from '../../../../src/domain/services/timestamp-extractor.service.js';

describe('TimestampExtractorService', () => {
  const service = new TimestampExtractorService();

  describe('extractTimestamps', () => {
    it('should convert AI clip data to domain format', () => {
      const clips = [
        {
          title: 'Intro',
          startTime: '00:00:00',
          endTime: '00:00:45',
          transcript: 'Hello everyone',
          reason: 'Good intro',
        },
        {
          title: 'Main Topic',
          startTime: '00:05:30',
          endTime: '00:06:15',
          transcript: 'The main topic is...',
          reason: 'Key content',
        },
      ];

      const result = service.extractTimestamps(clips);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        title: 'Intro',
        startTimeSeconds: 0,
        endTimeSeconds: 45,
        transcript: 'Hello everyone',
        reason: 'Good intro',
      });
      expect(result[1]).toEqual({
        title: 'Main Topic',
        startTimeSeconds: 330,
        endTimeSeconds: 375,
        transcript: 'The main topic is...',
        reason: 'Key content',
      });
    });
  });

  describe('validateTimestamps', () => {
    it('should filter out timestamps outside video duration', () => {
      const timestamps = [
        {
          title: 'Valid',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: '',
          reason: '',
        },
        {
          title: 'Starts too late',
          startTimeSeconds: 100,
          endTimeSeconds: 130,
          transcript: '',
          reason: '',
        },
        {
          title: 'Ends too late',
          startTimeSeconds: 50,
          endTimeSeconds: 100,
          transcript: '',
          reason: '',
        },
      ];

      const result = service.validateTimestamps(timestamps, 60);

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Valid');
    });

    it('should filter out invalid time ranges', () => {
      const timestamps = [
        {
          title: 'Valid',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: '',
          reason: '',
        },
        {
          title: 'Invalid range',
          startTimeSeconds: 30,
          endTimeSeconds: 30,
          transcript: '',
          reason: '',
        },
      ];

      const result = service.validateTimestamps(timestamps, 60);

      expect(result).toHaveLength(1);
      expect(result[0]?.title).toBe('Valid');
    });

    it('should return all timestamps when duration is null', () => {
      const timestamps = [
        {
          title: 'Test',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: '',
          reason: '',
        },
      ];

      const result = service.validateTimestamps(timestamps, null);
      expect(result).toHaveLength(1);
    });
  });

  describe('sortByStartTime', () => {
    it('should sort timestamps by start time', () => {
      const timestamps = [
        {
          title: 'Third',
          startTimeSeconds: 100,
          endTimeSeconds: 130,
          transcript: '',
          reason: '',
        },
        {
          title: 'First',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: '',
          reason: '',
        },
        {
          title: 'Second',
          startTimeSeconds: 50,
          endTimeSeconds: 80,
          transcript: '',
          reason: '',
        },
      ];

      const result = service.sortByStartTime(timestamps);

      expect(result[0]?.title).toBe('First');
      expect(result[1]?.title).toBe('Second');
      expect(result[2]?.title).toBe('Third');
    });

    it('should not modify original array', () => {
      const timestamps = [
        {
          title: 'Second',
          startTimeSeconds: 50,
          endTimeSeconds: 80,
          transcript: '',
          reason: '',
        },
        {
          title: 'First',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: '',
          reason: '',
        },
      ];

      service.sortByStartTime(timestamps);

      expect(timestamps[0]?.title).toBe('Second');
    });
  });

  describe('findOverlaps', () => {
    it('should find overlapping timestamps', () => {
      const timestamps = [
        {
          title: 'First',
          startTimeSeconds: 0,
          endTimeSeconds: 40,
          transcript: '',
          reason: '',
        },
        {
          title: 'Second',
          startTimeSeconds: 30,
          endTimeSeconds: 60,
          transcript: '',
          reason: '',
        },
        {
          title: 'Third',
          startTimeSeconds: 100,
          endTimeSeconds: 130,
          transcript: '',
          reason: '',
        },
      ];

      const result = service.findOverlaps(timestamps);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ index1: 0, index2: 1 });
    });

    it('should return empty array when no overlaps', () => {
      const timestamps = [
        {
          title: 'First',
          startTimeSeconds: 0,
          endTimeSeconds: 30,
          transcript: '',
          reason: '',
        },
        {
          title: 'Second',
          startTimeSeconds: 30,
          endTimeSeconds: 60,
          transcript: '',
          reason: '',
        },
      ];

      const result = service.findOverlaps(timestamps);
      expect(result).toHaveLength(0);
    });
  });
});
