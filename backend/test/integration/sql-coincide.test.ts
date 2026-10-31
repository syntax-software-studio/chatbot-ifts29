/**
 * El SQL de la aplicación debe existir en el esquema.
 *
 * Estos tests cruzan el SQL de `db/*.ts` contra los DDL de `db/*.sql` para que
 * ese error aparezca en `npm test`, sin base de datos.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..', '..');
const leer = (ruta: string) => readFile(join(raiz, ruta), 'utf8');

/** tablas -> columnas, segun los `CREATE TABLE` de los DDL. */
async function esquema(): Promise<Map<string, Set<string>>> {
  const tablas = new Map<string, Set<string>>();
  for (const archivo of ['db/001_schema.sql']) {
    const sql = await leer(archivo);
    for (const m of sql.matchAll(
      /CREATE TABLE(?: IF NOT EXISTS)?\s+(\w+)\s*\(([\s\S]*?)\n\);/g,
    )) {
      const [, tabla, cuerpo] = m;
      const columnas = new Set<string>();
      for (const linea of cuerpo.split('\n')) {
        const col = linea.trim().split(/\s+/)[0]?.toLowerCase();
        if (col && /^[a-z_][a-z0-9_]*$/.test(col)) columnas.add(col);
      }
      tablas.set(tabla!.toLowerCase(), columnas);
    }
  }
  return tablas;
}

/**
 * alias -> tabla, para un archivo. Si un alias se usa con mas de una tabla
 * (subconsultas anidadas) se descarta: no se puede resolver sin analisis.
 */
function aliasDe(sql: string): Map<string, Set<string>> {
  const mapa = new Map<string, Set<string>>();
  const agregar = (alias: string | undefined, tabla: string) => {
    if (!alias) return;
    const set = mapa.get(alias.toLowerCase()) ?? new Set<string>();
    set.add(tabla.toLowerCase());
    mapa.set(alias.toLowerCase(), set);
  };

  for (const m of sql.matchAll(/\b(?:FROM|JOIN)\s+(\w+)(?:\s+(?:AS\s+)?(\w+))?/gi)) {
    const [, tabla, alias] = m;
    if (!tabla || /^(SELECT|VALUES|ON)$/i.test(tabla)) continue;
    // `FROM (VALUES ...) AS d(...)` y `FROM generate_series(...)` no son tablas.
    if (tabla.includes('(')) continue;
    agregar(alias, tabla);
  }
  return mapa;
}

const consultas = async (): Promise<Array<[string, string]>> => {
  const archivos = ['backend/src/repositories/chat-menu.repository.ts', 'backend/src/repositories/kb-conocimiento.repository.ts'];
  const salida: Array<[string, string]> = [];
  for (const archivo of archivos) {
    const fuente = await leer(archivo);
    // Solo las sentencias SQL: los bloques `` ... `` y las constantes con SQL.
    for (const m of fuente.matchAll(/`([^`]*\b(?:SELECT|INSERT|UPDATE|DELETE)\b[^`]*)`/g)) {
      salida.push([archivo, m[1]!]);
    }
  }
  return salida;
};

test('cada columna usada por el SQL de la app existe en el esquema', async () => {
  const tablas = await esquema();
  const problemas: string[] = [];

  for (const [archivo, sql] of await consultas()) {
    const alias = aliasDe(sql);
    for (const m of sql.matchAll(/\b(\w+)\.(\w+)\b/g)) {
      const [, a, columna] = m;
      const destino = alias.get(a!.toLowerCase());
      // Alias ambiguo o desconocido: se ignora (subconsultas, CTE, funciones).
      if (!destino || destino.size !== 1) continue;
      const [tabla] = [...destino];
      const columnas = tablas.get(tabla!);
      if (!columnas) continue;
      if (!columnas.has(columna!.toLowerCase())) {
        problemas.push(
          `${archivo}: "${a}.${columna}" no existe (tabla ${tabla}). ` +
            `Columnas: ${[...columnas].slice(0, 8).join(', ')}...`,
        );
      }
    }
  }

  assert.deepEqual([...new Set(problemas)], [], 'SQL con columnas inexistentes');
});

test('el DDL y las migraciones no tienen BOM', async () => {
  // Un BOM invisible rompe `psql -f` con un error de sintaxis.
  for (const archivo of ['db/001_schema.sql', 'db/003_verificacion.sql']) {
    const sql = await leer(archivo);
    assert.equal(sql.charCodeAt(0) === 0xfeff, false, `${archivo} arranca con BOM`);
  }
});

test('las verificaciones de v_kb_resolucion usan columnas reales', async () => {
  // `v_kb_resolucion` se usa en 003_verificacion.sql: si el nombre de una
  // columna cambia en el DDL, la verificacion falla en la maquina del equipo.
  const tablas = await esquema();
  const ddl = await leer('db/001_schema.sql');
  const definicion = /CREATE OR REPLACE VIEW v_kb_resolucion AS([\s\S]*?);\s*$/m.exec(ddl);
  assert.ok(definicion, 'no se encontro la definicion de v_kb_resolucion');

  const kb = new Map<string, Set<string>>();
  for (const tabla of ['kb_intencion', 'kb_pregunta', 'kb_pregunta_variante']) {
    kb.set(tabla, tablas.get(tabla)!);
  }

  const verificacion = await leer('db/003_verificacion.sql');
  const uso = [...verificacion.matchAll(/FROM\s+(v_kb_resolucion)\b([\s\S]*?);/g)];
  assert.ok(uso.length > 0, 'la verificacion deberia consultar v_kb_resolucion');

  const aliases = aliasDe(definicion[1]!);
  for (const m of definicion[1]!.matchAll(/\b(\w+)\.(\w+)\b/g)) {
    const destino = aliases.get(m[1]!.toLowerCase());
    if (!destino || destino.size !== 1) continue;
    const columnas = kb.get([...destino][0]!);
    if (!columnas) continue;
    assert.ok(
      columnas.has(m[2]!.toLowerCase()),
      `v_kb_resolucion usa ${m[1]}.${m[2]}, que no existe en ${[...destino][0]}`,
    );
  }
});