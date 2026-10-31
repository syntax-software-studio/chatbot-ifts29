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
 * Esta funcion NO elimina palabras ni reordena terminos: la similitud trigram se
 * calcula sobre el texto completo y perder palabras romperia el indice GIN. Las
 * siglas y las palabras vacías se resuelven en `normalizarConsulta()`, que es la
 * que usa la búsqueda y la carga de variantes.
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
 * Normaliza un texto libre (minúsculas, sin tildes ni signos). Para buscar en la
 * base de conocimiento usar `normalizarConsulta()`, que además expande siglas y
 * quita palabras vacías.
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

/* ==========================================================================
 * Normalización de consultas: siglas y palabras vacías
 * --------------------------------------------------------------------------
 * Las mismas reglas se aplican a las variantes al cargar la planilla y a lo
 * que escribe el estudiante, así las dos cadenas se comparan en el mismo
 * espacio. Las siglas (ABD, EAM...) vienen de la pestaña `alias`.
 * ======================================================================== */

/** Conectores que no aportan significado al comparar frases. */
export const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'en', 'los', 'las', 'del', 'y', 'a', 'al']);

export function quitarPalabrasVacias(texto: string): string {
  return texto
    .split(' ')
    .filter((p) => p !== '' && !PALABRAS_VACIAS.has(p))
    .join(' ');
}

/**
 * Normaliza un texto para la búsqueda: reemplaza las siglas por su expansión,
 * normaliza y quita las palabras vacías.
 *
 * `alias` mapea una sigla ya normalizada (por ejemplo "abd") a su expansión.
 */
export function normalizarConsulta(entrada: string, alias: ReadonlyMap<string, string> = new Map()): string {
  const tokens = normalizar(entrada).split(' ').filter((t) => t !== '');
  const expandido = tokens.map((t) => alias.get(t) ?? t).join(' ');
  return normalizar(quitarPalabrasVacias(normalizar(expandido)));
}

/* ==========================================================================
 * Comparación por palabras, tolerante a transposiciones
 * --------------------------------------------------------------------------
 * pg_trgm pierde tres trigramas por cada par de letras intercambiadas
 * ("progrmaacion" vs "programacion"). La distancia de Damerau (OSA) cuenta una
 * transposición como una sola edición, así que la palabra se reconoce igual.
 * ======================================================================== */

/** Distancia de Damerau (OSA): inserción, borrado, sustitución y transposición de dos letras contiguas. */
export function distanciaDamerau(a: string, b: string): number {
  const n = a.length;
  const m = b.length;
  const d: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = 0; i <= n; i++) d[i]![0] = i;
  for (let j = 0; j <= m; j++) d[0]![j] = j;
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      const costo = a[i - 1] === b[j - 1] ? 0 : 1;
      let v = Math.min(d[i - 1]![j]! + 1, d[i]![j - 1]! + 1, d[i - 1]![j - 1]! + costo);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        v = Math.min(v, d[i - 2]![j - 2]! + 1);
      }
      d[i]![j] = v;
    }
  }
  return d[n]![m]!;
}

/** Dos palabras se consideran la misma si son iguales o si difieren en un error de tipeo (palabras de 4 letras o más). */
export function coincidePalabra(a: string, b: string): boolean {
  if (a === b) return true;
  return a.length >= 4 && b.length >= 4 && distanciaDamerau(a, b) <= 1;
}

/**
 * Proporción de palabras de la consulta que aparecen en la variante, con
 * tolerancia a un error de tipeo por palabra. Se divide por la cantidad mayor de
 * palabras, para que una variante larga no se lleve puntaje por accidente.
 */
export function similitudPorPalabras(consulta: string, variante: string): number {
  const q = consulta.split(' ').filter((p) => p !== '');
  const v = variante.split(' ').filter((p) => p !== '');
  if (q.length === 0 || v.length === 0) return 0;
  const coincidentes = q.filter((p) => v.some((w) => coincidePalabra(p, w))).length;
  return coincidentes / Math.max(q.length, v.length);
}
