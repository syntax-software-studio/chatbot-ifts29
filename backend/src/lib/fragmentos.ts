/**
 * Extracción de secciones de un PDF, para la búsqueda de pasajes (ver
 * docs/desarrollo-e-integracion/08-extractos-de-documentos.md).
 *
 * Recibe los bytes del archivo y devuelve fragmentos: un fragmento por sección,
 * con el título que la encabeza. Es independiente de la fuente: los bytes pueden
 * venir de Drive o de una prueba. No escribe en la base.
 *
 * La detección de títulos combina:
 *  1. títulos de la lista de reconocimiento (pestaña `reconocimiento_fragmentos`),
 *     comparados con tolerancia a errores de tipeo (similitud por bigramas);
 *  2. títulos al inicio de línea seguidos de `:` (por ejemplo "FINAL: ...");
 *  3. encabezados en mayúsculas, cortos y sin viñetas ni datos de tabla.
 */

import { createHash } from 'node:crypto';
import { normalizar } from './normalizar.js';

const bigramas = (s: string): Set<string> => {
  const t = ` ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
};

/** Coeficiente de Dice sobre bigramas: tolera errores de tipeo. */
function similitudBigramas(a: string, b: string): number {
  const A = bigramas(a);
  const B = bigramas(b);
  let comunes = 0;
  for (const x of A) if (B.has(x)) comunes++;
  return (2 * comunes) / (A.size + B.size);
}

/**
 * Título reconocido si el texto es uno de la lista (no una oración que lo contiene).
 * La lista llega normalizada al cargarse (ver sync-transform).
 */
export function tituloConocido(texto: string, titulos: readonly string[]): string | null {
  const t = texto.trim();
  // Un título no termina en punto ni empieza con viñeta.
  if (/[.;,]$/.test(t) || /^[●○•·-]/.test(t)) return null;
  const n = normalizar(t);
  if (!n) return null;
  let mejor = { score: 0, titulo: '' };
  for (const c of titulos) {
    const sc = similitudBigramas(n, c);
    if (sc > mejor.score) mejor = { score: sc, titulo: c };
  }
  if (mejor.score >= 0.8 && n.length <= mejor.titulo.length + 8) return mejor.titulo;
  return null;
}

/** Encabezado en mayúsculas: corto, con letras suficientes, sin viñetas ni datos de tabla. */
export function esEncabezadoMayusculas(t: string): boolean {
  return t === t.toUpperCase()
    && t.length <= 40
    && (t.match(/[A-ZÁÉÍÓÚÑ]/g) ?? []).length >= 5
    && !/[●○•/|°\d]/.test(t);
}

/**
 * Huella de la extracción: el md5 del PDF más la lista de títulos. Si cambia
 * cualquiera de los dos, los fragmentos guardados ya no corresponden y hay que
 * volver a extraer.
 */
export function firmaExtraccion(md5: string, titulos: readonly string[]): string {
  return createHash('md5').update(`${md5}\n${[...titulos].sort().join('\n')}`).digest('hex');
}

export interface LineaPdf {
  text: string;
  page: number;
}

export interface Fragmento {
  /** Título que encabeza la sección (vacío si el texto está antes del primer título). */
  titulo: string;
  /** Texto de la sección, sin el título. */
  texto: string;
}

/** Parte las líneas en fragmentos por título. Pura: se prueba sin PDF. */
export function fragmentar(lineas: LineaPdf[], titulos: readonly string[]): Fragmento[] {
  const fragmentos: Array<{ titulo: string; cuerpo: string[] }> = [];
  let actual: { titulo: string; cuerpo: string[] } = { titulo: '', cuerpo: [] };

  const cerrar = () => {
    if (actual.cuerpo.length > 0 || actual.titulo !== '') fragmentos.push(actual);
  };

  for (const l of lineas) {
    const t = l.text;
    // 1. La línea entera es un título reconocido.
    let tituloNorm = tituloConocido(t.replace(/\s*:\s*$/, ''), titulos);
    if (t.length <= 70 && tituloNorm) {
      cerrar();
      actual = { titulo: tituloNorm, cuerpo: [] };
      continue;
    }
    // 2. Título al inicio de la línea seguido de `:`.
    const m = /^([^:]{2,60}):\s*(.*)$/.exec(t);
    tituloNorm = m ? tituloConocido(m[1]!, titulos) : null;
    if (tituloNorm) {
      cerrar();
      actual = { titulo: tituloNorm, cuerpo: m![2] ? [m![2]] : [] };
      continue;
    }
    // 3. Encabezado en mayúsculas.
    if (esEncabezadoMayusculas(t)) {
      cerrar();
      actual = { titulo: normalizar(t), cuerpo: [] };
      continue;
    }
    actual.cuerpo.push(t);
  }
  cerrar();

  return fragmentos.map((f) => ({ titulo: f.titulo, texto: f.cuerpo.join(' ') }));
}
