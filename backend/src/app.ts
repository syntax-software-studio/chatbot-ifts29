/**
 * Aplicación Express.
 *
 * Se exporta la app (no se llama a `listen`) para que funcione tal cual en
 * Vercel Serverless: `api/index.ts` la reexporta como handler, y
 * `src/index.ts` la usa para el desarrollo local.
 */

import express from 'express';
import { corsMiddleware, securityHeaders } from './middleware/cors.js';
import { rateLimit } from './middleware/rateLimit.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { menuRouter } from './routes/menu.routes.js';
import { chatRouter } from './routes/chat.routes.js';
import { healthRouter } from './routes/system.routes.js';
import { metricasRouter } from './routes/metricas.routes.js';
import { logDbMode } from './db/pool.js';
import { hasDatabase } from './config/env.js';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', true);

  app.use(securityHeaders);
  app.use(corsMiddleware);
  app.use(express.json({ limit: '32kb' }));
  app.use(rateLimit);

  app.get('/', (_req, res) => {
    res.json({
      servicio: 'Asistente Virtual Institucional - IFTS N.29',
      version: '1.0.0',
      endpoints: [
        'GET  /api/menu?categoria=RAIZ',
        'GET  /api/menu?mapa=1',
        'GET  /api/menu/:claveOpcion',
        'POST /api/chat',
        'POST /api/chat/documento',
        'GET  /api/health',
        'GET  /api/metricas',
        'POST /api/sync',
      ],
    });
  });

  // Sin base de datos no hay contenido que mostrar: la API responde 503 en lugar de
  // inventar datos. El health queda afuera para poder diagnosticar la configuración.
  app.use('/api', (req, res, next) => {
    if (hasDatabase() || req.path === '/health') return next();
    res.status(503).json({
      error: { code: 'BASE_NO_CONFIGURADA', message: 'La base de datos no está configurada (DATABASE_URL).' },
    });
  });

  // La API vive bajo /api, ya sea montada en local o como función en Vercel.
  app.use('/api', menuRouter);
  app.use('/api', chatRouter);
  app.use('/api', healthRouter);
  app.use('/api', metricasRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  logDbMode();
  return app;
}

export const app = createApp();
