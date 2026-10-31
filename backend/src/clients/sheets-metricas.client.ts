/**
 * Publicación de los reportes de métricas en una planilla de Google Sheets.
 *
 * Usa una cuenta de servicio dedicada, compartida solo con esa planilla como
 * Editor. Cada mes es una pestaña. Las cuentas de servicio no tienen cuota para
 * crear archivos en Drive, pero sí pueden editar una planilla existente.
 */

import { google, type sheets_v4 } from 'googleapis';
import { env } from '../config/env.js';
import type { Tabla } from '../lib/metricas.js';

const ALCANCE = 'https://www.googleapis.com/auth/spreadsheets';

let cliente: sheets_v4.Sheets | null = null;

function sheets(): sheets_v4.Sheets {
  if (!cliente) {
    const auth = new google.auth.JWT({
      email: env.metricasSheet.clientEmail,
      key: env.metricasSheet.privateKey,
      scopes: [ALCANCE],
    });
    cliente = google.sheets({ version: 'v4', auth });
  }
  return cliente;
}

export interface PuertoMetricasSheet {
  /** Deja la pestaña `pestana` con la tabla dada (la crea si no existe). Devuelve el ID de la planilla. */
  publicarMes(pestana: string, tabla: Tabla): Promise<string>;
}

export const metricasSheet: PuertoMetricasSheet = {
  async publicarMes(pestana, tabla) {
    const s = sheets();
    const id = env.metricasSheet.sheetId;

    const libro = await s.spreadsheets.get({ spreadsheetId: id, fields: 'sheets.properties.title' });
    const existe = libro.data.sheets?.some((h) => h.properties?.title === pestana) ?? false;

    if (existe) {
      await s.spreadsheets.values.clear({ spreadsheetId: id, range: `'${pestana}'` });
    } else {
      await s.spreadsheets.batchUpdate({
        spreadsheetId: id,
        requestBody: { requests: [{ addSheet: { properties: { title: pestana } } }] },
      });
    }

    await s.spreadsheets.values.update({
      spreadsheetId: id,
      range: `'${pestana}'!A1`,
      valueInputOption: 'RAW',
      requestBody: { values: tabla },
    });
    return id;
  },
};
