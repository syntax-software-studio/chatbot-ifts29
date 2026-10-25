/**
 * GET  /api/health  - estado del servicio y de sus dependencias.
 * POST /api/sync    - carga el contenido de la planilla y sincroniza los documentos con Drive.
 *
 * `/api/sync` es la rutina que ejecuta el personal autorizado tras actualizar
 * la carpeta de Drive (RF08). Está protegida con `SYNC_SECRET` cuando está
 * definido; en el modo demo sin secreto se acepta, para que el equipo pueda
 * probarlo localmente.
 */

import { Router } from 'express';
import { z } from 'zod';
import { checkDatabase } from '../db/pool.js';
import { fuente } from '../db/catalogo.js';
import { verificarDrive } from '../services/drive.service.js';
import { sincronizar } from '../services/sincronizacion.service.js';
import { topOpciones } from '../services/metricas.service.js';
import { asyncHandler } from '../middleware/error.js';
import { env, hasDatabase, hasGoogleDrive } from '../utils/env.js';
import { unauthorized } from '../utils/errors.js';

export const healthRouter = Router();

healthRouter.get(
  '/health',
  asyncHandler(async (_req, res) => {
    const db = await checkDatabase();
    const drive = hasGoogleDrive()
      ? await verificarDrive()
      : { ok: false, detalle: 'Google Drive no configurado' };

    const sano = db.ok || !hasDatabase();

    res.status(sano ? 200 : 503).json({
      estado: sano ? 'ok' : 'degradado',
      version: process.env.npm_package_version ?? '1.0.0',
      datos: { origen: fuente(), baseDeDatos: db },
      drive,
      uptimeSegundos: Math.round(process.uptime()),
    });
  }),
);

const syncSchema = z
  .object({
    carpetaId: z.string().min(1).max(200).optional(),
    dryRun: z.boolean().optional(),
    secreto: z.string().optional(),
  })
  .strict();

healthRouter.post(
  '/sync',
  asyncHandler(async (req, res) => {
    const parsed = syncSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Cuerpo inválido.' } });
      return;
    }

    // Protección simple por secreto compartido (el cuerpo puede no venir en
    // algunos clientes; se acepta también la cabecera).
    if (env.syncSecret) {
      const recibido =
        parsed.data.secreto ??
        (req.headers['x-sync-secret'] as string | undefined);
      if (recibido !== env.syncSecret) throw unauthorized('Secreto de sincronización inválido.');
    }

    const resultado = await sincronizar({
      ...(parsed.data.carpetaId ? { carpetaId: parsed.data.carpetaId } : {}),
      ...(parsed.data.dryRun !== undefined ? { dryRun: parsed.data.dryRun } : {}),
    });

    res.json(resultado);
  }),
);

/** GET /api/metricas - top de opciones elegidas (agregado, sin datos personales). */
healthRouter.get(
  '/metricas',
  asyncHandler(async (_req, res) => {
    res.json({ origen: fuente(), top: await topOpciones() });
  }),
);
