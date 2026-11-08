/**
 * Búsqueda de pasajes: el fragmento de un documento que responde la consulta.
 *
 * Corre solo sobre los documentos de la intención ya resuelta (no sobre toda la
 * base), así no aparecen respuestas de otra materia. Usa la misma regla de
 * cobertura que la búsqueda de intenciones: por cada término, 1 si coincide con
 * stemming (FTS en español), la similitud si es un error de tipeo, y 0 si no
 * aparece. La confianza es el promedio sobre los términos.
 *
 * El texto que se devuelve es el literal del documento (`texto`), no el normalizado.
 */

import { query } from '../db/pool.js';

/** Similitud mínima de un término con una palabra del fragmento para contarlo como error de tipeo. */
const UMBRAL_TERMINO_FUZZY = 0.6;

/** Cantidad máxima de pasajes por consulta. */
const LIMITE_PASAJES = 2;

interface FragmentoBuscado {
  titulo: string;
  texto: string;
  confianza: number;
}

const SQL_PASAJES = `
  SELECT f.titulo, f.texto, s.score::float8 AS confianza
    FROM documento_fragmento f
    JOIN documento d ON d.id = f.documento_id
    CROSS JOIN LATERAL (
      SELECT avg(m.mejor) AS score
        FROM (
          SELECT CASE
                   WHEN f.search_vector @@ plainto_tsquery('spanish', t.termino) THEN 1.0
                   WHEN word_similarity(t.termino, f.texto_busqueda) >= $3
                     THEN word_similarity(t.termino, f.texto_busqueda)
                   ELSE 0.0
                 END AS mejor
            FROM unnest($2::text[]) AS t(termino)
        ) m
    ) s
   WHERE d.clave = ANY($1::text[])
     AND s.score >= $4
   ORDER BY s.score DESC, f.documento_id, f.orden
   LIMIT $5`;

const SQL_PASAJES_GLOBAL = `
  SELECT f.titulo, f.texto, s.score::float8 AS confianza,
         d.id AS doc_id, d.clave AS doc_clave, d.tipo AS doc_tipo,
         d.materia AS doc_materia, d.comision AS doc_comision,
         d.anio AS doc_anio, d.cuatrimestre AS doc_cuatrimestre,
         d.drive_file_id, d.actualizado_en, d.sincronizado_en
    FROM documento_fragmento f
    JOIN documento d ON d.id = f.documento_id
    CROSS JOIN LATERAL (
      SELECT avg(m.mejor) AS score
        FROM (
          SELECT CASE
                   WHEN f.search_vector @@ plainto_tsquery('spanish', t.termino) THEN 1.0
                   WHEN word_similarity(t.termino, f.texto_busqueda) >= $2
                     THEN word_similarity(t.termino, f.texto_busqueda)
                   ELSE 0.0
                 END AS mejor
            FROM unnest($1::text[]) AS t(termino)
        ) m
    ) s
   WHERE s.score >= $3
   ORDER BY s.score DESC, f.documento_id, f.orden
   LIMIT $4`;

export interface FragmentoGlobal {
  titulo: string;
  texto: string;
  confianza: number;
  documento: {
    id: number;
    clave: string;
    tipo: string | null;
    materia: string | null;
    comision: string | null;
    anio: number | null;
    cuatrimestre: string | null;
    driveFileId: string | null;
    actualizadoEn: string | null;
    sincronizadoEn: string | null;
  };
}

/** Pasajes de TODOS los documentos que responden a los términos. Incluye datos del documento para armar la respuesta. */
export async function buscarFragmentosGlobal(terminos: string[], umbral: number): Promise<FragmentoGlobal[]> {
  if (terminos.length === 0) return [];
  const r = await query<{
    titulo: string; texto: string; confianza: number;
    doc_id: number; doc_clave: string; doc_tipo: string | null;
    doc_materia: string | null; doc_comision: string | null;
    doc_anio: number | null; doc_cuatrimestre: string | null;
    drive_file_id: string | null; actualizado_en: string | null; sincronizado_en: string | null;
  }>(SQL_PASAJES_GLOBAL, [terminos, UMBRAL_TERMINO_FUZZY, umbral, 1]);
  return r.rows.map((row) => ({
    titulo: row.titulo,
    texto: row.texto,
    confianza: Number(row.confianza),
    documento: {
      id: row.doc_id,
      clave: row.doc_clave,
      tipo: row.doc_tipo,
      materia: row.doc_materia,
      comision: row.doc_comision,
      anio: row.doc_anio,
      cuatrimestre: row.doc_cuatrimestre,
      driveFileId: row.drive_file_id,
      actualizadoEn: row.actualizado_en,
      sincronizadoEn: row.sincronizado_en,
    },
  }));
}

/**
 * Pasajes de los documentos indicados que responden a los términos de la consulta.
 * Vacío si ningún fragmento supera el umbral: el llamador muestra el documento completo.
 */
export async function buscarFragmentos(
  clavesDocumentos: string[],
  terminos: string[],
  umbral: number,
): Promise<FragmentoBuscado[]> {
  if (clavesDocumentos.length === 0 || terminos.length === 0) return [];
  const r = await query<{ titulo: string; texto: string; confianza: number }>(SQL_PASAJES, [
    clavesDocumentos,
    terminos,
    UMBRAL_TERMINO_FUZZY,
    umbral,
    LIMITE_PASAJES,
  ]);
  return r.rows.map((row) => ({ titulo: row.titulo, texto: row.texto, confianza: Number(row.confianza) }));
}
