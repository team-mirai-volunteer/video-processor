import express, { type Express } from 'express';
import cors from 'cors';
import routes from './presentation/routes/index.js';
import { loggerMiddleware } from './presentation/middleware/logger.js';
import { errorHandlerMiddleware } from './presentation/middleware/error-handler.js';
import { disconnectPrisma } from './infrastructure/database/connection.js';
import { getVideoProcessingService } from './application/services/video-processing.service.js';

// Environment variables
const PORT = process.env.PORT || 8080;
const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
const NODE_ENV = process.env.NODE_ENV || 'development';

// Create Express app
const app: Express = express();

// Middleware
app.use(cors({
  origin: CORS_ORIGIN === '*' ? '*' : CORS_ORIGIN.split(','),
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());
app.use(loggerMiddleware);

// Routes
app.use(routes);

// Error handler (must be last)
app.use(errorHandlerMiddleware);

// Start server
const server = app.listen(PORT, () => {
  console.log(`[Server] Video Processor API running on port ${PORT}`);
  console.log(`[Server] Environment: ${NODE_ENV}`);
  console.log(`[Server] CORS origin: ${CORS_ORIGIN}`);

  // Start background processing service in non-test environments
  if (NODE_ENV !== 'test') {
    const processingService = getVideoProcessingService();
    processingService.start();
  }
});

// Graceful shutdown
async function shutdown(signal: string): Promise<void> {
  console.log(`[Server] Received ${signal}, shutting down gracefully...`);

  // Stop background processing
  const processingService = getVideoProcessingService();
  processingService.stop();

  // Close server
  server.close(async () => {
    console.log('[Server] HTTP server closed');

    // Disconnect from database
    await disconnectPrisma();
    console.log('[Server] Database connection closed');

    process.exit(0);
  });

  // Force exit after timeout
  setTimeout(() => {
    console.error('[Server] Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
