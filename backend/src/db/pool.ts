/**
 * Acceso a PostgreSQL con `pg` (node-postgres).
 *
 * Un solo driver para todos los entornos: la misma `DATABASE_URL` sirve para
 * el PostgreSQL local de Docker y para Neon (que acepta conexión estándar con
 * SSL, `?sslmode=require`). `pg` soporta SCRAM-SHA-256, que es el método de
 * autenticación de Neon.
 *
 * Si no hay `DATABASE_URL`, `getPool()` devuelve `null` y la capa de datos usa
 * el catálogo semilla local (modo demo).
 */

import { Pool } from 'pg';
import { env, hasDatabase } from '../utils/env.js';

let pool: Pool | null = null;
let warned = false;

export function getPool(): Pool | null {
  if (!hasDatabase()) return null;
  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      // Pocas conexiones: la API atiende peticiones cortas, y el límite del
      // plan de Neon es bajo.
      max: 5,
    });
  }
  return pool;
}

export interface Resultado<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Consulta parametrizada. Todas las llamadas del proyecto usan parámetros
 * `$1..$n`: no se concatena SQL con valores entrantes.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<Resultado<T>> {
  const p = getPool();
  if (!p) {
    throw new Error('DATABASE_URL no configurada: se debe usar la capa de catálogo con semilla.');
  }

  const resultado = await p.query(text, params);
  return { rows: resultado.rows as T[], rowCount: resultado.rowCount ?? resultado.rows.length };
}

/** Comprueba conectividad y existencia del esquema. */
export async function checkDatabase(): Promise<{ ok: boolean; detalle?: string }> {
  const p = getPool();
  if (!p) return { ok: false, detalle: 'DATABASE_URL no configurada (modo semilla)' };

  try {
    await p.query('SELECT 1');
    const r = await query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name IN ('categoria','opcion_menu','respuesta','documento','contacto','contexto')`,
    );
    const total = r.rows[0]?.n ?? 0;
    if (total < 6) {
      return {
        ok: true,
        detalle: `Esquema incompleto: ${total}/6 tablas. Ejecutar db/001_schema.sql y db/002_seed.sql.`,
      };
    }
    return { ok: true, detalle: 'Esquema completo' };
  } catch (err) {
    return { ok: false, detalle: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/** Cierra las conexiones del pool (scripts y tests). */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export function logDbMode(): void {
  if (hasDatabase()) {
    console.log('[db] origen de datos: PostgreSQL (pg)');
  } else if (!warned) {
    warned = true;
    console.warn('[db] DATABASE_URL no configurada -> usando catálogo semilla local (modo demo).');
  }
}
