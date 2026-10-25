/**
 * Acceso a la base de conocimiento conversacional (tablas `kb_*` de PostgreSQL).
 *
 * El índice trigram de `pg_trgm` (`similarity()`) implementa el mismo
 * coeficiente que `similitudTrigram()` del normalizador, así que los umbrales
 * se comportan igual en la búsqueda y en las pruebas.
 *
 * Ninguna consulta de este archivo devuelve texto de respuesta: solo claves.
 * El texto se recupera después con `obtenerRespuesta()` / `obtenerOpcion()`,
 * que son las únicas vías autorizadas para emitir contenido institucional.
 */

import { query } from './pool.js';
import { similitudPorPalabras } from '../utils/normalizar.js';

/** Intencion + pregunta + variante que casan con la consulta. */
export interface CandidatoKb {
  intentKey: string;
  intentName: string;
  domain: 'administrativo' | 'academico';
  /** Opcion del menu que produce la misma respuesta autorizada. */
  opcionClave: string;
  /** Respuesta autorizada asociada a la pregunta (puede ser null). */
  respuestaId: number | null;
  preguntaId: number;
  question: string;
  priority: number;
  minimumThreshold: number;
  originalText: string;
  normalizedText: string;
  weight: number;
  /** Similitud 0..1 (pg_trgm en Neon, su equivalente en memoria). */
  similarity: number;
}

interface RawCandidato {
  intent_key: string;
  intent_name: string;
  domain: 'administrativo' | 'academico';
  opcion_clave: string | null;
  respuesta_id: number | null;
  pregunta_id: number;
  question: string;
  priority: number;
  minimum_threshold: string | number;
  original_text: string;
  normalized_text: string;
  weight: string | number;
  similarity: string | number;
}

const num = (v: string | number | null | undefined, fallback = 0): number => {
  const n = typeof v === 'number' ? v : Number.parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
};

/** Limite de candidatos que se traen de la base. La KB es chica; es un tope. */
const LIMITE_CANDIDATOS = 12;

/* ==========================================================================
 * Neon
 * ======================================================================== */

const SQL_EXACTO = `
  SELECT i.clave    AS intent_key,
         i.nombre  AS intent_name,
         i.domain,
         i.opcion_clave,
         p.id      AS pregunta_id,
         p.pregunta AS question,
         p.priority,
         p.minimum_threshold,
         p.respuesta_id,
         v.original_text,
         v.normalized_text,
         v.weight,
         1.0::float8 AS similarity
    FROM kb_pregunta_variante v
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
   WHERE v.activo
     AND v.normalized_text = $1
   ORDER BY p.priority DESC, v.weight DESC
   LIMIT $2`;

const SQL_SIMILARES = `
  SELECT i.clave    AS intent_key,
         i.nombre  AS intent_name,
         i.domain,
         i.opcion_clave,
         p.id      AS pregunta_id,
         p.pregunta AS question,
         p.priority,
         p.minimum_threshold,
         p.respuesta_id,
         v.original_text,
         v.normalized_text,
         v.weight,
         similarity(v.normalized_text, $1)::float8 AS similarity
    FROM kb_pregunta_variante v
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
   WHERE v.activo
     AND similarity(v.normalized_text, $1) >= $2
   ORDER BY similarity DESC, p.priority DESC, v.weight DESC
   LIMIT $3`;

const toCandidato = (r: RawCandidato): CandidatoKb => ({
  intentKey: r.intent_key,
  intentName: r.intent_name,
  domain: r.domain,
  opcionClave: r.opcion_clave ?? '',
  respuestaId: r.respuesta_id,
  preguntaId: r.pregunta_id,
  question: r.question,
  priority: num(r.priority),
  minimumThreshold: num(r.minimum_threshold, 0.7),
  originalText: r.original_text,
  normalizedText: r.normalized_text,
  weight: num(r.weight, 1),
  similarity: num(r.similarity),
});

const SQL_TODAS_VARIANTES = `
  SELECT i.clave    AS intent_key,
         i.nombre  AS intent_name,
         i.domain,
         i.opcion_clave,
         p.id      AS pregunta_id,
         p.pregunta AS question,
         p.priority,
         p.minimum_threshold,
         p.respuesta_id,
         v.original_text,
         v.normalized_text,
         v.weight,
         0::float8 AS similarity
    FROM kb_pregunta_variante v
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
   WHERE v.activo`;

/* ==========================================================================
 * API publica
 * ======================================================================== */

/**
 * Coincidencia exacta sobre el texto normalizado.
 *
 * Un mismo texto puede pertenecer a varias intenciones (las variantes
 * genericas se repiten en las cuatro materias): se devuelven TODAS para que el
 * motor pueda pedir aclaracion en vez de elegir una.
 */
/** Siglas de la consulta con su expansión, para normalizar antes de buscar. */
export async function obtenerAlias(): Promise<Map<string, string>> {
  const r = await query<{ alias: string; expansion: string }>('SELECT alias, expansion FROM kb_alias');
  return new Map(r.rows.map((x) => [x.alias, x.expansion] as const));
}

export async function buscarExacto(normalizado: string): Promise<CandidatoKb[]> {
  if (normalizado.length === 0) return [];
  const r = await query<RawCandidato>(SQL_EXACTO, [normalizado, LIMITE_CANDIDATOS]);
  return r.rows.map(toCandidato);
}

/**
 * Candidatos por comparación de palabras, tolerante a transposiciones.
 * Se calcula en memoria sobre todas las variantes activas: son pocas, y así no
 * hace falta una extensión adicional en la base.
 */
export async function buscarPorPalabras(normalizado: string, minimo: number): Promise<CandidatoKb[]> {
  if (normalizado.length === 0) return [];
  const r = await query<RawCandidato>(SQL_TODAS_VARIANTES);
  return r.rows
    .map((row) => ({ ...toCandidato(row), similarity: similitudPorPalabras(normalizado, row.normalized_text) }))
    .filter((c) => c.similarity >= minimo)
    .sort((a, b) => b.similarity - a.similarity || b.priority - a.priority || b.weight - a.weight);
}

/**
 * Candidatos por similitud trigram (Nivel B). `minimo` es el corte inferior:
 * lo que queda por debajo se considera "no disponible" y ni se rankea.
 */
export async function buscarSimilares(
  normalizado: string,
  minimo: number,
  limite = LIMITE_CANDIDATOS,
): Promise<CandidatoKb[]> {
  if (normalizado.length === 0) return [];
  const r = await query<RawCandidato>(SQL_SIMILARES, [normalizado, minimo, limite]);
  return r.rows.map(toCandidato);
}
