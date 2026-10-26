/**
 * Tests del motor de interpretación de consultas escritas, de punta a punta
 * contra la base de prueba.
 *
 * Verifican los desenlaces posibles y que nunca se emita una respuesta
 * inventada: el motor devuelve una opción del menú, pide aclaración con opciones
 * reales, o informa que no hay información.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Debe ir primero: fija DATABASE_URL de prueba antes de cargar la aplicación.
import { prepararBasePrueba, cerrarBasePrueba } from './entorno-prueba.js';
import { interpretarConsulta, MENSAJE_NO_DISPONIBLE } from '../src/services/nl.service.js';

before(async () => {
  await prepararBasePrueba();
});

after(async () => {
  await cerrarBasePrueba();
});

test('una consulta que coincide exactamente devuelve la opción del menú', async () => {
  const r = await interpretarConsulta('programa de ABD');
  assert.equal(r.clase, 'opcion');
  if (r.clase === 'opcion') {
    assert.equal(r.opcionClave, 'ABD_OP_PROG');
    assert.equal(r.evento, 'texto_exacto');
    assert.equal(r.meta.matchType, 'exacto');
  }
});

test('un error de tipeo se resuelve por similitud', async () => {
  const r = await interpretarConsulta('condiciones de aprobacon de abd');
  assert.equal(r.clase, 'opcion');
  if (r.clase === 'opcion') {
    assert.equal(r.opcionClave, 'ABD_OP_COND');
    assert.equal(r.evento, 'texto_similar');
  }
});

test('una consulta ambigua pide aclaración con opciones reales del menú', async () => {
  const r = await interpretarConsulta('abd');
  assert.equal(r.clase, 'aclaracion');
  if (r.clase === 'aclaracion') {
    const claves = r.aclaracion.opciones.map((o) => o.clave).sort();
    assert.deepEqual(claves, ['ABD_OP_COND', 'ABD_OP_PROG']);
  }
});

test('un saludo devuelve el menú raíz, sin buscar en la base de conocimiento', async () => {
  const r = await interpretarConsulta('hola');
  assert.equal(r.clase, 'nodo');
  if (r.clase === 'nodo') {
    assert.equal(r.nodo.categoria.clave, 'RAIZ');
  }
});

test('una consulta fuera del dominio informa que no hay información', async () => {
  const r = await interpretarConsulta('clima mañana en la costa');
  assert.equal(r.clase, 'no_disponible');
  if (r.clase === 'no_disponible') {
    assert.equal(r.mensaje, MENSAJE_NO_DISPONIBLE);
  }
});
