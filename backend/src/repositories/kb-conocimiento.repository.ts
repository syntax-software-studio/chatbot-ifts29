/**
 * Acceso a la base de conocimiento conversacional (tablas `kb_*` de PostgreSQL).
 *
 * La similitud (`similarity()` y `word_similarity()` de `pg_trgm`) se calcula
 * en la base, no en el código.
 *
 * Ninguna consulta de este archivo devuelve texto de respuesta: solo claves.
 * El texto se recupera después con `obtenerRespuesta()` / `obtenerOpcion()`,
 * que son las únicas vías autorizadas para emitir contenido institucional.
 */

import { query } from '../db/pool.js';
import { similitudPorPalabras } from '../lib/normalizar.js';
import { env } from '../config/env.js';

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

/**
 * Similitud mínima de un término con una palabra de la variante para contarlo
 * como error de tipeo. Por debajo, el término no cubre nada.
 */
const UMBRAL_TERMINO_FUZZY = 0.6;

/* ==========================================================================
 * Neon
 * ======================================================================== */

/**
 * Nivel B_FTS: full-text search con config spanish.
 *
 * Candidatos: cualquier variante que cubra al menos un término.
 *
 * Confianza = cobertura: promedio, sobre los términos significativos, de cuánto
 * cubre cada uno. Un término cubre 1.0 si coincide con stemming, o su similitud
 * si es un error de tipeo (word_similarity). Así "condicons" cuenta casi como
 * "condiciones" y no hace falta una aclaración para resolverlo.
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
         s.score AS similarity,
         s.cubiertos
    FROM kb_pregunta_variante v
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
    CROSS JOIN LATERAL (
      -- Por cada término: 1 si coincide con stemming, la similitud si es un
      -- error de tipeo (>= $2), 0 si no aparece. La cobertura es el promedio.
      SELECT avg(m.mejor) AS score,
             array_agg(m.termino) FILTER (WHERE m.mejor > 0) AS cubiertos
        FROM (
          SELECT t.termino,
                 CASE
                   WHEN v.search_vector @@ plainto_tsquery('spanish', t.termino) THEN 1.0
                   WHEN word_similarity(t.termino, v.normalized_text) >= $2
                     THEN word_similarity(t.termino, v.normalized_text)
                   ELSE 0.0
                 END AS mejor
            FROM unnest($1::text[]) AS t(termino)
        ) m
    ) s
   WHERE v.activo
     AND s.score > 0
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

/**
 * Palabras de la consulta que se descartan al buscar (ruido: "como", "para"...).
 * Vienen de la pestaña `ignorados` de la planilla. No afectan la normalización
 * de las variantes, así que cambiarlas no requiere volver a sincronizar.
 */
export async function obtenerTerminosIgnorados(): Promise<Set<string>> {
  const r = await query<{ termino: string }>('SELECT termino FROM kb_termino_ignorado');
  return new Set(r.rows.map((x) => x.termino));
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
  ignorados: ReadonlySet<string> = new Set(),
): Promise<CandidatoKb[]> {
  // Trigramas a nivel término: cada palabra de la consulta se compara contra
  // las palabras de cada variante (word_similarity), no contra la frase entera.
  const terminos = normalizado
    .split(' ')
    .filter((t) => t.length >= LARGO_MIN_TERMINO && !ignorados.has(t));
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
 * (`ignorados`, de la planilla). Con ellos se calcula la cobertura de cada
 * variante (ver SQL_FTS).
 */
export async function buscarPorFts(
  normalizado: string,
  ignorados: ReadonlySet<string> = new Set(),
): Promise<CandidatoKb[]> {
  const todos = normalizado.split(' ').filter((t) => t !== '');
  const terminos = todos.filter((t) => t.length > 2 && !ignorados.has(t));

  if (terminos.length === 0) {
    if (DIAGNOSTICO_LOCAL) {
      console.log(`[fts] "${normalizado}": sin términos significativos (descartados: ${todos.join(', ') || '—'})`);
    }
    return [];
  }

  const r = await query<RawCandidato>(SQL_FTS, [terminos, UMBRAL_TERMINO_FUZZY, LIMITE_CANDIDATOS]);
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
