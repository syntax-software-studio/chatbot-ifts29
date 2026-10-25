/**
 * Carga el esquema y el contenido inicial en Neon.
 *
 *   npm run db:push            -> aplica 001_schema.sql (menu + base de
 *                                 conocimiento) + 002_seed.sql + 005_kb_seed.sql
 *   npm run db:reset           -> borra el esquema antes de aplicar
 *   DATABASE_URL=... npm run db:push
 *
 * Es idempotente: ambos scripts usan `CREATE ... IF NOT EXISTS` y
 * `ON CONFLICT DO UPDATE`, así que se pueden volver a ejecutar sin riesgo.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getPool, closePool, query } from './pool.js';
import { env } from '../utils/env.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const carpetaSql = join(aqui, '..', '..', '..', 'db');

const reset = process.argv.includes('--reset');

/**
 * Divide un script SQL en sentencias individuales.
 *
 * No basta con partir por `;`: los triggers y el `DO` block de
 * `001_schema.sql` usan cuerpos `$$ ... $$` que contienen punto y coma, y los
 * literales de texto pueden traer comillas simples escapadas. Se recorre el
 * script respetando:
 *   - literales `'...'`  (con `''` como escape)
 *   - identificadores `"..."`
 *   - cuerpos dollar-quoted `$tag$ ... $tag$`
 *   - comentarios de línea `--` y de bloque `/* ... *\/`
 *
 * Se usa solo en el camino de diagnóstico (ver `ejecutar`): en el camino
 * rápido el archivo entero viaja como una sola consulta multi-sentencia.
 */
export function dividirSentencias(sql: string): string[] {
  const sentencias: string[] = [];
  let actual = '';
  let i = 0;

  const n = sql.length;
  while (i < n) {
    const c = sql[i]!;

    // Cuerpo dollar-quoted: $tag$ ... $tag$
    if (c === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[0];
        const cierre = sql.indexOf(tag, i + tag.length);
        const fin = cierre === -1 ? n : cierre + tag.length;
        actual += sql.slice(i, fin);
        i = fin;
        continue;
      }
    }

    // Comentarios de línea y de bloque: se descartan.
    if (c === '-' && sql[i + 1] === '-') {
      const fin = sql.indexOf('\n', i);
      i = fin === -1 ? n : fin;
      continue;
    }
    if (c === '/' && sql[i + 1] === '*') {
      const fin = sql.indexOf('*/', i + 2);
      i = fin === -1 ? n : fin + 2;
      continue;
    }

    // Literales e identificadores: se copian enteros, sin buscar separadores.
    if (c === "'" || c === '"') {
      const cierre = c;
      let j = i + 1;
      while (j < n) {
        if (sql[j] === '\\') {
          j += 2;
          continue;
        }
        if (sql[j] === cierre) {
          // Doble comilla es escape, no cierre.
          if (sql[j + 1] === cierre) {
            j += 2;
            continue;
          }
          j += 1;
          break;
        }
        j += 1;
      }
      actual += sql.slice(i, j);
      i = j;
      continue;
    }

    if (c === ';') {
      const t = actual.trim();
      if (t) sentencias.push(t);
      actual = '';
      i += 1;
      continue;
    }

    actual += c;
    i += 1;
  }

  const ultima = actual.trim();
  if (ultima) sentencias.push(ultima);
  return sentencias;
}

const ES_BEGIN = /^(BEGIN|START\s+TRANSACTION)$/i;
const ES_COMMIT = /^(COMMIT|END|ROLLBACK)$/i;

const describeError = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

/** Limitacion conocida del driver HTTP de Neon, no un error del script. */
const esErrorDeVariasSentencias = (err: unknown): boolean =>
  /cannot insert multiple commands into a prepared statement/i.test(describeError(err));

/**
 * Saca el envoltorio transaccional de un script para poder aplicar sus
 * sentencias de forma independiente.
 *
 * `002_seed.sql` viene envuelto en `BEGIN; ... COMMIT;`. Si una sentencia
 * fallara dentro de una transacción explícita, PostgreSQL aborta el resto de la
 * transacción y cada sentencia posterior fallaría con "current transaction is
 * aborted", enmascarando el error real. En el camino de diagnóstico cada
 * sentencia se ejecuta por separado, así que el envoltorio se descarta.
 */
function sinEnvoltorioTransaccional(sentencias: string[]): string[] {
  if (sentencias.length < 2) return sentencias;
  const primera = sentencias[0]!;
  const ultima = sentencias[sentencias.length - 1]!;
  if (ES_BEGIN.test(primera) && ES_COMMIT.test(ultima)) {
    return sentencias.slice(1, -1);
  }
  return sentencias;
}

