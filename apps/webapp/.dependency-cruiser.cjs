/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    // === UI layer isolation ===
    {
      name: 'ui-cannot-import-features',
      severity: 'error',
      comment: 'UI components must not depend on feature components',
      from: { path: '^src/components/ui' },
      to: { path: '^src/components/features' },
    },
    {
      name: 'ui-cannot-import-server',
      severity: 'error',
      comment: 'UI components must not depend on server layer',
      from: { path: '^src/components/ui' },
      to: { path: '^src/server' },
    },
    {
      name: 'ui-cannot-import-app',
      severity: 'error',
      comment: 'UI components must not depend on app layer',
      from: { path: '^src/components/ui' },
      to: { path: '^src/app' },
    },

    // === Feature isolation ===
    {
      name: 'feature-cannot-import-other-features',
      severity: 'error',
      comment: 'Features should not directly import from other features',
      from: { path: '^src/components/features/([^/]+)/' },
      to: {
        path: '^src/components/features/([^/]+)/',
        pathNot: '^src/components/features/$1/',
      },
    },
    {
      name: 'features-cannot-import-app',
      severity: 'error',
      comment: 'Feature components must not depend on app layer',
      from: { path: '^src/components/features' },
      to: { path: '^src/app' },
    },

    // === Server layer isolation ===
    {
      name: 'server-cannot-import-components',
      severity: 'error',
      comment: 'Server layer must not depend on components',
      from: { path: '^src/server' },
      to: { path: '^src/components' },
    },
    {
      name: 'server-cannot-import-app',
      severity: 'error',
      comment: 'Server layer must not depend on app layer',
      from: { path: '^src/server' },
      to: { path: '^src/app' },
    },
    {
      name: 'infrastructure-cannot-import-presentation',
      severity: 'error',
      comment: 'Infrastructure must not depend on presentation',
      from: { path: '^src/server/infrastructure' },
      to: { path: '^src/server/presentation' },
    },

    // === Lib isolation ===
    {
      name: 'lib-cannot-import-internal',
      severity: 'error',
      comment: 'Lib must not depend on internal modules',
      from: { path: '^src/lib' },
      to: { path: '^src/(app|components|server)' },
    },

    // === Common anti-patterns ===
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
