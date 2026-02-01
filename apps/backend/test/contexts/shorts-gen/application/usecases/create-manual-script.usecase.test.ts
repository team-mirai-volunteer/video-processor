import { NotFoundError, ValidationError } from '@shorts-gen/application/errors/errors.js';
import {
  CreateManualScriptUseCase,
  type CreateManualScriptUseCaseDeps,
} from '@shorts-gen/application/usecases/create-manual-script.usecase.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type { ShortsSceneRepositoryGateway } from '@shorts-gen/domain/gateways/scene-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ShortsPlanning } from '@shorts-gen/domain/models/planning.js';
import { ShortsScript } from '@shorts-gen/domain/models/script.js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('CreateManualScriptUseCase', () => {
  let useCase: CreateManualScriptUseCase;
  let planningRepository: ShortsPlanningRepositoryGateway;
  let scriptRepository: ShortsScriptRepositoryGateway;
  let sceneRepository: ShortsSceneRepositoryGateway;
  let idCounter: number;

  const createDeps = (): CreateManualScriptUseCaseDeps => ({
    planningRepository,
    scriptRepository,
    sceneRepository,
    generateId: () => `script-${++idCounter}`,
  });

  const createMockPlanning = (projectId: string, planningId: string) => {
    return ShortsPlanning.fromProps({
      id: planningId,
      projectId,
      content: '# 企画書\n\nテスト企画書の内容',
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  const createMockScript = (scriptId: string, projectId: string, planningId: string) => {
    return ShortsScript.fromProps({
      id: scriptId,
      projectId,
      planningId,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  };

  beforeEach(() => {
    idCounter = 0;

    // Mock PlanningRepository
    planningRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      findAllVersionsByProjectId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    // Mock ScriptRepository
    scriptRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByProjectId: vi.fn().mockResolvedValue(null),
      findByPlanningId: vi.fn().mockResolvedValue([]),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByProjectId: vi.fn().mockResolvedValue(undefined),
    };

    // Mock SceneRepository
    sceneRepository = {
      save: vi.fn().mockResolvedValue(undefined),
      saveMany: vi.fn().mockResolvedValue(undefined),
      findById: vi.fn().mockResolvedValue(null),
      findByScriptId: vi.fn().mockResolvedValue([]),
      findByScriptIdAndOrder: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(undefined),
      deleteByScriptId: vi.fn().mockResolvedValue(undefined),
      countByScriptId: vi.fn().mockResolvedValue(0),
    };

    useCase = new CreateManualScriptUseCase(createDeps());
  });

  describe('execute', () => {
    it('should create a new manual script successfully', async () => {
      const mockPlanning = createMockPlanning('project-1', 'planning-1');
      vi.mocked(planningRepository.findById).mockResolvedValue(mockPlanning);

      const input = {
        projectId: 'project-1',
        planningId: 'planning-1',
      };

      const result = await useCase.execute(input);

      expect(result.scriptId).toBe('script-1');
      expect(result.projectId).toBe('project-1');
      expect(result.planningId).toBe('planning-1');
      expect(result.version).toBe(1);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);

      expect(scriptRepository.save).toHaveBeenCalledTimes(1);
      expect(sceneRepository.deleteByScriptId).not.toHaveBeenCalled();
      expect(scriptRepository.delete).not.toHaveBeenCalled();
    });

    it('should delete existing script and its scenes when recreating', async () => {
      const mockPlanning = createMockPlanning('project-1', 'planning-1');
      const existingScript = createMockScript('existing-script-1', 'project-1', 'planning-1');

      vi.mocked(planningRepository.findById).mockResolvedValue(mockPlanning);
      vi.mocked(scriptRepository.findByProjectId).mockResolvedValue(existingScript);

      const input = {
        projectId: 'project-1',
        planningId: 'planning-1',
      };

      const result = await useCase.execute(input);

      // Verify old script and scenes were deleted
      expect(sceneRepository.deleteByScriptId).toHaveBeenCalledWith('existing-script-1');
      expect(scriptRepository.delete).toHaveBeenCalledWith('existing-script-1');

      // Verify new script was created
      expect(scriptRepository.save).toHaveBeenCalledTimes(1);
      expect(result.scriptId).toBe('script-1');
    });

    it('should throw NotFoundError when planning does not exist', async () => {
      vi.mocked(planningRepository.findById).mockResolvedValue(null);

      const input = {
        projectId: 'project-1',
        planningId: 'non-existent-planning',
      };

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
      expect(scriptRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ValidationError when planning belongs to different project', async () => {
      const mockPlanning = createMockPlanning('project-2', 'planning-1'); // Different project
      vi.mocked(planningRepository.findById).mockResolvedValue(mockPlanning);

      const input = {
        projectId: 'project-1', // Trying to use planning from project-2
        planningId: 'planning-1',
      };

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
      expect(scriptRepository.save).not.toHaveBeenCalled();
    });

    it('should throw ValidationError for empty projectId', async () => {
      const input = {
        projectId: '',
        planningId: 'planning-1',
      };

      // This should fail at ShortsScript.create level
      const mockPlanning = createMockPlanning('', 'planning-1');
      vi.mocked(planningRepository.findById).mockResolvedValue(mockPlanning);

      await expect(useCase.execute(input)).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty planningId', async () => {
      const input = {
        projectId: 'project-1',
        planningId: '',
      };

      // findById with empty string should return null
      vi.mocked(planningRepository.findById).mockResolvedValue(null);

      await expect(useCase.execute(input)).rejects.toThrow(NotFoundError);
    });

    it('should preserve the correct order of operations', async () => {
      const mockPlanning = createMockPlanning('project-1', 'planning-1');
      const existingScript = createMockScript('existing-script-1', 'project-1', 'planning-1');

      vi.mocked(planningRepository.findById).mockResolvedValue(mockPlanning);
      vi.mocked(scriptRepository.findByProjectId).mockResolvedValue(existingScript);

      const callOrder: string[] = [];
      vi.mocked(sceneRepository.deleteByScriptId).mockImplementation(async () => {
        callOrder.push('deleteScenes');
      });
      vi.mocked(scriptRepository.delete).mockImplementation(async () => {
        callOrder.push('deleteScript');
      });
      vi.mocked(scriptRepository.save).mockImplementation(async () => {
        callOrder.push('saveScript');
      });

      await useCase.execute({
        projectId: 'project-1',
        planningId: 'planning-1',
      });

      // Scenes should be deleted before script, and new script saved last
      expect(callOrder).toEqual(['deleteScenes', 'deleteScript', 'saveScript']);
    });

    it('should create script with version 1', async () => {
      const mockPlanning = createMockPlanning('project-1', 'planning-1');
      vi.mocked(planningRepository.findById).mockResolvedValue(mockPlanning);

      const result = await useCase.execute({
        projectId: 'project-1',
        planningId: 'planning-1',
      });

      expect(result.version).toBe(1);
    });

    it('should correctly pass projectId and planningId to new script', async () => {
      const mockPlanning = createMockPlanning('project-abc', 'planning-xyz');
      vi.mocked(planningRepository.findById).mockResolvedValue(mockPlanning);

      const result = await useCase.execute({
        projectId: 'project-abc',
        planningId: 'planning-xyz',
      });

      expect(result.projectId).toBe('project-abc');
      expect(result.planningId).toBe('planning-xyz');

      // Verify the saved script has correct properties
      expect(scriptRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 'project-abc',
          planningId: 'planning-xyz',
        })
      );
    });
  });
});
