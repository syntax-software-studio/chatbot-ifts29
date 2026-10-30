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
import { env } from '../utils/env.js';

/** Log detallado del matching de texto libre. Solo en NODE_ENV=local. */
const DIAGNOSTICO_LOCAL = env.nodeEnv === 'local';

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
  /** Términos de la consulta que aparecen en la variante (sólo FTS). */
  terminosCubiertos?: string[];
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
  cubiertos?: string[] | null;
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

/**
 * Nivel B_FTS: full-text search con config spanish.
 *
 * Candidatos: cualquier variante que contenga al menos uno de los términos
 * significativos (OR), para no perder matches parciales.
 *
 * Confianza = cobertura: proporción de términos significativos de la consulta
 * que aparecen en la variante (con stemming). Es 0..1 directo, sin escalas.
 * Cada término se evalúa por separado con plainto_tsquery.
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
         (SELECT count(*) FROM unnest($2::text[]) AS t
           WHERE v.search_vector @@ plainto_tsquery('spanish', t))::float8
           / cardinality($2::text[])::float8 AS similarity,
         array(SELECT t FROM unnest($2::text[]) AS t
                WHERE v.search_vector @@ plainto_tsquery('spanish', t)) AS cubiertos
    FROM kb_pregunta_variante v
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
    CROSS JOIN websearch_to_tsquery('spanish', $1) AS query
   WHERE v.activo
     AND query IS NOT NULL
     AND v.search_vector @@ query
   ORDER BY similarity DESC, p.priority DESC, v.weight DESC
   LIMIT $3`;

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

/**
 * Nivel B_TRG a nivel término: `word_similarity(termino, variante)` mide qué
 * tan parecido es el término a alguna palabra de la variante. Por eso un typo
 * en una palabra no se diluye por el largo de la frase.
 */
const SQL_SIMILARES_TERMINO = `
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
         word_similarity($1, v.normalized_text)::float8 AS similarity
    FROM kb_pregunta_variante v
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
   WHERE v.activo
     AND word_similarity($1, v.normalized_text) >= $2
     -- Las coincidencias exactas (y con stemming) son de FTS. Aca sólo interesan
     -- los errores de tipeo: si no, las palabras compartidas por todas las
     -- variantes de una materia empatan a todas las intenciones en 1.00.
     AND word_similarity($1, v.normalized_text) < 1
   ORDER BY similarity DESC, p.priority DESC, v.weight DESC
   LIMIT $3`;

/** Términos más cortos que esto no aportan señal (ruido de 2-3 letras). */
const LARGO_MIN_TERMINO = 4;

/**
 * Palabras que aparecen en casi cualquier consulta y no identifican una
 * intención. Sólo se usan para trigramas: no cambian la normalización, que
 * requeriría volver a sincronizar la base.
 */
const TERMINOS_IGNORADOS = new Set([
  'como', 'cuando', 'donde', 'cual', 'cuales', 'para', 'necesito', 'quiero',
  'puedo', 'hay', 'tiene', 'tengo', 'sobre', 'informacion',
]);

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
  // Trigramas a nivel término: cada palabra de la consulta se compara contra
  // las palabras de cada variante (word_similarity), no contra la frase entera.
  const terminos = normalizado
    .split(' ')
    .filter((t) => t.length >= LARGO_MIN_TERMINO && !TERMINOS_IGNORADOS.has(t));
  if (terminos.length === 0) return [];

  const resultados = await Promise.all(
    terminos.map((termino) => query<RawCandidato>(SQL_SIMILARES_TERMINO, [termino, minimo, limite])),
  );

  // Una variante puede llegar por varios términos: se queda con la mejor similitud.
  const mejor = new Map<string, CandidatoKb>();
  for (const r of resultados) {
    for (const row of r.rows) {
      const c = { ...toCandidato(row), fuenteNivel: 'trigram' as const };
      const clave = `${c.preguntaId}|${c.normalizedText}`;
      const previo = mejor.get(clave);
      if (!previo || c.similarity > previo.similarity) mejor.set(clave, c);
    }
  }
  return [...mejor.values()]
    .sort((a, b) => b.similarity - a.similarity || b.priority - a.priority || b.weight - a.weight)
    .slice(0, limite);
}

/**
 * Candidatos por full-text search (Nivel B_FTS).
 *
 * Los términos significativos son las palabras de la consulta sin ruido
 * (`TERMINOS_IGNORADOS`). Con ellos se arma la búsqueda OR y se calcula la
 * cobertura de cada variante (ver SQL_FTS).
 */
export async function buscarPorFts(normalizado: string): Promise<CandidatoKb[]> {
  const todos = normalizado.split(' ').filter((t) => t !== '');
  const terminos = todos.filter((t) => t.length > 2 && !TERMINOS_IGNORADOS.has(t));

  if (terminos.length === 0) {
    if (DIAGNOSTICO_LOCAL) {
      console.log(`[fts] "${normalizado}": sin términos significativos (descartados: ${todos.join(', ') || '—'})`);
    }
    return [];
  }

  const wsQuery = terminos.join(' OR ');
  const r = await query<RawCandidato>(SQL_FTS, [wsQuery, terminos, LIMITE_CANDIDATOS]);
  const candidatos: CandidatoKb[] = r.rows.map((row) => ({
    ...toCandidato(row),
    similarity: num(row.similarity),
    fuenteNivel: 'fts' as const,
    terminosCubiertos: row.cubiertos ?? [],
  }));

  if (DIAGNOSTICO_LOCAL) registrarDiagnosticoFts(normalizado, terminos, todos, candidatos);
  return candidatos;
}

/**
 * Explica en consola por qué FTS eligió lo que eligió: qué términos se usaron,
 * cuáles se descartaron como ruido, y para cada candidato cuántos términos
 * cubre y cuáles le faltan. Sólo en NODE_ENV=local.
 */
function registrarDiagnosticoFts(
  normalizado: string,
  terminos: string[],
  todos: string[],
  candidatos: CandidatoKb[],
): void {
  const n = terminos.length;
  const descartados = todos.filter((t) => !terminos.includes(t));
  const lineas = [
    `[fts] consulta normalizada: "${normalizado}"`,
    `[fts]   términos (${n}): ${terminos.join(', ')}`,
    `[fts]   descartados como ruido: ${descartados.join(', ') || '—'}`,
    `[fts]   umbral medio: ${env.lenguajeNatural.umbralMedio.toFixed(2)} (por debajo no se responde)`,
  ];

  if (candidatos.length === 0) {
    lineas.push(`[fts]   sin candidatos: ningún término aparece en ninguna variante.`);
    lineas.push(`[fts]   → falta un sinónimo en la KB, o el vocabulario no está cargado.`);
  } else {
    lineas.push(`[fts]   candidatos: ${candidatos.length} (mostrando ${Math.min(5, candidatos.length)})`);
    candidatos.slice(0, 5).forEach((c, i) => {
      const cubre = c.terminosCubiertos ?? [];
      const falta = terminos.filter((t) => !cubre.includes(t));
      lineas.push(
        `[fts]   #${i + 1}  ${c.similarity.toFixed(2)}  (${cubre.length}/${n})  ${c.intentKey}  "${c.normalizedText}"`,
      );
      lineas.push(`[fts]        cubre: ${cubre.join(', ') || '—'}   |   falta: ${falta.join(', ') || '—'}`);
    });
  }

  console.log(lineas.join('\n'));
}
