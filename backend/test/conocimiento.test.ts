/**
 * Tests de la base de conocimiento (búsqueda exacta y por similitud) contra la
 * base de prueba, con los fixtures cargados.
 *
 * Verifican que la ambigüedad se preserve: una variante compartida por dos
 * intenciones tiene que devolver las dos, para que el motor pida aclaración.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Debe ir primero: fija DATABASE_URL de prueba antes de cargar la aplicación.
import { prepararBasePrueba, cerrarBasePrueba } from './entorno-prueba.js';
import { buscarExacto, buscarSimilares } from '../src/db/conocimiento.js';
import { normalizar } from '../src/utils/normalizar.js';

before(async () => {
  await prepararBasePrueba();
});

after(async () => {
  await cerrarBasePrueba();
});

const intenciones = (c: Array<{ intentKey: string }>): string[] =>
  [...new Set(c.map((x) => x.intentKey))].sort();

test('una variante exacta devuelve solo su intención', async () => {
  const c = await buscarExacto(normalizar('programa de ABD'));
  assert.deepEqual(intenciones(c), ['programa_ABD']);
});

test('una variante compartida por dos intenciones devuelve las dos (aclaración)', async () => {
  const c = await buscarExacto(normalizar('abd'));
  assert.deepEqual(intenciones(c), ['condiciones_ABD', 'programa_ABD']);
});

test('una consulta sin coincidencia exacta no devuelve nada en la búsqueda exacta', async () => {
  const c = await buscarExacto(normalizar('clima mañana'));
  assert.equal(c.length, 0);
});

test('la búsqueda por similitud encuentra una variante con errores de tipeo', async () => {
  const c = await buscarSimilares(normalizar('condiciones de aprobacon de abd'), 0.7);
  assert.ok(intenciones(c).includes('condiciones_ABD'));
});

test('la similitud respeta el mínimo: por debajo no devuelve candidatos', async () => {
  const c = await buscarSimilares(normalizar('clima mañana'), 0.7);
  assert.equal(c.length, 0);
});

test('cada candidato trae la opción del menú a la que apunta', async () => {
  const c = await buscarExacto(normalizar('programa de ABD'));
  assert.equal(c[0]?.opcionClave, 'ABD_OP_PROG');
});
