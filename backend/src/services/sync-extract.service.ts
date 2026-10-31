/**
 * Extracción (ETL, paso 1): lee las fuentes externas.
 *  - la planilla de Google Sheets (`leerContenido`)
 *  - las secciones de un PDF (`extraerFragmentos`: lee el PDF y lo parte por título)
 */

import { clienteSheets } from '../clients/sheets.client.js';
import { lineasDePdf } from '../clients/pdf.client.js';
import { env, hasGoogleDrive } from '../config/env.js';
import { fragmentar, type Fragmento } from '../lib/secciones.js';
import { interpretarContenido, type ResultadoContenido, type Valores } from '../lib/planilla.js';

export async function leerContenido(): Promise<ResultadoContenido> {
  const spreadsheetId = env.google.sheetId;
  if (!spreadsheetId || !hasGoogleDrive()) {
    return {
      ok: false,
      hojas: {},
      errores: ['Falta GOOGLE_SHEET_ID o las credenciales de Google en el entorno.'],
    };
  }

  const sheets = clienteSheets();

  const meta = await sheets.spreadsheets.get({
    spreadsheetId,
    fields: 'sheets.properties.title',
  });
  const titulos = (meta.data.sheets ?? [])
    .map((s) => s.properties?.title ?? '')
    .filter((t) => t !== '');

  const pestanas: Record<string, Valores> = {};
  for (const titulo of titulos) {
    const r = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `'${titulo.replace(/'/g, "''")}'`,
    });
    pestanas[titulo] = (r.data.values ?? []) as Valores;
  }

  return interpretarContenido(pestanas);
}

/**
 * Fragmentos de un PDF. Si no hay texto extraíble (por ejemplo, un PDF de
 * imágenes), devuelve una lista vacía: el documento se muestra completo, como hoy.
 */
export async function extraerFragmentos(datos: Uint8Array): Promise<Fragmento[]> {
  const lineas = await lineasDePdf(datos);
  const conTexto = lineas.filter((l) => l.text.length > 0);
  if (conTexto.length === 0) return [];
  return fragmentar(conTexto).filter((f) => f.texto.length > 0 || f.titulo !== '');
}
