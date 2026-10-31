/**
 * Extracción de secciones de un PDF, para la búsqueda de pasajes (ver
 * docs/desarrollo-e-integracion/08-extractos-de-documentos.md).
 *
 * Recibe los bytes del archivo y devuelve fragmentos: un fragmento por sección,
 * con el título que la encabeza. Es independiente de la fuente: los bytes pueden
 * venir de Drive o de una prueba. No escribe en la base.
 *
 * La detección de títulos combina:
 *  1. títulos conocidos (lista de trabajo), comparados con tolerancia a errores
 *     de tipeo (similitud por bigramas);
 *  2. títulos al inicio de línea seguidos de `:` (por ejemplo "FINAL: ...");
 *  3. encabezados en mayúsculas, cortos y sin viñetas ni datos de tabla.
 */

import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Carga perezosa de pdfjs-dist, resuelta desde el package.json del backend. */
let pdfjsPromesa: Promise<PdfjsModulo> | null = null;

interface PdfjsModulo {
  getDocument(src: { data: Uint8Array; verbosity?: number; disableFontFace?: boolean }): {
    promise: Promise<PdfDocumento>;
  };
}
interface PdfDocumento {
  numPages: number;
  getPage(n: number): Promise<PdfPagina>;
}
interface PdfPagina {
  getTextContent(): Promise<{ items: Array<{ str?: string; transform: number[] }> }>;
}

function cargarPdfjs(): Promise<PdfjsModulo> {
  pdfjsPromesa ??= (async () => {
    const aqui = path.dirname(fileURLToPath(import.meta.url));
    const req = createRequire(path.resolve(aqui, '..', '..', 'package.json'));
    const url = pathToFileURL(req.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href;
    return (await import(url)) as PdfjsModulo;
  })();
  return pdfjsPromesa;
}

/** Forma comparable: sin tildes, minúsculas, sin signos. */
export function normalizarTexto(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Títulos que aparecen en los documentos de las materias (lista de trabajo). */
export const TITULOS_CONOCIDOS = [
  'fundamentacion', 'presentacion', 'objetivo de la materia', 'objetivos de la materia',
  'objetivos de aprendizaje', 'objetivos especificos', 'recorridos', 'unidades tematicas',
  'contenidos minimos', 'bibliografia', 'formas y criterios de evaluacion',
  'metodologia de ensenanza y aprendizaje', 'regimen de cursada y evaluacion',
  'condiciones de regularizacion de la cursada', 'condiciones de aprobacion de la materia',
  'promocion', 'final', 'cronograma',
] as const;

const bigramas = (s: string): Set<string> => {
  const t = ` ${s} `;
  const set = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) set.add(t.slice(i, i + 2));
  return set;
};

/** Coeficiente de Dice sobre bigramas: tolera errores de tipeo. */
export function similitudBigramas(a: string, b: string): number {
  const A = bigramas(a);
  const B = bigramas(b);
  let comunes = 0;
  for (const x of A) if (B.has(x)) comunes++;
  return (2 * comunes) / (A.size + B.size);
}

/** Título conocido si el texto es ese título (no una oración que lo contiene). */
export function tituloConocido(texto: string): string | null {
  const t = texto.trim();
  // Un título no termina en punto ni empieza con viñeta.
  if (/[.;,]$/.test(t) || /^[●○•·-]/.test(t)) return null;
  const n = normalizarTexto(t);
  if (!n) return null;
  let mejor = { score: 0, titulo: '' };
  for (const c of TITULOS_CONOCIDOS) {
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
export function fragmentar(lineas: LineaPdf[]): Fragmento[] {
  const fragmentos: Array<{ titulo: string; cuerpo: string[] }> = [];
  let actual: { titulo: string; cuerpo: string[] } = { titulo: '', cuerpo: [] };

  const cerrar = () => {
    if (actual.cuerpo.length > 0 || actual.titulo !== '') fragmentos.push(actual);
  };

  for (const l of lineas) {
    const t = l.text;
    // 1. La línea entera es un título conocido.
    if (t.length <= 70 && tituloConocido(t.replace(/\s*:\s*$/, ''))) {
      cerrar();
      actual = { titulo: t, cuerpo: [] };
      continue;
    }
    // 2. Título al inicio de la línea seguido de `:`.
    const m = /^([^:]{2,60}):\s*(.*)$/.exec(t);
    if (m && tituloConocido(m[1]!)) {
      cerrar();
      actual = { titulo: m[1]!.trim(), cuerpo: m[2] ? [m[2]] : [] };
      continue;
    }
    // 3. Encabezado en mayúsculas.
    if (esEncabezadoMayusculas(t)) {
      cerrar();
      actual = { titulo: t, cuerpo: [] };
      continue;
    }
    actual.cuerpo.push(t);
  }
  cerrar();

  return fragmentos.map((f) => ({ titulo: f.titulo, texto: f.cuerpo.join(' ') }));
}

/** Lee las líneas de un PDF, en orden de lectura, a partir de sus bytes. */
export async function lineasDePdf(datos: Uint8Array): Promise<LineaPdf[]> {
  const pdfjs = await cargarPdfjs();
  const doc = await pdfjs.getDocument({ data: datos, verbosity: 0, disableFontFace: true }).promise;
  const salida: LineaPdf[] = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const pagina = await doc.getPage(p);
    const contenido = await pagina.getTextContent();
    const items = contenido.items
      .filter((i) => i.str && i.str.trim())
      .map((i) => ({ s: i.str as string, x: i.transform[4] as number, y: Math.round(i.transform[5] as number) }));
    items.sort((a, b) => b.y - a.y || a.x - b.x);
    const filas: Array<{ y: number; partes: typeof items }> = [];
    for (const it of items) {
      const fila = filas.find((r) => Math.abs(r.y - it.y) <= 2);
      if (fila) fila.partes.push(it);
      else filas.push({ y: it.y, partes: [it] });
    }
    for (const fila of filas) {
      fila.partes.sort((a, b) => a.x - b.x);
      salida.push({ text: fila.partes.map((q) => q.s).join(' ').replace(/\s+/g, ' ').trim(), page: p });
    }
  }
  return salida;
}

/**
 * Fragmentos de un PDF. Si no hay texto extraíble (por ejemplo, un PDF de
 * imágenes), devuelve una lista vacía: el documento se muestra completo, como hoy.
 */
export async function extraerFragmentos(datos: Uint8Array): Promise<Fragmento[]> {
  const lineas = await lineasDePdf(datos);
  const conTexto = lineas.filter((l) => l.text.length > 0);
  if (conTexto.length === 0) return [];
  return fragmentar(conTexto).filter((f) => f.texto.length > 0 || f.titulo !== '');
}
