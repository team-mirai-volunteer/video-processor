FROM node:20-slim AS base

# Install FFmpeg and other dependencies
RUN apt-get update && \
    apt-get install -y ffmpeg openssl && \
    rm -rf /var/lib/apt/lists/*

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy workspace configuration
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.json biome.json ./

# Copy packages
COPY packages ./packages

# Copy api app
COPY apps/api ./apps/api

# Install dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client
RUN pnpm --filter @video-processor/api prisma:generate

# Build shared package first
RUN pnpm --filter @video-processor/shared build

# Build api
RUN pnpm --filter @video-processor/api build

# Production stage
FROM node:20-slim AS production

RUN apt-get update && \
    apt-get install -y ffmpeg openssl && \
    rm -rf /var/lib/apt/lists/*

RUN corepack enable && corepack prepare pnpm@9.15.4 --activate

WORKDIR /app

# Copy built files
COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=base /app/packages/shared/package.json ./packages/shared/
COPY --from=base /app/packages/shared/dist ./packages/shared/dist
COPY --from=base /app/apps/api/package.json ./apps/api/
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/src/infrastructure/database/prisma ./apps/api/src/infrastructure/database/prisma
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Start the application
CMD ["node", "dist/index.js"]
