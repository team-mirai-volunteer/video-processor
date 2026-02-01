import { ShortsReferenceCharacter } from '@shorts-gen/domain/models/reference-character.js';
import { describe, expect, it } from 'vitest';

describe('ShortsReferenceCharacter', () => {
  const generateId = () => 'ref-char-id-123';

  describe('create', () => {
    it('should create a ShortsReferenceCharacter with valid params', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'A friendly robot character',
          imageUrl: 'https://example.com/robot.png',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('ref-char-id-123');
        expect(result.value.projectId).toBe('project-1');
        expect(result.value.description).toBe('A friendly robot character');
        expect(result.value.imageUrl).toBe('https://example.com/robot.png');
        expect(result.value.order).toBe(0);
        expect(result.value.createdAt).toBeInstanceOf(Date);
        expect(result.value.updatedAt).toBeInstanceOf(Date);
      }
    });

    it('should create with custom order', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Second character',
          imageUrl: 'https://example.com/char2.png',
          order: 2,
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.order).toBe(2);
      }
    });

    it('should trim whitespace from fields', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: '  project-1  ',
          description: '  description with spaces  ',
          imageUrl: '  https://example.com/img.png  ',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.projectId).toBe('project-1');
        expect(result.value.description).toBe('description with spaces');
        expect(result.value.imageUrl).toBe('https://example.com/img.png');
      }
    });

    it('should return error for empty projectId', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: '',
          description: 'Test description',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
        expect(result.error.message).toBe('Project ID cannot be empty');
      }
    });

    it('should return error for whitespace-only projectId', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: '   ',
          description: 'Test description',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for empty description', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: '',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DESCRIPTION');
        expect(result.error.message).toBe('Description cannot be empty');
      }
    });

    it('should return error for whitespace-only description', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: '   ',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DESCRIPTION');
      }
    });

    it('should return error for empty imageUrl', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Test description',
          imageUrl: '',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_IMAGE_URL');
        expect(result.error.message).toBe('Image URL cannot be empty');
      }
    });

    it('should return error for whitespace-only imageUrl', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Test description',
          imageUrl: '   ',
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_IMAGE_URL');
      }
    });

    it('should return error for negative order', () => {
      const result = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Test description',
          imageUrl: 'https://example.com/img.png',
          order: -1,
        },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_ORDER');
        expect(result.error.message).toBe('Order must be 0 or greater');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsReferenceCharacter from props', () => {
      const now = new Date();
      const character = ShortsReferenceCharacter.fromProps({
        id: 'existing-id',
        projectId: 'project-1',
        description: 'Existing character',
        imageUrl: 'https://example.com/existing.png',
        order: 1,
        createdAt: now,
        updatedAt: now,
      });

      expect(character.id).toBe('existing-id');
      expect(character.projectId).toBe('project-1');
      expect(character.description).toBe('Existing character');
      expect(character.imageUrl).toBe('https://example.com/existing.png');
      expect(character.order).toBe(1);
      expect(character.createdAt).toBe(now);
      expect(character.updatedAt).toBe(now);
    });
  });

  describe('withDescription', () => {
    it('should update description', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Original description',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const updatedResult = charResult.value.withDescription('Updated description');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.description).toBe('Updated description');
        expect(updatedResult.value.id).toBe(charResult.value.id);
        expect(updatedResult.value.projectId).toBe(charResult.value.projectId);
        expect(updatedResult.value.updatedAt.getTime()).toBeGreaterThanOrEqual(
          charResult.value.updatedAt.getTime()
        );
      }
    });

    it('should trim description', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Original',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const updatedResult = charResult.value.withDescription('  trimmed  ');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.description).toBe('trimmed');
      }
    });

    it('should return error for empty description', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Original',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const updatedResult = charResult.value.withDescription('');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_DESCRIPTION');
      }
    });

    it('should return error for whitespace-only description', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Original',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const updatedResult = charResult.value.withDescription('   ');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_DESCRIPTION');
      }
    });
  });

  describe('withOrder', () => {
    it('should update order', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Test',
          imageUrl: 'https://example.com/img.png',
          order: 0,
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const updatedResult = charResult.value.withOrder(5);
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.order).toBe(5);
        expect(updatedResult.value.updatedAt.getTime()).toBeGreaterThanOrEqual(
          charResult.value.updatedAt.getTime()
        );
      }
    });

    it('should allow order of 0', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Test',
          imageUrl: 'https://example.com/img.png',
          order: 5,
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const updatedResult = charResult.value.withOrder(0);
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.order).toBe(0);
      }
    });

    it('should return error for negative order', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Test',
          imageUrl: 'https://example.com/img.png',
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const updatedResult = charResult.value.withOrder(-1);
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_ORDER');
        expect(updatedResult.error.message).toBe('Order must be 0 or greater');
      }
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const charResult = ShortsReferenceCharacter.create(
        {
          projectId: 'project-1',
          description: 'Test character',
          imageUrl: 'https://example.com/test.png',
          order: 2,
        },
        generateId
      );
      expect(charResult.success).toBe(true);
      if (!charResult.success) return;

      const props = charResult.value.toProps();
      expect(props.id).toBe('ref-char-id-123');
      expect(props.projectId).toBe('project-1');
      expect(props.description).toBe('Test character');
      expect(props.imageUrl).toBe('https://example.com/test.png');
      expect(props.order).toBe(2);
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
