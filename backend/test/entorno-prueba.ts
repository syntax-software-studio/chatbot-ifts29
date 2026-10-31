/**
 * Entorno de los tests de integración: una base PostgreSQL de prueba, separada
 * de la local y de Neon, con el esquema real y los fixtures cargados por el
 * mismo cargador que usa la sincronización.
 *
 * Requiere PostgreSQL corriendo (por ejemplo, `docker compose up -d`). No se
 * conecta a Drive, a Sheets ni a Neon.
 *
 * Importar este módulo PRIMERO en cada test de integración: fija
 * DATABASE_URL antes de que se carguen los módulos de la aplicación.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { Client } from 'pg';

const aqui = dirname(fileURLToPath(import.meta.url));
const esquema = join(aqui, '..', '..', 'db', '001_schema.sql');

const urlBase = process.env.DATABASE_URL_PRUEBA ?? 'postgresql://postgres:password123@localhost:5432/ifts29_test';
process.env.DATABASE_URL = urlBase;

const urlAdmin = (): string => {
  const u = new URL(urlBase);
  u.pathname = '/postgres';
  return u.toString();
};

/**
 * Crea la base de prueba si no existe, reinicia su esquema y carga los fixtures.
 * Cada llamada deja la base en el mismo estado.
 */
export async function prepararBasePrueba(): Promise<void> {
  const nombre = new URL(urlBase).pathname.slice(1);

  const admin = new Client({ connectionString: urlAdmin() });
  try {
    await admin.connect();
  } catch (err) {
    throw new Error(
      `No hay PostgreSQL de prueba en ${urlBase}. Levantá la base con "docker compose up -d" ` +
        `o definí DATABASE_URL_PRUEBA. Detalle: ${err instanceof Error ? err.message : err}`,
    );
  }
  const existe = await admin.query('SELECT 1 FROM pg_database WHERE datname = $1', [nombre]);
  if (existe.rowCount === 0) await admin.query(`CREATE DATABASE "${nombre}"`);
  await admin.end();

  const { getPool } = await import('../src/db/pool.js');
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL de prueba no quedó configurada.');

  await pool.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  await pool.query(await readFile(esquema, 'utf8'));

  const { convertirContenido } = await import('../src/services/sync-transform.service.js');
  const { aplicarContenido } = await import('../src/services/sync-load.service.js');
  const { contenidoPrueba } = await import('./fixtures/contenido.js');
  const conversion = convertirContenido(contenidoPrueba);
  if (!conversion.ok || !conversion.datos) {
    throw new Error(`Los fixtures no son válidos: ${conversion.errores.join('; ')}`);
  }
  await aplicarContenido(conversion.datos);
}

/** Cierra el pool de la aplicación al terminar los tests del archivo. */
export async function cerrarBasePrueba(): Promise<void> {
  const { closePool } = await import('../src/db/pool.js');
  await closePool();
}
