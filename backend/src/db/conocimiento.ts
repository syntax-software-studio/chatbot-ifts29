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
  /**
   * Nivel de búsqueda que generó este candidato.
   * Permite que nl.service registre qué camino resolvió la consulta.
   */
  fuenteNivel?: 'exacto' | 'fts' | 'trigram' | 'palabras';
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

/**
 * Factor de escala para ts_rank_cd -> rango de umbrales del sistema.
 *
 * ts_rank_cd (norma 2) sobre variantes cortas devuelve típicamente 0.1-0.5
 * cuando hay buen match. El factor lleva esos valores al rango [0.7, 1.0]
 * que el motor espera.
 *
 * Es experimental y se calibra con los primeros datos reales. Se puede ajustar
 * sin recompilar a través de la variable de entorno KB_FTS_ESCALA.
 */
const FTS_ESCALA = Number.parseFloat(process.env['KB_FTS_ESCALA'] ?? '') || 3.5;

/* ==========================================================================
 * Neon
 * ======================================================================== */

/**
 * Nivel B_FTS: full-text search con config spanish.
 *
 * La tsquery se construye como OR de tokens (websearch_to_tsquery acepta
 * "token1 OR token2") para comportarse como búsqueda keyword: "alguno de
 * estos términos" en vez de AND estricto. Los tokens de 1-2 caracteres se
 * filtran porque producen lexemas vacíos o stopwords que no aportan.
 *
 * ts_rank_cd (norma 2) se escala por FTS_ESCALA para que los valores queden
 * en la misma escala que los umbrales del motor (KB_UMBRAL_MEDIO / KB_UMBRAL_ALTO).
 * El factor es experimental: se calibra con los primeros datos reales.
 */
const SQL_FTS = `
  SELECT i.clave    AS intent_key,
         i.nombre   AS intent_name,
         i.domain,
         i.opcion_clave,
         p.id       AS pregunta_id,
         p.pregunta AS question,
         p.priority,
         p.minimum_threshold,
         p.respuesta_id,
         v.original_text,
         v.normalized_text,
         v.weight,
         ts_rank_cd(v.search_vector, query, 2)::float8 AS similarity
    FROM kb_pregunta_variante v
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
    CROSS JOIN websearch_to_tsquery('spanish', $1) AS query
   WHERE v.activo
     AND query IS NOT NULL
     AND v.search_vector @@ query
   ORDER BY ts_rank_cd(v.search_vector, query, 2) DESC, p.priority DESC, v.weight DESC
   LIMIT $2`;

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
  return r.rows.map((row) => ({ ...toCandidato(row), fuenteNivel: 'exacto' as const }));
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
    .map((row) => ({
      ...toCandidato(row),
      similarity: similitudPorPalabras(normalizado, row.normalized_text),
      fuenteNivel: 'palabras' as const,
    }))
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
  return r.rows.map((row) => ({ ...toCandidato(row), fuenteNivel: 'trigram' as const }));
}

/**
 * Candidatos por full-text search (Nivel B_FTS).
 *
 * Construye la tsquery como OR de los tokens con >2 caracteres y la pasa a
 * websearch_to_tsquery, que es robusta con cualquier input. ts_rank_cd se
 * escala por FTS_ESCALA para quedar en el rango de los umbrales del motor.
 */
export async function buscarPorFts(normalizado: string): Promise<CandidatoKb[]> {
  const tokens = normalizado.split(' ').filter((t) => t.length > 2);
  if (tokens.length === 0) return [];
  const wsQuery = tokens.join(' OR ');

  // Diagnóstico: ver qué lexemas produce el input y qué filas matchean.
  // Quitar cuando ya no se necesite calibrar.
  try {
    const [lexQuery, lexDocs] = await Promise.all([
      query<{ tsquery: string }>(`SELECT websearch_to_tsquery('spanish', $1)::text AS tsquery`, [wsQuery]),
      query<{ normalized_text: string; rank: number }>(
        `SELECT v.normalized_text,
                ts_rank_cd(v.search_vector, q, 2)::float8 AS rank
           FROM kb_pregunta_variante v,
                websearch_to_tsquery('spanish', $1) AS q
          WHERE v.activo AND q IS NOT NULL AND v.search_vector @@ q
          ORDER BY rank DESC LIMIT 5`,
        [wsQuery],
      ),
    ]);
    console.log(`[fts] entrada:"${normalizado}" → wsQuery:"${wsQuery}" → tsquery:${lexQuery.rows[0]?.tsquery ?? 'NULL'}`);
    if (lexDocs.rows.length === 0) {
      console.log('[fts] sin resultados en la base');
    } else {
      console.log('[fts] top matchs (rank crudo, antes de escalar x' + FTS_ESCALA + '):');
      for (const row of lexDocs.rows) {
        console.log(`  rank=${row.rank.toFixed(4)}  scaled=${(row.rank * FTS_ESCALA).toFixed(4)}  variante="${row.normalized_text}"`);
      }
    }
  } catch (diagErr) {
    console.log('[fts] diagnóstico falló:', diagErr instanceof Error ? diagErr.message : diagErr);
  }

  const r = await query<RawCandidato>(SQL_FTS, [wsQuery, LIMITE_CANDIDATOS]);
  return r.rows.map((row) => ({
    ...toCandidato(row),
    similarity: Math.min(1.0, num(row.similarity) * FTS_ESCALA),
    fuenteNivel: 'fts' as const,
  }));
}