/**
 * Aplica un script SQL.
 *
 * Camino rápido: una sola consulta multi-sentencia (un round trip), con la
 * transacción del propio script. Si el driver HTTP la rechaza, se reintenta
 * sentencia por sentencia para poder nombrar exactamente cuál falló, en lugar
 * de un error genérico.
 */
async function ejecutar(sql: string, etiqueta: string): Promise<void> {
  const s = getPool();
  if (!s) throw new Error('DATABASE_URL no configurada.');
  console.log(`[db] aplicando ${etiqueta}...`);

  try {
    await s.query(sql);
    console.log(`[db] ${etiqueta} OK`);
  } catch (err) {
    // Respaldo: si una consulta multi-sentencia falla, se aplica sentencia por
    // sentencia para nombrar cuál falló. Con `pg` el camino rápido normalmente
    // funciona; este respaldo se puede retirar cuando se confirme.
    const sentencias = sinEnvoltorioTransaccional(dividirSentencias(sql));
    console.log(
      `[db] ${etiqueta}: se aplica sentencia por sentencia (${sentencias.length})...` +
        (esErrorDeVariasSentencias(err) ? '' : ` Motivo: ${describeError(err)}`),
    );
    for (const [n, sentencia] of sentencias.entries()) {
      try {
        await s.query(sentencia);
      } catch (err2) {
        const resumen = sentencia.replace(/\s+/g, ' ').slice(0, 160);
        throw new Error(
          `${etiqueta}: falló la sentencia ${n + 1}/${sentencias.length}\n` +
            `  ${resumen}\n` +
            `  ${err2 instanceof Error ? err2.message : String(err2)}`,
        );
      }
    }
    console.log(`[db] ${etiqueta} OK (${sentencias.length} sentencias)`);
  }
}

async function main(): Promise<void> {
  if (!env.databaseUrl) {
    console.error(
      '\n  DATABASE_URL no configurada.\n' +
        '  Copiá la URL de conexión de Neon a un archivo .env en la raíz y reintentá.\n' +
        '  (Neon Console -> Connection Details -> Connection string)\n',
    );
    process.exitCode = 1;
    return;
  }

  if (reset) {
    console.log('[db] --reset: eliminando el esquema public...');
    await ejecutar('DROP SCHEMA public CASCADE; CREATE SCHEMA public;', 'reset');
  }

  await ejecutar(await readFile(join(carpetaSql, '001_schema.sql'), 'utf8'), '001_schema.sql');
  await ejecutar(await readFile(join(carpetaSql, '002_seed.sql'), 'utf8'), '002_seed.sql');
  await ejecutar(await readFile(join(carpetaSql, '005_kb_seed.sql'), 'utf8'), '005_kb_seed.sql');

  const r = await query<{
    categoria: number;
    opcion: number;
    respuesta: number;
    documento: number;
    contacto: number;
    kb_intencion: number;
    kb_pregunta: number;
    kb_variante: number;
  }>(
    `SELECT
       (SELECT count(*)::int FROM categoria WHERE activo)     AS categoria,
       (SELECT count(*)::int FROM opcion_menu WHERE activo)   AS opcion,
       (SELECT count(*)::int FROM respuesta WHERE activo)     AS respuesta,
       (SELECT count(*)::int FROM documento)                   AS documento,
       (SELECT count(*)::int FROM contacto WHERE activo)      AS contacto,
       (SELECT count(*)::int FROM kb_intencion WHERE activo)   AS kb_intencion,
       (SELECT count(*)::int FROM kb_pregunta WHERE activo)    AS kb_pregunta,
       (SELECT count(*)::int FROM kb_pregunta_variante WHERE activo) AS kb_variante`,
  );

  console.log('\n[db] contenido cargado:');
  console.table(r.rows);
  console.log('\n  Siguiente paso: ejecutar la sincronización con Drive ->  POST /api/sync\n');
}

// Solo se ejecuta si el archivo se invoca directamente (`npm run db:push`),
// no al importarlo: asi `dividirSentencias` se puede testear de forma aislada.
// Se normalizan los separadores porque en Windows `process.argv[1]` trae
// barras invertidas y `fileURLToPath` tambien: compararlos sin normalizar
// haria que el script no corriera nunca, en silencio.
const normalizar = (ruta: string): string => ruta.replace(/\\/g, '/');

const invocadoDirectamente =
  process.argv[1] !== undefined &&
  normalizar(fileURLToPath(import.meta.url)) === normalizar(process.argv[1]);

if (invocadoDirectamente) {
  main()
    .catch((err) => {
      console.error('[db] error:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
