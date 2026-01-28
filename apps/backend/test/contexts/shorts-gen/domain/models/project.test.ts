import { ShortsProject } from '@shorts-gen/domain/models/project.js';
import { describe, expect, it } from 'vitest';

describe('ShortsProject', () => {
  const generateId = () => 'project-id-123';

  describe('create', () => {
    it('should create a ShortsProject with valid title', () => {
      const result = ShortsProject.create({ title: 'AI解説動画' }, generateId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('project-id-123');
        expect(result.value.title).toBe('AI解説動画');
        expect(result.value.aspectRatio).toBe('9:16');
        expect(result.value.resolutionWidth).toBe(1080);
        expect(result.value.resolutionHeight).toBe(1920);
      }
    });

    it('should create a ShortsProject with custom aspect ratio', () => {
      const result = ShortsProject.create({ title: 'Test', aspectRatio: '16:9' }, generateId);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.aspectRatio).toBe('16:9');
      }
    });

    it('should create a ShortsProject with custom resolution', () => {
      const result = ShortsProject.create(
        { title: 'Test', resolutionWidth: 1920, resolutionHeight: 1080 },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.resolutionWidth).toBe(1920);
        expect(result.value.resolutionHeight).toBe(1080);
      }
    });

    it('should return error for empty title', () => {
      const result = ShortsProject.create({ title: '' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TITLE');
      }
    });

    it('should return error for whitespace-only title', () => {
      const result = ShortsProject.create({ title: '   ' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TITLE');
      }
    });

    it('should return error for invalid aspect ratio', () => {
      const result = ShortsProject.create({ title: 'Test', aspectRatio: '3:2' }, generateId);

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_ASPECT_RATIO');
      }
    });

    it('should return error for invalid resolution', () => {
      const result = ShortsProject.create(
        { title: 'Test', resolutionWidth: 0, resolutionHeight: 1080 },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_RESOLUTION');
      }
    });

    it('should return error for resolution exceeding maximum', () => {
      const result = ShortsProject.create(
        { title: 'Test', resolutionWidth: 5000, resolutionHeight: 1080 },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_RESOLUTION');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsProject from props', () => {
      const now = new Date();
      const project = ShortsProject.fromProps({
        id: 'existing-id',
        title: 'Existing Project',
        aspectRatio: '1:1',
        resolutionWidth: 1080,
        resolutionHeight: 1080,
        createdAt: now,
        updatedAt: now,
      });

      expect(project.id).toBe('existing-id');
      expect(project.title).toBe('Existing Project');
      expect(project.aspectRatio).toBe('1:1');
    });
  });

  describe('withTitle', () => {
    it('should update title', () => {
      const projectResult = ShortsProject.create({ title: 'Original' }, generateId);
      expect(projectResult.success).toBe(true);
      if (!projectResult.success) return;

      const updatedResult = projectResult.value.withTitle('Updated Title');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.title).toBe('Updated Title');
      }
    });

    it('should return error for empty title', () => {
      const projectResult = ShortsProject.create({ title: 'Original' }, generateId);
      expect(projectResult.success).toBe(true);
      if (!projectResult.success) return;

      const updatedResult = projectResult.value.withTitle('');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_TITLE');
      }
    });
  });

  describe('withAspectRatio', () => {
    it('should update aspect ratio', () => {
      const projectResult = ShortsProject.create({ title: 'Test' }, generateId);
      expect(projectResult.success).toBe(true);
      if (!projectResult.success) return;

      const updatedResult = projectResult.value.withAspectRatio('16:9');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.aspectRatio).toBe('16:9');
      }
    });

    it('should return error for invalid aspect ratio', () => {
      const projectResult = ShortsProject.create({ title: 'Test' }, generateId);
      expect(projectResult.success).toBe(true);
      if (!projectResult.success) return;

      const updatedResult = projectResult.value.withAspectRatio('invalid');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_ASPECT_RATIO');
      }
    });
  });

  describe('withResolution', () => {
    it('should update resolution', () => {
      const projectResult = ShortsProject.create({ title: 'Test' }, generateId);
      expect(projectResult.success).toBe(true);
      if (!projectResult.success) return;

      const updatedResult = projectResult.value.withResolution(1920, 1080);
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.resolutionWidth).toBe(1920);
        expect(updatedResult.value.resolutionHeight).toBe(1080);
      }
    });

    it('should return error for invalid resolution', () => {
      const projectResult = ShortsProject.create({ title: 'Test' }, generateId);
      expect(projectResult.success).toBe(true);
      if (!projectResult.success) return;

      const updatedResult = projectResult.value.withResolution(-100, 1080);
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_RESOLUTION');
      }
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const projectResult = ShortsProject.create({ title: 'Test Project' }, generateId);
      expect(projectResult.success).toBe(true);
      if (!projectResult.success) return;

      const props = projectResult.value.toProps();
      expect(props.id).toBe('project-id-123');
      expect(props.title).toBe('Test Project');
      expect(props.aspectRatio).toBe('9:16');
      expect(props.resolutionWidth).toBe(1080);
      expect(props.resolutionHeight).toBe(1920);
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
