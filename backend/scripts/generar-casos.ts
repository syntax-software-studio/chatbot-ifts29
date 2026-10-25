/**
 * Genera casos de prueba del texto libre a partir de las variantes cargadas en
 * la base. Cada variante produce versiones "como las escribiría un estudiante":
 * sin tildes, con un error de tipeo, sin palabras vacías, en otro orden, en
 * mayúsculas. Cada caso conserva la opción del menú que debería responder.
 *
 *   npm run casos:generar --workspace backend
 *
 * Lee `DATABASE_URL` del entorno y escribe `scripts/salida/casos.json`, que no
 * se versiona: se regenera cada vez que cambia el contenido.
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool, closePool } from '../src/db/pool.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const destino = join(aqui, 'salida', 'casos.json');

export interface Caso {
  consulta: string;
  transformacion: string;
  intencion: string;
  opcionEsperada: string;
  original: string;
}

const PALABRAS_VACIAS = new Set(['de', 'la', 'el', 'en', 'los', 'las', 'del', 'y', 'a', 'al']);

const sinTildes = (t: string): string => t.normalize('NFD').replace(/\p{Diacritic}/gu, '');

/** Intercambia dos letras contiguas de la palabra más larga (error de tipeo típico). */
function conTipeo(t: string): string | null {
  const palabras = t.split(' ');
  const idx = palabras.reduce((mejor, p, i) => (p.length > palabras[mejor]!.length ? i : mejor), 0);
  const p = palabras[idx]!;
  if (p.length < 4) return null;
  const pos = Math.floor(p.length / 2) - 1;
  const cambiada = p.slice(0, pos) + p[pos + 1] + p[pos] + p.slice(pos + 2);
  palabras[idx] = cambiada;
  return palabras.join(' ');
}

function sinPalabrasVacias(t: string): string | null {
  const r = t.split(' ').filter((p) => !PALABRAS_VACIAS.has(p)).join(' ');
  return r && r !== t ? r : null;
}

function enOtroOrden(t: string): string | null {
  const palabras = t.split(' ');
  if (palabras.length < 2) return null;
  return [...palabras].reverse().join(' ');
}

/** Transformaciones sobre el texto ya normalizado (minúsculas, sin signos). */
export function generarVariaciones(textoOriginal: string): Array<{ transformacion: string; consulta: string }> {
  const base = textoOriginal
    .toLowerCase()
    .normalize('NFC')
    .replace(/[?¿!¡.,;:]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const sal: Array<{ transformacion: string; consulta: string }> = [{ transformacion: 'original', consulta: base }];

  const reglas: Array<[string, (t: string) => string | null]> = [
    ['sin_tildes', (t) => (sinTildes(t) !== t ? sinTildes(t) : null)],
    ['tipeo', conTipeo],
    ['sin_palabras_vacias', sinPalabrasVacias],
    ['orden_invertido', enOtroOrden],
    ['mayusculas', (t) => t.toUpperCase()],
  ];
  for (const [nombre, regla] of reglas) {
    const r = regla(base);
    if (r && r !== base) sal.push({ transformacion: nombre, consulta: r });
  }
  // Sin duplicados (una transformación puede dar el mismo texto que otra).
  const vistos = new Set<string>();
  return sal.filter((s) => (vistos.has(s.consulta) ? false : (vistos.add(s.consulta), true)));
}

async function main(): Promise<void> {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL no configurada: no hay variantes para generar casos.');

  const r = await pool.query<{ original_text: string; pregunta: string; intencion: string; opcion: string }>(
    `SELECT v.original_text, p.pregunta, i.clave AS intencion, i.opcion_clave AS opcion
       FROM kb_pregunta_variante v
       JOIN kb_pregunta p ON p.id = v.pregunta_id AND p.activo
       JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
      WHERE v.activo
      ORDER BY i.clave, v.original_text`,
  );

  const casos: Caso[] = [];
  for (const fila of r.rows) {
    for (const v of generarVariaciones(fila.original_text)) {
      casos.push({
        consulta: v.consulta,
        transformacion: v.transformacion,
        intencion: fila.intencion,
        opcionEsperada: fila.opcion,
        original: fila.original_text,
      });
    }
  }

  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, JSON.stringify(casos, null, 2), 'utf8');
  console.log(`[casos] ${r.rows.length} variantes -> ${casos.length} casos en ${destino}`);
}

// Solo se ejecuta como script, no al importar las funciones desde los tests.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch((err) => {
      console.error('[casos] error:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
