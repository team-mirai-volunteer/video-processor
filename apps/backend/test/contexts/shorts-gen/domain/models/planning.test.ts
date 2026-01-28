import { ShortsPlanning } from '@shorts-gen/domain/models/planning.js';
import { describe, expect, it } from 'vitest';

describe('ShortsPlanning', () => {
  const generateId = () => 'planning-id-123';

  describe('create', () => {
    it('should create a ShortsPlanning with valid params', () => {
      const result = ShortsPlanning.create(
        {
          projectId: 'project-123',
          content: '# 企画書\n\n## 概要\nAIについて解説する動画',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('planning-id-123');
        expect(result.value.projectId).toBe('project-123');
        expect(result.value.content).toBe('# 企画書\n\n## 概要\nAIについて解説する動画');
        expect(result.value.version).toBe(1);
      }
    });

    it('should return error for empty projectId', () => {
      const result = ShortsPlanning.create({ projectId: '', content: 'Content' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for whitespace-only projectId', () => {
      const result = ShortsPlanning.create({ projectId: '   ', content: 'Content' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for empty content', () => {
      const result = ShortsPlanning.create({ projectId: 'project-123', content: '' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_CONTENT');
      }
    });

    it('should return error for whitespace-only content', () => {
      const result = ShortsPlanning.create(
        { projectId: 'project-123', content: '   ' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_CONTENT');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsPlanning from props', () => {
      const now = new Date();
      const planning = ShortsPlanning.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        content: '# 企画書',
        version: 3,
        createdAt: now,
        updatedAt: now,
      });

      expect(planning.id).toBe('existing-id');
      expect(planning.projectId).toBe('project-123');
      expect(planning.version).toBe(3);
    });
  });

  describe('withContent', () => {
    it('should update content and increment version', () => {
      const planningResult = ShortsPlanning.create(
        { projectId: 'project-123', content: 'Original content' },
        generateId
      );
      expect(planningResult.success).toBe(true);
      if (!planningResult.success) return;

      const updatedResult = planningResult.value.withContent('Updated content');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.content).toBe('Updated content');
        expect(updatedResult.value.version).toBe(2);
      }
    });

    it('should return error for empty content', () => {
      const planningResult = ShortsPlanning.create(
        { projectId: 'project-123', content: 'Original content' },
        generateId
      );
      expect(planningResult.success).toBe(true);
      if (!planningResult.success) return;

      const updatedResult = planningResult.value.withContent('');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_CONTENT');
      }
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const planningResult = ShortsPlanning.create(
        { projectId: 'project-123', content: '# Planning' },
        generateId
      );
      expect(planningResult.success).toBe(true);
      if (!planningResult.success) return;

      const props = planningResult.value.toProps();
      expect(props.id).toBe('planning-id-123');
      expect(props.projectId).toBe('project-123');
      expect(props.content).toBe('# Planning');
      expect(props.version).toBe(1);
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
