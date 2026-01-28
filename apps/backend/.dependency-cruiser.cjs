/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // === Bounded Context isolation rules ===
    {
      name: 'context-isolation',
      severity: 'error',
      comment: 'Bounded contexts should not depend on each other directly',
      from: { path: '^src/contexts/clip-video' },
      to: {
        path: '^src/contexts/',
        pathNot: ['^src/contexts/clip-video', '^src/contexts/shared'],
      },
    },
    {
      name: 'shared-context-independence',
      severity: 'error',
      comment: 'Shared context must not depend on specific bounded contexts',
      from: { path: '^src/contexts/shared' },
      to: {
        path: '^src/contexts/',
        pathNot: '^src/contexts/shared',
      },
    },

    // === DDD layer rules for clip-video context ===
    {
      name: 'clip-video-domain-isolation',
      severity: 'error',
      comment: 'Domain layer must not depend on other layers',
      from: { path: '^src/contexts/clip-video/domain' },
      to: {
        path: '^src/contexts/clip-video/(application|infrastructure|presentation)',
      },
    },
    {
      name: 'clip-video-application-cannot-depend-on-infra',
      severity: 'error',
      comment: 'Application layer must not depend on infrastructure layer',
      from: { path: '^src/contexts/clip-video/application' },
      to: {
        path: '^src/contexts/clip-video/infrastructure',
      },
    },
    {
      name: 'clip-video-application-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Application layer must not depend on presentation layer',
      from: { path: '^src/contexts/clip-video/application' },
      to: {
        path: '^src/contexts/clip-video/presentation',
      },
    },
    {
      name: 'clip-video-infrastructure-cannot-depend-on-application',
      severity: 'error',
      comment: 'Infrastructure layer must not depend on application layer',
      from: { path: '^src/contexts/clip-video/infrastructure' },
      to: {
        path: '^src/contexts/clip-video/application',
      },
    },
    {
      name: 'clip-video-infrastructure-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Infrastructure layer must not depend on presentation layer',
      from: { path: '^src/contexts/clip-video/infrastructure' },
      to: {
        path: '^src/contexts/clip-video/presentation',
      },
    },

    // === DDD layer rules for shared context ===
    {
      name: 'shared-domain-isolation',
      severity: 'error',
      comment: 'Shared domain must not depend on other layers',
      from: { path: '^src/contexts/shared/domain' },
      to: {
        path: '^src/contexts/shared/(infrastructure|presentation)',
      },
    },

    // Common anti-patterns
    {
      name: 'no-circular',
      severity: 'error',
      comment: 'Circular dependencies are not allowed',
      from: {},
      to: { circular: true },
    },
  ],
  options: {
    doNotFollow: {
      path: 'node_modules',
    },
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: './tsconfig.json',
    },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default'],
    },
    reporterOptions: {
      text: {
        highlightFocused: true,
      },
    },
  },
};
