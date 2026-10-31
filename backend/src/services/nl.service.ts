/**
 * Motor de interpretacion de consultas en lenguaje natural.
 *
 * REGLA FUNDAMENTAL: el sistema interpreta la consulta pero NO inventa la
 * respuesta. Este servicio solo decide A QUE INTENCION corresponde un texto; el
 * texto institucional lo emite despues el flujo ya existente del menu, a traves
 * de `procesarSeleccion()`. Por eso este modulo no devuelve respuestas de
 * negocio: devuelve una intencion mas sus metadatos de trazabilidad.
 *
 * Secuencia (Niveles A -> E del prompt maestro):
 *
 *   normalizacion (siglas de la pestaña `alias` y palabras vacías)
 *     -> regla de saludos (Nivel C, menu raiz)
 *     -> coincidencia exacta sobre `kb_pregunta_variante.normalized_text`
 *     -> variantes / similitud trigram (`pg_trgm`)
 *     -> ranking y umbrales
 *     -> intencion | aclaracion | no_disponible
 *
 * Ningun LLM, ningun embedding, ningun acceso a Internet (D03, D08).
 */

import { obtenerNodo, CATEGORIA_RAIZ } from '../db/catalogo.js';
import {
  buscarExacto,
  buscarSimilares,
  buscarPorPalabras,
  buscarPorFts,
  obtenerAlias,
  obtenerTerminosIgnorados,
  type CandidatoKb,
} from '../db/conocimiento.js';
import { normalizarConsulta } from '../utils/normalizar.js';
import { env } from '../utils/env.js';
import type { Aclaracion, MetaInterpretacion, NodoMenu } from '../db/types.js';
import type { Evento } from './metricas.service.js';

/* ==========================================================================
 * Mensajes institucionales
 * --------------------------------------------------------------------------
 * Centralizados aqui: no se duplican en el servicio, en la ruta ni en el
 * frontend. El frontend solo muestra el texto que le llega.
 * ======================================================================== */

/** Base aprobada en D07 / §20 del prompt maestro. */
export const MENSAJE_NO_DISPONIBLE =
  'No dispongo de esa información dentro del dominio autorizado del IFTS N.º29. ' +
  'Podés reformular la consulta o volver al menú.';

/** Si la base de conocimiento no esta disponible, se dice sin inventar nada. */
export const MENSAJE_MOTOR_NO_DISPONIBLE =
  'No pude consultar la información en este momento. Podés seguir usando las opciones del menú ' +
  'o intentar de nuevo en un instante.';

/** Encabezado de una aclaracion (las opciones se listan debajo). */
export const MENSAJE_ACLARACION =
  'Podés precisar sobre qué información necesitás:';

/**
 * Saludos: respuesta controlada de nivel C.
 *
 * No hacen falta filas en la KB porque la respuesta NO es una respuesta
 * institucional nueva, sino el nodo raiz que el menu ya devuelve. Se listan
 * completas (y no como prefijo) para no capturar consultas que empiezan igual
 * pero siguen siendo una consulta real ("hola, cuando empiezan las clases").
 */
const SALUDOS = new Set([
  'hola',
  'holas',
  'holis',
  'ola',
  'buen dia',
  'buenos dias',
  'buenas tardes',
  'buenas noches',
  'que tal',
  'hola que tal',
  'saludos',
  'hey',
  'hi',
  'hello',
]);

/** Claves reservadas para las metricas agregadas del flujo de texto libre. */
export const CLAVE_METRICA_SALUDO = '(texto_regla)';
export const CLAVE_METRICA_ACLARACION = '(aclaracion)';
export const CLAVE_METRICA_NO_DISPONIBLE = '(no_disponible)';

/* ==========================================================================
 * Resultado de la interpretacion
 * ======================================================================== */

