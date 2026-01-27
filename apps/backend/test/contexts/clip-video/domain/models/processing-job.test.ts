import { ProcessingJob } from '@clip-video/domain/models/processing-job.js';
import { describe, expect, it } from 'vitest';

describe('ProcessingJob', () => {
  const generateId = () => 'job-id-123';

  describe('create', () => {
    it('should create a ProcessingJob with valid instructions', () => {
      const result = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: 'Cut the intro section',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('job-id-123');
        expect(result.value.videoId).toBe('video-123');
        expect(result.value.clipInstructions).toBe('Cut the intro section');
        expect(result.value.status).toBe('pending');
        expect(result.value.startedAt).toBe(null);
        expect(result.value.completedAt).toBe(null);
      }
    });

    it('should return error for empty instructions', () => {
      const result = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: '',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_INSTRUCTIONS');
      }
    });

    it('should return error for whitespace-only instructions', () => {
      const result = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: '   ',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('EMPTY_INSTRUCTIONS');
      }
    });
  });

  describe('withStatus', () => {
    it('should transition from pending to analyzing', () => {
      const jobResult = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: 'Test instructions',
        },
        generateId
      );

      expect(jobResult.success).toBe(true);
      if (!jobResult.success) return;

      const result = jobResult.value.withStatus('analyzing');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe('analyzing');
        expect(result.value.startedAt).not.toBe(null);
      }
    });

    it('should set completedAt when transitioning to completed', () => {
      const jobResult = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: 'Test instructions',
        },
        generateId
      );

      expect(jobResult.success).toBe(true);
      if (!jobResult.success) return;

      // Transition through valid states
      let job = jobResult.value;
      const states: Array<'analyzing' | 'extracting' | 'uploading' | 'completed'> = [
        'analyzing',
        'extracting',
        'uploading',
        'completed',
      ];

      for (const state of states) {
        const result = job.withStatus(state);
        expect(result.success).toBe(true);
        if (result.success) {
          job = result.value;
        }
      }

      expect(job.status).toBe('completed');
      expect(job.completedAt).not.toBe(null);
    });

    it('should return error for invalid status transition', () => {
      const jobResult = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: 'Test instructions',
        },
        generateId
      );

      expect(jobResult.success).toBe(true);
      if (!jobResult.success) return;

      // Try to skip from pending to completed
      const result = jobResult.value.withStatus('completed');
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_STATUS_TRANSITION');
      }
    });

    it('should allow transition to failed from any state', () => {
      const jobResult = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: 'Test instructions',
        },
        generateId
      );

      expect(jobResult.success).toBe(true);
      if (!jobResult.success) return;

      const result = jobResult.value.withStatus('failed', 'Test error');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.status).toBe('failed');
        expect(result.value.errorMessage).toBe('Test error');
        expect(result.value.completedAt).not.toBe(null);
      }
    });
  });

  describe('withAiResponse', () => {
    it('should set AI response', () => {
      const jobResult = ProcessingJob.create(
        {
          videoId: 'video-123',
          clipInstructions: 'Test instructions',
        },
        generateId
      );

      expect(jobResult.success).toBe(true);
      if (!jobResult.success) return;

      const aiResponse = JSON.stringify({ clips: [] });
      const updated = jobResult.value.withAiResponse(aiResponse);
      expect(updated.aiResponse).toBe(aiResponse);
    });
  });
});
