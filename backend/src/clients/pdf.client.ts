/**
 * Cliente de PDF: lee las líneas de texto de un PDF, en orden de lectura.
 * Usa pdfjs-dist (JavaScript puro, sin binarios). 
 * No decide secciones: eso lo hace * `lib/secciones.ts`.
 */

import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { LineaPdf } from '../lib/secciones.js';

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

