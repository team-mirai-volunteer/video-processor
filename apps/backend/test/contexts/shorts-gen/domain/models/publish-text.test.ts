import { ShortsPublishText } from '@shorts-gen/domain/models/publish-text.js';
import { describe, expect, it } from 'vitest';

describe('ShortsPublishText', () => {
  const generateId = () => 'publish-text-id-123';

  describe('create', () => {
    it('should create a ShortsPublishText with valid params', () => {
      const result = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'AIとは何か？3分でわかる解説',
          description: 'このショート動画では、AIの基本について解説します。\n#AI #人工知能 #解説',
        },
        generateId
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value.id).toBe('publish-text-id-123');
        expect(result.value.projectId).toBe('project-123');
        expect(result.value.title).toBe('AIとは何か？3分でわかる解説');
        expect(result.value.description).toBe(
          'このショート動画では、AIの基本について解説します。\n#AI #人工知能 #解説'
        );
      }
    });

    it('should return error for empty projectId', () => {
      const result = ShortsPublishText.create(
        { projectId: '', title: 'Title', description: 'Description' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for whitespace-only projectId', () => {
      const result = ShortsPublishText.create(
        { projectId: '   ', title: 'Title', description: 'Description' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_PROJECT_ID');
      }
    });

    it('should return error for empty title', () => {
      const result = ShortsPublishText.create(
        { projectId: 'project-123', title: '', description: 'Description' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TITLE');
      }
    });

    it('should return error for whitespace-only title', () => {
      const result = ShortsPublishText.create(
        { projectId: 'project-123', title: '   ', description: 'Description' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_TITLE');
      }
    });

    it('should return error for empty description', () => {
      const result = ShortsPublishText.create(
        { projectId: 'project-123', title: 'Title', description: '' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DESCRIPTION');
      }
    });

    it('should return error for whitespace-only description', () => {
      const result = ShortsPublishText.create(
        { projectId: 'project-123', title: 'Title', description: '   ' },
        generateId
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('INVALID_DESCRIPTION');
      }
    });
  });

  describe('fromProps', () => {
    it('should reconstruct a ShortsPublishText from props', () => {
      const now = new Date();
      const publishText = ShortsPublishText.fromProps({
        id: 'existing-id',
        projectId: 'project-123',
        title: 'Existing Title',
        description: 'Existing Description',
        createdAt: now,
        updatedAt: now,
      });

      expect(publishText.id).toBe('existing-id');
      expect(publishText.title).toBe('Existing Title');
      expect(publishText.description).toBe('Existing Description');
    });
  });

  describe('withTitle', () => {
    it('should update title', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Original Title',
          description: 'Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withTitle('Updated Title');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.title).toBe('Updated Title');
      }
    });

    it('should return error for empty title', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Original Title',
          description: 'Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withTitle('');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_TITLE');
      }
    });

    it('should trim whitespace from title', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Original Title',
          description: 'Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withTitle('  Trimmed Title  ');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.title).toBe('Trimmed Title');
      }
    });
  });

  describe('withDescription', () => {
    it('should update description', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Title',
          description: 'Original Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withDescription('Updated Description');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.description).toBe('Updated Description');
      }
    });

    it('should return error for empty description', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Title',
          description: 'Original Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withDescription('');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_DESCRIPTION');
      }
    });

    it('should trim whitespace from description', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Title',
          description: 'Original Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withDescription('  Trimmed Description  ');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.description).toBe('Trimmed Description');
      }
    });
  });

  describe('withContent', () => {
    it('should update both title and description', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Original Title',
          description: 'Original Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withContent('New Title', 'New Description');
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.title).toBe('New Title');
        expect(updatedResult.value.description).toBe('New Description');
      }
    });

    it('should return error for empty title', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Original Title',
          description: 'Original Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withContent('', 'Description');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_TITLE');
      }
    });

    it('should return error for empty description', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Original Title',
          description: 'Original Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withContent('Title', '');
      expect(updatedResult.success).toBe(false);
      if (!updatedResult.success) {
        expect(updatedResult.error.type).toBe('INVALID_DESCRIPTION');
      }
    });

    it('should trim whitespace from both fields', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Original Title',
          description: 'Original Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const updatedResult = publishTextResult.value.withContent(
        '  New Title  ',
        '  New Description  '
      );
      expect(updatedResult.success).toBe(true);
      if (updatedResult.success) {
        expect(updatedResult.value.title).toBe('New Title');
        expect(updatedResult.value.description).toBe('New Description');
      }
    });
  });

  describe('toProps', () => {
    it('should convert to plain object', () => {
      const publishTextResult = ShortsPublishText.create(
        {
          projectId: 'project-123',
          title: 'Test Title',
          description: 'Test Description',
        },
        generateId
      );
      expect(publishTextResult.success).toBe(true);
      if (!publishTextResult.success) return;

      const props = publishTextResult.value.toProps();
      expect(props.id).toBe('publish-text-id-123');
      expect(props.projectId).toBe('project-123');
      expect(props.title).toBe('Test Title');
      expect(props.description).toBe('Test Description');
      expect(props.createdAt).toBeInstanceOf(Date);
      expect(props.updatedAt).toBeInstanceOf(Date);
    });
  });
});
