/**
 * Evalúa los casos generados (o un conjunto dorado con el mismo formato) contra
 * el motor de texto libre, usando la base configurada en `DATABASE_URL`.
 *
 *   npm run casos:evaluar --workspace backend
 *
 * Clasifica cada caso y muestra un resumen por tipo de transformación. Los
 * fallos quedan en `test/casos/salida/fallos.json`.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { closePool } from '../../src/db/pool.js';
import { interpretarConsulta } from '../../src/services/nl.service.js';
import type { Caso } from './generar-casos.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const entrada = join(aqui, 'salida', 'casos.json');
const salidaFallos = join(aqui, 'salida', 'fallos.json');

type Resultado = 'acierto' | 'aclaracion_incluye' | 'aclaracion_no_incluye' | 'no_disponible' | 'opcion_incorrecta' | 'otro';

async function clasificar(caso: Caso): Promise<{ resultado: Resultado; detalle: string }> {
  const r = await interpretarConsulta(caso.consulta);
  switch (r.clase) {
    case 'opcion':
      return r.opcionClave === caso.opcionEsperada
        ? { resultado: 'acierto', detalle: r.opcionClave }
        : { resultado: 'opcion_incorrecta', detalle: r.opcionClave };
    case 'aclaracion': {
      const claves = r.aclaracion.opciones.map((o) => o.clave);
      return claves.includes(caso.opcionEsperada)
        ? { resultado: 'aclaracion_incluye', detalle: claves.join(', ') }
        : { resultado: 'aclaracion_no_incluye', detalle: claves.join(', ') };
    }
    case 'no_disponible':
      return { resultado: 'no_disponible', detalle: '' };
    default:
      return { resultado: 'otro', detalle: r.clase };
  }
}

const pct = (n: number, total: number): string => (total === 0 ? '—' : `${((100 * n) / total).toFixed(0)}%`);

async function main(): Promise<void> {
  const casos = JSON.parse(readFileSync(entrada, 'utf8')) as Caso[];
  const porTransformacion = new Map<string, Record<Resultado, number>>();
  const fallos: Array<Caso & { resultado: Resultado; detalle: string }> = [];

  for (const caso of casos) {
    const { resultado, detalle } = await clasificar(caso);
    const conteo = porTransformacion.get(caso.transformacion) ?? {
      acierto: 0, aclaracion_incluye: 0, aclaracion_no_incluye: 0, no_disponible: 0, opcion_incorrecta: 0, otro: 0,
    };
    conteo[resultado] += 1;
    porTransformacion.set(caso.transformacion, conteo);
    if (resultado !== 'acierto') fallos.push({ ...caso, resultado, detalle });
  }

  console.log(`\nCasos evaluados: ${casos.length}\n`);
  console.log('transformación         total  acierto  aclar.ok  aclar.NO  no_disp  opción_mal');
  for (const [nombre, c] of porTransformacion) {
    const total = Object.values(c).reduce((a, b) => a + b, 0);
    console.log(
      `${nombre.padEnd(22)} ${String(total).padStart(5)}  ${pct(c.acierto, total).padStart(7)}  ${pct(c.aclaracion_incluye, total).padStart(8)}  ${pct(c.aclaracion_no_incluye, total).padStart(8)}  ${pct(c.no_disponible, total).padStart(7)}  ${pct(c.opcion_incorrecta, total).padStart(10)}`,
    );
  }

  mkdirSync(dirname(salidaFallos), { recursive: true });
  writeFileSync(salidaFallos, JSON.stringify(fallos, null, 2), 'utf8');
  console.log(`\nFallos: ${fallos.length} (detalle en ${salidaFallos})`);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
    .catch((err) => {
      console.error('[evaluar] error:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
