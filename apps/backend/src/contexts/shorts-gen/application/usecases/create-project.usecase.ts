import type { ShortsProjectRepositoryGateway } from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import { ShortsProject } from '@shorts-gen/domain/models/project.js';
import { ValidationError } from '../errors/errors.js';

export interface CreateProjectInput {
  title: string;
  aspectRatio?: string;
  resolutionWidth?: number;
  resolutionHeight?: number;
}

export interface CreateProjectOutput {
  id: string;
  title: string;
  aspectRatio: string;
  resolutionWidth: number;
  resolutionHeight: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateProjectUseCaseDeps {
  projectRepository: ShortsProjectRepositoryGateway;
  generateId: () => string;
}

export class CreateProjectUseCase {
  private readonly projectRepository: ShortsProjectRepositoryGateway;
  private readonly generateId: () => string;

  constructor(deps: CreateProjectUseCaseDeps) {
    this.projectRepository = deps.projectRepository;
    this.generateId = deps.generateId;
  }

  async execute(input: CreateProjectInput): Promise<CreateProjectOutput> {
    // Create project domain object
    const projectResult = ShortsProject.create(
      {
        title: input.title,
        aspectRatio: input.aspectRatio,
        resolutionWidth: input.resolutionWidth,
        resolutionHeight: input.resolutionHeight,
      },
      this.generateId
    );

    if (!projectResult.success) {
      throw new ValidationError(projectResult.error.message);
    }

    const project = projectResult.value;

    // Save project
    await this.projectRepository.save(project);

    return {
      id: project.id,
      title: project.title,
      aspectRatio: project.aspectRatio,
      resolutionWidth: project.resolutionWidth,
      resolutionHeight: project.resolutionHeight,
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    };
  }
}
