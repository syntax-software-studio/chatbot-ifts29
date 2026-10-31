/**
 * Analytics (servicio de producto): registra qué consulta el estudiante y qué
 * respuesta recibe, en forma agregada y anónima, y publica el reporte mensual.
 *
 * El SQL está en `repositories/analytics.repository.ts`.
 */

import { eventosDelRango, registrarExportacion } from '../repositories/analytics.repository.js';
import { filasATabla, rangoDelMes } from '../lib/metricas.js';
import { metricasSheet, type PuertoMetricasSheet } from '../clients/sheets-metricas.client.js';

export { registrarMetrica, topOpciones, type Evento } from '../repositories/analytics.repository.js';

export interface ExportacionMensual {
  mes: string;
  archivoId: string;
  registros: number;
  total: number;
}

/**
 * Publica el reporte de un mes calendario como pestaña de la planilla de métricas
 * y lo registra. Si el mes ya estaba publicado, reemplaza su pestaña (no la duplica).
 */
export async function exportarMes(mes: string, sheet: PuertoMetricasSheet = metricasSheet): Promise<ExportacionMensual> {
  const { desde, hasta } = rangoDelMes(mes);
  const filas = await eventosDelRango(desde, hasta);
  const total = filas.reduce((suma, f) => suma + f.total, 0);

  const archivoId = await sheet.publicarMes(mes, filasATabla(filas));
  await registrarExportacion(mes, archivoId, filas.length, total);

  return { mes, archivoId, registros: filas.length, total };
}
