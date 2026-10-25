/**
 * Fuente de contenido: lee el menú, la base de conocimiento y los contactos
 * desde la planilla de Google ("Bot IFTS29 - Contenido").
 *
 * La planilla tiene una pestaña por tabla. Este módulo:
 *  - lee todas las pestañas con la API de Google Sheets (sólo lectura),
 *  - valida que cada pestaña exista y que sus encabezados sean los esperados,
 *  - devuelve las filas como objetos, sin tipar: la conversión a tipos de base
 *    es responsabilidad de la carga.
 *
 * La validación (`interpretarContenido`) es una función pura y no toca la red,
 * así se prueba sin credenciales. Las pestañas que no están en el esquema se
 * ignoran, para que el equipo pueda tener hojas de trabajo sin romper la carga.
 */

import { google } from 'googleapis';
import { env, hasGoogleDrive } from '../utils/env.js';

/** Encabezados esperados por pestaña, en el orden de la planilla. */
export const ESQUEMA_CONTENIDO = {
  categorias: ['clave', 'nombre', 'mensaje', 'orden', 'es_raiz'],
  opciones: ['clave', 'categoria', 'etiqueta', 'tipo', 'destino', 'respuesta', 'orden', 'es_volver'],
  respuestas: ['clave', 'texto', 'orden'],
  respuesta_documentos: ['respuesta', 'documento', 'orden'],
  intenciones: ['clave', 'nombre', 'dominio', 'opcion'],
  preguntas: ['intencion', 'pregunta', 'prioridad', 'umbral'],
  variantes: ['intencion', 'pregunta', 'texto', 'peso'],
  contactos: ['clave', 'nombre', 'area', 'comision', 'email', 'perfil', 'motivo', 'orden'],
} as const;

export type Pestana = keyof typeof ESQUEMA_CONTENIDO;

/** Una fila de una pestaña: cada encabezado asociado a su celda, como texto. */
export type Fila = Record<string, string>;

export interface ResultadoContenido {
  ok: boolean;
  /** Filas válidas por pestaña. Sólo aparecen las pestañas que pasaron la validación. */
  hojas: Partial<Record<Pestana, Fila[]>>;
  errores: string[];
}

/** Valores tal como los devuelve la API: una lista de filas, cada una de celdas. */
export type Valores = string[][];

/**
 * Valida las pestañas y convierte sus filas en objetos.
 *
 * Reporta todos los problemas encontrados (no se detiene en el primero), para
 * que el equipo corrija la planilla de una sola vez.
 */
export function interpretarContenido(pestanas: Record<string, Valores | undefined>): ResultadoContenido {
  const errores: string[] = [];
  const hojas: Partial<Record<Pestana, Fila[]>> = {};

  for (const nombre of Object.keys(ESQUEMA_CONTENIDO) as Pestana[]) {
    const valores = pestanas[nombre];
    if (!valores) {
      errores.push(`Falta la pestaña "${nombre}".`);
      continue;
    }

    const esperado: readonly string[] = ESQUEMA_CONTENIDO[nombre];
    const encabezado = (valores[0] ?? []).map((c) => c.trim());
    const coincide = esperado.every((col, i) => encabezado[i] === col);
    if (!coincide) {
      errores.push(
        `Pestaña "${nombre}": encabezados esperados [${esperado.join(', ')}], ` +
          `encontrados [${encabezado.filter((c) => c !== '').join(', ')}].`,
      );
      continue;
    }

    const filas: Fila[] = [];
    for (const celdas of valores.slice(1)) {
      const texto = esperado.map((_, i) => (celdas[i] ?? '').trim());
      if (texto.every((c) => c === '')) continue; // fila vacía
      filas.push(Object.fromEntries(esperado.map((col, i) => [col, texto[i]!])));
    }
    hojas[nombre] = filas;
  }

  return { ok: errores.length === 0, hojas, errores };
}

/**
 * Lee el contenido desde Google Sheets y lo valida.
 *
 * Requiere `GOOGLE_SHEET_ID` y las credenciales de la cuenta de servicio. La
 * cuenta debe tener acceso de lector a la planilla.
 */
export async function leerContenido(): Promise<ResultadoContenido> {
  const spreadsheetId = env.google.sheetId;
  if (!spreadsheetId || !hasGoogleDrive()) {
    return {
      ok: false,
      hojas: {},
      errores: ['Falta GOOGLE_SHEET_ID o las credenciales de Google en el entorno.'],
    };
  }

  const auth = new google.auth.JWT({
    email: env.google.clientEmail,
    key: env.google.privateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });
  const sheets = google.sheets({ version: 'v4', auth });

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
