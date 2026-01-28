import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { describe, expect, it } from 'vitest';

describe('ShortsScript', () => {
  const generateId = () => 'script-id-123';

  describe('create', () => {
    it('should create a ShortsScript with valid params', () => {
      const result = ShortsScript.create(
        {
          projectId: 'project-123',
          planningId: 'planning-123',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('script-id-123');
        expect(result.value.projectId).toBe('project-123');
        expect(result.value.planningId).toBe('planning-123');
        expect(result.value.version).toBe(1);
      }
    });

    it('should return error for empty projectId', () => {
      const result = ShortsScript.create({ projectId: '', planningId: 'planning-123' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for whitespace-only projectId', () => {
      const result = ShortsScript.create(
        { projectId: '   ', planningId: 'planning-123' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for empty planningId', () => {
      const result = ShortsScript.create({ projectId: 'project-123', planningId: '' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PLANNING_ID');
      }
    });

    it('should return error for whitespace-only planningId', () => {
      const result = ShortsScript.create(
        { projectId: 'project-123', planningId: '   ' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PLANNING_ID');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsScript from props', () => {
      const now = new Date();
      const script = ShortsScript.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        planningId: 'planning-123',
        version: 5,
        createdAt: now,
        updatedAt: now,
      });

      expect(script.id).toBe('existing-id');
      expect(script.projectId).toBe('project-123');
      expect(script.planningId).toBe('planning-123');
      expect(script.version).toBe(5);
    });
  });

  describe('withNewVersion', () => {
    it('should increment version', () => {
      const scriptResult = ShortsScript.create(
        { projectId: 'project-123', planningId: 'planning-123' },
        generateId
      );
      expect(scriptResult.success).toBe(true);
      if (!scriptResult.success) return;

      const updated = scriptResult.value.withNewVersion();
      expect(updated.version).toBe(2);
    });

    it('should preserve other properties', () => {
      const scriptResult = ShortsScript.create(
        { projectId: 'project-123', planningId: 'planning-123' },
        generateId
      );
      expect(scriptResult.success).toBe(true);
      if (!scriptResult.success) return;

      const updated = scriptResult.value.withNewVersion();
      expect(updated.id).toBe(scriptResult.value.id);
      expect(updated.projectId).toBe(scriptResult.value.projectId);
      expect(updated.planningId).toBe(scriptResult.value.planningId);
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const scriptResult = ShortsScript.create(
        { projectId: 'project-123', planningId: 'planning-123' },
        generateId
      );
      expect(scriptResult.success).toBe(true);
      if (!scriptResult.success) return;

      const props = scriptResult.value.toProps();
      expect(props.id).toBe('script-id-123');
      expect(props.projectId).toBe('project-123');
      expect(props.planningId).toBe('planning-123');
      expect(props.version).toBe(1);
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
