import express, { type Express } from 'express';
import { disconnectDatabase } from './infrastructure/database/connection.js';
import { apiKeyAuth } from './presentation/middleware/api-key-auth.js';
import { errorHandler } from './presentation/middleware/error-handler.js';
import { requestLogger } from './presentation/middleware/logger.js';
import routes from './presentation/routes/index.js';

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
app.use(routes);

// Error handler (must be last)
app.use(errorHandler);

// Start server
const port = process.env.PORT ?? 8080;

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV ?? 'development'}`);
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  server.close(async () => {
    await disconnectDatabase();
    console.log('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
