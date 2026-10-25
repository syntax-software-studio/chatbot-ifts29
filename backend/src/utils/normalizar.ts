/**
 * Normalizacion de consultas en lenguaje natural (Nivel A del matching).
 *
 * Es la unica funcion que decide como se comparan dos textos, y se usa tanto
 * para normalizar la consulta del estudiante como para cargar las variantes de
 * la base de conocimiento. Por eso vive aislada y sin dependencias: cualquier
 * correccion tiene que verse reflejada en los dos lados a la vez.
 *
 * Reglas (minimas, no destructivas):
 *   1. minusculas;
 *   2. descomposicion Unicode y eliminacion de diacriticos ("Cuándo" -> "cuando");
 *   3. puntuacion y simbolos -> espacio (se conservan los espacios, no se pegan
 *      las palabras: "inscripción." debe quedar "inscripcion ");
 *   4. colapso de espacios repetidos y recorte;
 *   5. recorte de letras repetidas en exceso ("holaaaaaa" -> "holaa").
 *
 * No se eliminan palabras ni se reordenan terminos: la similitud trigram se
 * calcula sobre el texto completo y perder palabras romperia el indice GIN.
 */

/** Caracteres validos del dominio institucional: letras, digitos y espacios. */
const NO_PERMITIDO = /[^a-z0-9\s]+/g;

/** Letras repetidas mas alla de "holaa" -> ruido de tipeo, no de contenido. */
const LETRAS_REPETIDAS = /([a-z])\1{3,}/g;

/**
 * Cantidad minima de caracteres del texto normalizado. Por debajo de esto no
 * hay informacion suficiente para decidir una intencion y se rechaza la
 * consulta antes de tocar la base de conocimiento.
 */
export const MIN_CARACTERES = 2;

/**
 * Normaliza un texto libre para compararlo contra la base de conocimiento.
 *
 *   normalizar('¿Cuándo empiezan las clases?')  -> 'cuando empiezan las clases'
 */
export function normalizar(entrada: string): string {
  return entrada
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(NO_PERMITIDO, ' ')
    .replace(LETRAS_REPETIDAS, '$1$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/** ¿El texto normalizado tiene largo suficiente para buscar una intencion? */
export function esConsultaUtil(entrada: string): boolean {
  return normalizar(entrada).length >= MIN_CARACTERES;
}

/* ==========================================================================
 * Similitud trigram
 * --------------------------------------------------------------------------
 * Réplica exacta de `similarity()` de PostgreSQL `pg_trgm`, para que las pruebas
 * de la similitud apliquen los MISMOS umbrales que la base real.
 *
 * Réplica de `contrib/pg_trgm` (`generate_trgm_only` + `cnt_sml`):
 *   1. el texto se parte por palabras (los trigramas NO cruzan espacios);
 *   2. cada palabra se delimita con dos espacios a cada lado y se le sacan sus
 *      trigramas;
 *   3. el conjunto de trigramas se deduplica (trgm_qunique);
 *   4. similitud = comunes / (n1 + n2 - comunes).
 *
 * Los dos ultimos puntos son los que hacen fallar una implementacion "de
 * memoria": con multiconjuntos el resultado puede pasar de 1, y con trigramas
 * que cruzan palabras los valores difieren de los de PostgreSQL.
 * ======================================================================== */

function trigramas(texto: string): Set<string> {
  const conjunto = new Set<string>();
  for (const palabra of texto.split(/\s+/)) {
    if (palabra.length === 0) continue;
    const delimitada = `  ${palabra}  `;
    for (let i = 0; i + 3 <= delimitada.length; i += 1) {
      conjunto.add(delimitada.slice(i, i + 3));
    }
  }
  return conjunto;
}

/** Similitud entre 0 y 1. Equivale a `similarity()` de `pg_trgm`. */
export function similitudTrigram(a: string, b: string): number {
  const ta = trigramas(a);
  const tb = trigramas(b);
  if (ta.size === 0 || tb.size === 0) return 0;

  let comunes = 0;
  for (const tri of ta) {
    if (tb.has(tri)) comunes += 1;
  }

  return comunes / (ta.size + tb.size - comunes);
}
