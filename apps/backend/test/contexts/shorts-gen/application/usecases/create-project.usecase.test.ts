import { ValidationError } from '@shorts-gen/application/errors/errors.js';
import { CreateProjectUseCase } from '@shorts-gen/application/usecases/create-project.usecase.js';
import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CreateProjectUseCase', () => {
  let useCase: CreateProjectUseCase;
  let projectRepository: ShortsProjectRepositoryGateway;
  let idCounter: number;

  beforeEach(() => {
    idCounter = 0;

    projectRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue({ projects: [], total: 0 }),
      delete: vi.fn().mockResolvedValue(undefined),
      exists: vi.fn().mockResolvedValue(false),
    };

    useCase = new CreateProjectUseCase({
      projectRepository,
      generateId: () => `project-${++idCounter}`,
    });
  });

  it('should create project with default values for valid input', async () => {
    const input = {
      title: 'Test Project',
    };

    const result = await useCase.execute(input);

    expect(result.id).toBe('project-1');
    expect(result.title).toBe('Test Project');
    expect(result.aspectRatio).toBe('9:16');
    expect(result.resolutionWidth).toBe(1080);
    expect(result.resolutionHeight).toBe(1920);
    expect(result.createdAt).toBeInstanceOf(Date);
    expect(result.updatedAt).toBeInstanceOf(Date);

    expect(projectRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should create project with custom values', async () => {
    const input = {
      title: 'Custom Project',
      aspectRatio: '16:9',
      resolutionWidth: 1920,
      resolutionHeight: 1080,
    };

    const result = await useCase.execute(input);

    expect(result.id).toBe('project-1');
    expect(result.title).toBe('Custom Project');
    expect(result.aspectRatio).toBe('16:9');
    expect(result.resolutionWidth).toBe(1920);
    expect(result.resolutionHeight).toBe(1080);

    expect(projectRepository.save).toHaveBeenCalledTimes(1);
  });

  it('should trim whitespace from title', async () => {
    const input = {
      title: '  Trimmed Title  ',
    };

    const result = await useCase.execute(input);

    expect(result.title).toBe('Trimmed Title');
  });

  it('should throw ValidationError for empty title', async () => {
    const input = {
      title: '',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(projectRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ValidationError for whitespace-only title', async () => {
    const input = {
      title: '   ',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(projectRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ValidationError for invalid aspect ratio', async () => {
    const input = {
      title: 'Test Project',
      aspectRatio: '3:2',
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(projectRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ValidationError for invalid resolution', async () => {
    const input = {
      title: 'Test Project',
      resolutionWidth: 0,
      resolutionHeight: 1080,
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(projectRepository.save).not.toHaveBeenCalled();
  });

  it('should throw ValidationError for resolution exceeding maximum', async () => {
    const input = {
      title: 'Test Project',
      resolutionWidth: 5000,
      resolutionHeight: 1080,
    };

    await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    expect(projectRepository.save).not.toHaveBeenCalled();
  });

  it('should support all valid aspect ratios', async () => {
    const validAspectRatios = ['9:16', '16:9', '1:1', '4:5'];

    for (const aspectRatio of validAspectRatios) {
      const result = await useCase.execute({
        title: `Project ${aspectRatio}`,
        aspectRatio,
      });

      expect(result.aspectRatio).toBe(aspectRatio);
    }

    expect(projectRepository.save).toHaveBeenCalledTimes(validAspectRatios.length);
  });
});