export type ResolucionConsulta =
  /** La intencion se resuelve con una opcion del menu existente. */
  | { clase: 'opcion'; opcionClave: string; evento: Evento; meta: MetaInterpretacion; terminos: string[] }
  /** Respuesta directa que no pasa por el menu (regla de saludos). */
  | { clase: 'nodo'; nodo: NodoMenu; meta: MetaInterpretacion }
  | { clase: 'aclaracion'; aclaracion: Aclaracion; meta: MetaInterpretacion }
  | { clase: 'no_disponible'; mensaje: string; meta: MetaInterpretacion }
  /** La base de conocimiento no respondio: no se inventa nada (D08). */
  | { clase: 'error'; mensaje: string; meta: MetaInterpretacion };

const meta = (
  intent: string | null,
  confidence: number,
  source: MetaInterpretacion['source'],
  matchType: MetaInterpretacion['matchType'],
): MetaInterpretacion => ({ intent, confidence, source, matchType });

const redondear = (n: number): number => Math.round(n * 1000) / 1000;

/** Un valor por intencion, quedandose con el candidato de mayor similitud. */
function mejorPorIntencion(candidatos: CandidatoKb[]): CandidatoKb[] {
  const mejor = new Map<string, CandidatoKb>();
  for (const c of candidatos) {
    const previo = mejor.get(c.intentKey);
    if (!previo || c.similarity > previo.similarity) mejor.set(c.intentKey, c);
  }
  return [...mejor.values()].sort(
    (a, b) => b.similarity - a.similarity || b.priority - a.priority || b.weight - a.weight,
  );
}

/**
 * Control de falsos positivos (§18): un candidato solo sirve si hay una fuente
 * autorizada de respuesta. `respuesta_id` es la respuesta de la pregunta;
 * `opcion_clave` es la opcion del menu equivalente (sirve para derivaciones).
 */
function esResoluble(c: CandidatoKb): boolean {
  return c.respuestaId !== null || c.opcionClave.length > 0;
}

/**
 * Une dos listas de candidatos quedándose, para cada variante, con la mayor similitud.
 * Así una variante que solo coincide por palabras (transposición) también cuenta.
 */
function combinarPorMaximo(a: CandidatoKb[], b: CandidatoKb[]): CandidatoKb[] {
  const mejor = new Map<string, CandidatoKb>();
  for (const c of [...a, ...b]) {
    const clave = `${c.preguntaId}|${c.normalizedText}`;
    const previo = mejor.get(clave);
    if (!previo || c.similarity > previo.similarity) mejor.set(clave, c);
  }
  return [...mejor.values()].sort((x, y) => y.similarity - x.similarity);
}

/** Botones de la aclaracion: opciones reales del menu, no rotulos libres. */
function opcionesDeAclaracion(candidatos: CandidatoKb[]): Aclaracion['opciones'] {
  return candidatos.slice(0, env.lenguajeNatural.maxOpcionesAclaracion).map((c) => ({
    clave: c.opcionClave,
    etiqueta: c.intentName,
    descripcion: null,
    tipo: 'responder' as const,
    esVolver: false,
    icono: null,
  }));
}

/* ==========================================================================
 * API publica
 * ======================================================================== */

/**
 * Fuente opcional de la búsqueda: si falla, la búsqueda sigue con las demás.
 * Por ahora el error se registra solo en NODE_ENV=local; una solución de logs
 * más robusta queda pendiente.
 */
const fuenteOpcional =
  <T>(nombre: string, vacio: T) =>
  (err: unknown): T => {
    if (env.nodeEnv === 'local') {
      console.warn(`[nl] ${nombre} falló, se sigue sin esta fuente:`, err instanceof Error ? err.message : err);
    }
    return vacio;
  };

/**
 * Interpreta una consulta escrita y devuelve la intencion resuelta.
 *
 * No propaga errores de la base de conocimiento: si no puede interpretar,
 * devuelve un turno institucional controlado, nunca un error tecnico ni una
 * respuesta inventada.
 */
