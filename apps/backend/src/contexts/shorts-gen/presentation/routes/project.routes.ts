import { prisma } from '@shared/infrastructure/database/connection.js';
import { NotFoundError, ValidationError } from '@shorts-gen/application/errors/errors.js';
import {
  type CreateProjectInput,
  CreateProjectUseCase,
} from '@shorts-gen/application/usecases/create-project.usecase.js';
import { ShortsPlanningRepository } from '@shorts-gen/infrastructure/repositories/planning.repository.js';
import { ShortsProjectRepository } from '@shorts-gen/infrastructure/repositories/project.repository.js';
import { ShortsSceneRepository } from '@shorts-gen/infrastructure/repositories/scene.repository.js';
import { ShortsScriptRepository } from '@shorts-gen/infrastructure/repositories/script.repository.js';
import { type Router as ExpressRouter, Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router: ExpressRouter = Router();

// Initialize repositories
const projectRepository = new ShortsProjectRepository(prisma);
const planningRepository = new ShortsPlanningRepository(prisma);
const scriptRepository = new ShortsScriptRepository(prisma);
const sceneRepository = new ShortsSceneRepository(prisma);

// Initialize use cases
const createProjectUseCase = new CreateProjectUseCase({
  projectRepository,
  generateId: () => uuidv4(),
});

/**
 * Request body for creating a project
 */
interface CreateProjectRequest {
  title: string;
  aspectRatio?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
}

/**
 * Request body for updating a project
 */
interface UpdateProjectRequest {
  title?: string;
  aspectRatio?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
}

/**
 * Query parameters for listing projects
 */
interface ListProjectsQuery {
  page?: string;
  limit?: string;
  title?: string;
}

/**
 * POST /api/shorts-gen/projects
 * Create a new shorts generation project
 */
router.post('/', async (req, res, next) => {
  try {
    const body = req.body as CreateProjectRequest;

    if (!body.title) {
      throw new ValidationError('Title is required');
    }

    const input: CreateProjectInput = {
      title: body.title,
      aspectRatio: body.aspectRatio,
      resolutionWidth: body.resolutionWidth,
      resolutionHeight: body.resolutionHeight,
    };

    const result = await createProjectUseCase.execute(input);
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/projects
 * Get paginated list of projects
 */
router.get('/', async (req, res, next) => {
  try {
    const query = req.query as ListProjectsQuery;
    const page = query.page ? Number.parseInt(query.page, 10) : 1;
    const limit = query.limit ? Number.parseInt(query.limit, 10) : 20;
    const titleFilter = query.title;

    if (page < 1 || limit < 1 || limit > 100) {
      throw new ValidationError('Invalid pagination parameters');
    }

    const result = await projectRepository.findMany({
      page,
      limit,
      titleFilter,
    });

    res.json({
      projects: result.projects.map((p) => ({
        id: p.id,
        title: p.title,
        aspectRatio: p.aspectRatio,
        resolutionWidth: p.resolutionWidth,
        resolutionHeight: p.resolutionHeight,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
      })),
      total: result.total,
      page,
      limit,
      totalPages: Math.ceil(result.total / limit),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/shorts-gen/projects/:projectId
 * Get project details with related data
 */
router.get('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const project = await projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // Get related data
    const [planning, script] = await Promise.all([
      planningRepository.findByProjectId(projectId),
      scriptRepository.findByProjectId(projectId),
    ]);

    // Get scenes if script exists
    let scenes = null;
    if (script) {
      const sceneList = await sceneRepository.findByScriptId(script.id);
      scenes = sceneList.map((s) => ({
        id: s.id,
        order: s.order,
        summary: s.summary,
        visualType: s.visualType,
        voiceText: s.voiceText,
        subtitles: s.subtitles,
        silenceDurationMs: s.silenceDurationMs,
        stockVideoKey: s.stockVideoKey,
        solidColor: s.solidColor,
        imagePrompt: s.imagePrompt,
        imageStyleHint: s.imageStyleHint,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      }));
    }

    res.json({
      id: project.id,
      title: project.title,
      aspectRatio: project.aspectRatio,
      resolutionWidth: project.resolutionWidth,
      resolutionHeight: project.resolutionHeight,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
      planning: planning
        ? {
            id: planning.id,
            content: planning.content,
            version: planning.version,
            createdAt: planning.createdAt,
            updatedAt: planning.updatedAt,
          }
        : null,
      script: script
        ? {
            id: script.id,
            planningId: script.planningId,
            version: script.version,
            createdAt: script.createdAt,
            updatedAt: script.updatedAt,
            scenes,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PATCH /api/shorts-gen/projects/:projectId
 * Update project metadata
 */
router.patch('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const body = req.body as UpdateProjectRequest;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const project = await projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    let updatedProject = project;

    // Apply updates
    if (body.title !== undefined) {
      const result = updatedProject.withTitle(body.title);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedProject = result.value;
    }

    if (body.aspectRatio !== undefined) {
      const result = updatedProject.withAspectRatio(body.aspectRatio);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedProject = result.value;
    }

    if (body.resolutionWidth !== undefined && body.resolutionHeight !== undefined) {
      const result = updatedProject.withResolution(body.resolutionWidth, body.resolutionHeight);
      if (!result.success) {
        throw new ValidationError(result.error.message);
      }
      updatedProject = result.value;
    }

    // Save updates
    await projectRepository.save(updatedProject);

    res.json({
      id: updatedProject.id,
      title: updatedProject.title,
      aspectRatio: updatedProject.aspectRatio,
      resolutionWidth: updatedProject.resolutionWidth,
      resolutionHeight: updatedProject.resolutionHeight,
      createdAt: updatedProject.createdAt,
      updatedAt: updatedProject.updatedAt,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/shorts-gen/projects/:projectId
 * Delete a project and all related data
 */
router.delete('/:projectId', async (req, res, next) => {
  try {
    const { projectId } = req.params;

    if (!projectId) {
      throw new ValidationError('Project ID is required');
    }

    const project = await projectRepository.findById(projectId);

    if (!project) {
      throw new NotFoundError('Project', projectId);
    }

    // Delete related data in order (due to foreign key constraints)
    // 1. Delete scenes (via script)
    const script = await scriptRepository.findByProjectId(projectId);
    if (script) {
      await sceneRepository.deleteByScriptId(script.id);
    }

    // 2. Delete script
    await scriptRepository.deleteByProjectId(projectId);

    // 3. Delete planning
    await planningRepository.deleteByProjectId(projectId);

    // 4. Delete project
    await projectRepository.delete(projectId);

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
