# Build stage
FROM node:22-slim AS builder

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy workspace configuration and source files
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.json ./
COPY apps/shared ./apps/shared
COPY apps/backend ./apps/backend

# Install dependencies (postinstall will run tsc for shared)
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter backend db:generate

# Build
RUN pnpm --filter backend build

# Migration stage (for running prisma db push)
FROM builder AS migrator

WORKDIR /app/apps/backend

CMD ["./scripts/migrate.sh"]

# Production stage
FROM node:22-slim AS runner

# Install FFmpeg and OpenSSL
RUN apt-get update && apt-get install -y ffmpeg openssl && rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/shared/package.json ./apps/shared/
COPY apps/backend/package.json ./apps/backend/

# Install production dependencies only (ignore scripts to skip postinstall)
RUN pnpm install --frozen-lockfile --prod --ignore-scripts

# Copy built files
COPY --from=builder /app/apps/shared ./apps/shared
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist
COPY --from=builder /app/apps/backend/src/contexts/shared/infrastructure/database/prisma ./apps/backend/src/contexts/shared/infrastructure/database/prisma

# Copy assets (videos, bgm)
COPY --from=builder /app/apps/backend/src/contexts/shorts-gen/infrastructure/assets ./apps/backend/dist/contexts/shorts-gen/infrastructure/assets

# Copy Prisma client (generated client + runtime)
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/.pnpm/@prisma+client*/node_modules/.prisma ./node_modules/.prisma


# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# Start server
CMD ["node", "apps/backend/dist/index.js"]
