import fs from 'node:fs';
import path from 'node:path';
import cors from 'cors';
import express from 'express';
import morgan from 'morgan';
import { env } from './config/env.js';
import { apiNotFound, errorHandler } from './middleware/errorHandler.js';
import apiRoutes from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json({ limit: '1mb' }));
  if (env.nodeEnv === 'development') app.use(morgan('dev'));

  app.use('/uploads', express.static(env.uploadsDir));
  app.use('/api', apiRoutes);
  app.use('/api', apiNotFound);

  // In demo mode, Express also serves the built React app from the same port.
  if (fs.existsSync(env.clientDist)) {
    app.use(express.static(env.clientDist));
    app.get('/{*splat}', (req, res) => {
      res.sendFile(path.join(env.clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
