import type { ShortsComposedVideoRepositoryGateway } from '@shorts-gen/domain/gateways/composed-video-repository.gateway.js';
import type { ShortsPlanningRepositoryGateway } from '@shorts-gen/domain/gateways/planning-repository.gateway.js';
import type {
  FindProjectsOptions,
  ShortsProjectRepositoryGateway,
} from '@shorts-gen/domain/gateways/project-repository.gateway.js';
import type { ShortsScriptRepositoryGateway } from '@shorts-gen/domain/gateways/script-repository.gateway.js';
import { ValidationError } from '../errors/errors.js';

export interface GetProjectSummariesInput {
  page: number;
  limit: number;
  titleFilter?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  aspectRatio: string;
  createdAt: Date;
  updatedAt: Date;
  hasPlan: boolean;
  hasScript: boolean;
  hasComposedVideo: boolean;
}

export interface GetProjectSummariesOutput {
  summaries: ProjectSummary[];
}

export interface GetProjectSummariesUseCaseDeps {
  projectRepository: ShortsProjectRepositoryGateway;
  planningRepository: ShortsPlanningRepositoryGateway;
  scriptRepository: ShortsScriptRepositoryGateway;
  composedVideoRepository: ShortsComposedVideoRepositoryGateway;
}

export class GetProjectSummariesUseCase {
  private readonly projectRepository: ShortsProjectRepositoryGateway;
  private readonly planningRepository: ShortsPlanningRepositoryGateway;
  private readonly scriptRepository: ShortsScriptRepositoryGateway;
  private readonly composedVideoRepository: ShortsComposedVideoRepositoryGateway;

  constructor(deps: GetProjectSummariesUseCaseDeps) {
    this.projectRepository = deps.projectRepository;
    this.planningRepository = deps.planningRepository;
    this.scriptRepository = deps.scriptRepository;
    this.composedVideoRepository = deps.composedVideoRepository;
  }

  async execute(input: GetProjectSummariesInput): Promise<GetProjectSummariesOutput> {
    if (input.page < 1 || input.limit < 1 || input.limit > 100) {
      throw new ValidationError('Invalid pagination parameters');
    }

    const options: FindProjectsOptions = {
      page: input.page,
      limit: input.limit,
      titleFilter: input.titleFilter,
    };

    const result = await this.projectRepository.findMany(options);

    const summaries = await Promise.all(
      result.projects.map(async (project) => {
        const [planning, script, composedVideo] = await Promise.all([
          this.planningRepository.findByProjectId(project.id),
          this.scriptRepository.findByProjectId(project.id),
          this.composedVideoRepository.findByProjectId(project.id),
        ]);

        return {
          id: project.id,
          title: project.title,
          aspectRatio: project.aspectRatio,
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          hasPlan: planning !== null,
          hasScript: script !== null,
          hasComposedVideo: composedVideo !== null,
        };
      })
    );

    return { summaries };
  }
}
