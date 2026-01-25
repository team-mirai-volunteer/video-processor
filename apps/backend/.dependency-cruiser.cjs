/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // Domain layer should not depend on any other layer
    {
      name: 'domain-cannot-depend-on-application',
      severity: 'error',
      comment: 'Domain layer must not depend on application layer (DDD violation)',
      from: { path: '^src/domain' },
      to: { path: '^src/application' },
    },
    {
      name: 'domain-cannot-depend-on-infrastructure',
      severity: 'error',
      comment: 'Domain layer must not depend on infrastructure layer (DDD violation)',
      from: { path: '^src/domain' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'domain-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Domain layer must not depend on presentation layer (DDD violation)',
      from: { path: '^src/domain' },
      to: { path: '^src/presentation' },
    },

    // Application layer should only depend on domain
    {
      name: 'application-cannot-depend-on-infrastructure',
      severity: 'error',
      comment: 'Application layer must not depend on infrastructure layer (DDD violation)',
      from: { path: '^src/application' },
      to: { path: '^src/infrastructure' },
    },
    {
      name: 'application-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Application layer must not depend on presentation layer (DDD violation)',
      from: { path: '^src/application' },
      to: { path: '^src/presentation' },
    },

    // Infrastructure layer should only depend on domain
    {
      name: 'infrastructure-cannot-depend-on-application',
      severity: 'error',
      comment: 'Infrastructure layer must not depend on application layer (DDD violation)',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/application' },
    },
    {
      name: 'infrastructure-cannot-depend-on-presentation',
      severity: 'error',
      comment: 'Infrastructure layer must not depend on presentation layer (DDD violation)',
      from: { path: '^src/infrastructure' },
      to: { path: '^src/presentation' },
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
