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
import { prepararBasePrueba, cerrarBasePrueba } from '../../../test/helpers/entorno-prueba.js';
import { procesarConsulta } from '../chat.service.js';
import { interpretarConsulta, MENSAJE_NO_DISPONIBLE } from '../kb.service.js';

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

test('un saludo se reconoce sin buscar en la base de conocimiento (el chat arma el menú raíz)', async () => {
  const r = await interpretarConsulta('hola');
  assert.equal(r.clase, 'saludo');
});

test('un saludo, en el chat, devuelve el menú raíz', async () => {
  const turno = await procesarConsulta('hola');
  assert.equal(turno.tipo, 'nodo');
  if (turno.tipo === 'nodo') {
    assert.equal(turno.nodo.categoria.clave, 'RAIZ');
  }
});

test('una consulta fuera del dominio informa que no hay información', async () => {
  const r = await interpretarConsulta('clima mañana en la costa');
  assert.equal(r.clase, 'no_disponible');
  if (r.clase === 'no_disponible') {
    assert.equal(r.mensaje, MENSAJE_NO_DISPONIBLE);
  }
});

/* ==========================================================================
 * Cobertura de términos, errores de tipeo y temas fuera de ABD
 * ======================================================================== */

test('una palabra suelta de un tema resuelve directo a su opción', async () => {
  const r = await interpretarConsulta('foro');
  assert.equal(r.clase, 'opcion');
  if (r.clase === 'opcion') assert.equal(r.opcionClave, 'SIUC_OP_FOROS');
});

test('reglamento resuelve directo a la opción de normativa', async () => {
  const r = await interpretarConsulta('reglamento');
  assert.equal(r.clase, 'opcion');
  if (r.clase === 'opcion') assert.equal(r.opcionClave, 'NORM_OP_REGL');
});

test('entrega de documentación resuelve a Trámites, no a Derivación', async () => {
  const r = await interpretarConsulta('entrega de documentacion');
  assert.equal(r.clase, 'opcion');
  if (r.clase === 'opcion') assert.equal(r.opcionClave, 'TRAM_OP_ENTREGA');
});

test('las palabras de ruido no impiden responder', async () => {
  const r = await interpretarConsulta('para aprobar abd necesito');
  assert.equal(r.clase, 'opcion');
  if (r.clase === 'opcion') assert.equal(r.opcionClave, 'ABD_OP_COND');
});

test('el plural cubre el término por stemming', async () => {
  const r = await interpretarConsulta('programas de abd');
  assert.equal(r.clase, 'opcion');
  if (r.clase === 'opcion') assert.equal(r.opcionClave, 'ABD_OP_PROG');
});

test('un error de tipeo en una palabra apunta a la intención correcta', async () => {
  // Con dos términos un typo baja la cobertura bajo el umbral alto, así que
  // puede pedir aclaración. Lo que se verifica es que la opción correcta esté.
  const r = await interpretarConsulta('condicones de abd');
  if (r.clase === 'opcion') assert.equal(r.opcionClave, 'ABD_OP_COND');
  else {
    assert.equal(r.clase, 'aclaracion');
    if (r.clase === 'aclaracion') {
      assert.ok(r.aclaracion.opciones.some((o) => o.clave === 'ABD_OP_COND'));
    }
  }
});
