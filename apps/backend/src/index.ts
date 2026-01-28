import clipVideoRoutes from '@clip-video/presentation/routes/index.js';
import { disconnectDatabase } from '@shared/infrastructure/database/connection.js';
import { logger } from '@shared/infrastructure/logging/logger.js';
import { apiKeyAuth } from '@shared/presentation/middleware/api-key-auth.js';
import { errorHandler } from '@shared/presentation/middleware/error-handler.js';
import { requestLogger } from '@shared/presentation/middleware/logger.js';
import sharedRoutes from '@shared/presentation/routes/index.js';
import shortsGenRoutes from '@shorts-gen/presentation/routes/index.js';
import express, { type Express } from 'express';

const app: Express = express();

// Parse JSON bodies
app.use(express.json());

// Request logging
app.use(requestLogger);

// CORS
const corsOrigin = process.env.CORS_ORIGIN ?? '*';
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', corsOrigin);
  res.header(
    'Access-Control-Allow-Headers',
    'Origin, X-Requested-With, Content-Type, Accept, X-API-Key'
  );
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// API Key authentication
app.use(apiKeyAuth);

// Routes
app.use(sharedRoutes);
app.use(clipVideoRoutes);
app.use(shortsGenRoutes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const port = process.env.PORT ?? 8080;

const server = app.listen(port, () => {
  logger.info('Server started', {
    port,
    environment: process.env.NODE_ENV ?? 'development',
  });
});

// Graceful shutdown
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  server.close(async () => {
    await disconnectDatabase();
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
