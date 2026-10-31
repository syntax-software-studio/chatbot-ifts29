/**
 * GET /api/metricas/exportar-mes-anterior - publica en la planilla de métricas el reporte del mes anterior.
 *
 * Lo llama el cron mensual de Vercel con `Authorization: Bearer <CRON_SECRET>`.
 * Con `?mes=AAAA-MM` se puede publicar un mes puntual (por ejemplo, para rehacer uno).
 */

import { Router } from 'express';
import { env, hasMetricasSheet } from '../config/env.js';
import { exportarMes } from '../services/analytics.service.js';
import { mesAnterior, esMesValido } from '../lib/metricas.js';
import { asyncHandler } from '../middleware/error.js';
import { badRequest, unauthorized } from '../utils/errors.js';

export const metricasRouter = Router();

metricasRouter.get(
  '/metricas/exportar-mes-anterior',
  asyncHandler(async (req, res) => {
    if (!env.cronSecret || !hasMetricasSheet()) {
      res.status(503).json({ error: { code: 'NO_CONFIGURADO', message: 'La exportación de métricas no está configurada.' } });
      return;
    }
    if (req.headers.authorization !== `Bearer ${env.cronSecret}`) {
      throw unauthorized('Secreto del cron inválido.');
    }

    const mes = typeof req.query.mes === 'string' ? req.query.mes : mesAnterior(new Date());
    if (!esMesValido(mes)) throw badRequest('El mes debe tener formato AAAA-MM.');

    res.json(await exportarMes(mes));
  }),
);