export async function interpretarConsulta(texto: string): Promise<ResolucionConsulta> {
  const { umbralAlto, umbralMedio, margenAmbiguedad } = env.lenguajeNatural;
  const alias = await obtenerAlias().catch(fuenteOpcional('alias', new Map<string, string>()));
  const ignorados = await obtenerTerminosIgnorados().catch(fuenteOpcional('ignorados', new Set<string>()));
  const normalizado = normalizarConsulta(texto, alias);

  // Nivel C: saludos -> menu raiz (respuesta autorizada, no generada).
  if (SALUDOS.has(normalizado)) {
    const nodo = await obtenerNodo(CATEGORIA_RAIZ);
    return { clase: 'nodo', nodo, meta: meta(null, 1, 'rule', 'regla') };
  }

  // Nivel A: coincidencia exacta. Nivel B: similitud trigram.
  let candidatos: CandidatoKb[] = [];
  let esExacto = false;
  try {
    const exactos = (await buscarExacto(normalizado)).filter(esResoluble);
    if (exactos.length > 0) {
      candidatos = exactos;
      esExacto = true;
    } else {
      // FTS falla en silencio si la columna search_vector todavía no existe
      // (base sin migrar). El resto de la cascada sigue funcionando igual.
      const porFts      = await buscarPorFts(normalizado, ignorados).catch(fuenteOpcional('FTS', [] as CandidatoKb[]));
      const porTrigram  = await buscarSimilares(normalizado, umbralMedio, undefined, ignorados);
      const porPalabras = await buscarPorPalabras(normalizado, umbralMedio);
      candidatos = combinarPorMaximo([...porFts, ...porTrigram], porPalabras).filter(esResoluble);
    }
  } catch (err) {
    // Sin `pg_trgm` o sin tablas `kb_*` la base no puede interpretar.
    console.warn('[nl] base de conocimiento no disponible:', err instanceof Error ? err.message : err);
    return {
      clase: 'error',
      mensaje: MENSAJE_MOTOR_NO_DISPONIBLE,
      meta: meta(null, 0, 'none', 'ninguno'),
    };
  }

  if (candidatos.length === 0) {
    return {
      clase: 'no_disponible',
      mensaje: MENSAJE_NO_DISPONIBLE,
      meta: meta(null, 0, 'none', 'ninguno'),
    };
  }

  const porIntencion = mejorPorIntencion(candidatos);
  const [primero, ...resto] = porIntencion;
  if (!primero) {
    return {
      clase: 'no_disponible',
      mensaje: MENSAJE_NO_DISPONIBLE,
      meta: meta(null, 0, 'none', 'ninguno'),
    };
  }

  const confianza = redondear(primero.similarity);
  const source: MetaInterpretacion['source'] = esExacto ? 'kb_question' : 'kb_variant';
  const matchType: MetaInterpretacion['matchType'] = esExacto
    ? 'exacto'
    : primero.fuenteNivel === 'fts'
      ? 'fts'
      : 'similar';

  // Por debajo del umbral medio no hay informacion suficiente (Nivel E).
  if (primero.similarity < umbralMedio) {
    return {
      clase: 'no_disponible',
      mensaje: MENSAJE_NO_DISPONIBLE,
      meta: meta(null, confianza, 'none', 'ninguno'),
    };
  }

  // Ambigüedad: nunca se elige al azar entre intenciones equivalentes (D06).
  const hayEmpate = resto.some((c) => primero.similarity - c.similarity < margenAmbiguedad);

  if (hayEmpate || primero.similarity < umbralAlto) {
    return {
      clase: 'aclaracion',
      aclaracion: { mensaje: MENSAJE_ACLARACION, opciones: opcionesDeAclaracion(porIntencion) },
      meta: meta(porIntencion.length > 1 ? null : primero.intentKey, confianza, source, matchType),
    };
  }

  // Términos significativos de la consulta: los que usa la búsqueda de pasajes.
  const terminos = normalizado.split(' ').filter((t) => t.length > 2 && !ignorados.has(t));

  return {
    clase: 'opcion',
    opcionClave: primero.opcionClave,
    evento: esExacto ? 'texto_exacto' : 'texto_similar',
    meta: meta(primero.intentKey, confianza, source, matchType),
    terminos,
  };
}
