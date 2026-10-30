/**
 * Tests de documentos por comisión: lectura del nombre, pregunta de comisión y
 * filtrado del documento elegido.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

// Debe ir primero: fija DATABASE_URL de prueba antes de cargar la aplicación.
import { prepararBasePrueba, cerrarBasePrueba } from './entorno-prueba.js';
import {
  claveConComision,
  comisionDeDocumento,
  comisionesAPreguntar,
  filtrarPorComision,
  separarComision,
} from '../src/utils/comisiones.js';
import { procesarSeleccion, MENSAJE_COMISION } from '../src/services/chat.service.js';

/* ==========================================================================
 * Helpers puros
 * ======================================================================== */

test('el nombre del documento da materia, tipo, comisión y grupo', () => {
  assert.deepEqual(comisionDeDocumento('ABD_condiciones_B_2026_1C'), {
    grupo: 'ABD_condiciones_2026_1C',
    comision: 'B',
  });
});

test('un documento sin comisión no tiene comisión', () => {
  assert.deepEqual(comisionDeDocumento('ABD_programa_2026_1C'), {
    grupo: 'ABD_programa_2026_1C',
    comision: null,
  });
  assert.deepEqual(comisionDeDocumento('GENERAL_reglamento_2026'), {
    grupo: 'GENERAL_reglamento_2026',
    comision: null,
  });
});

test('un nombre fuera de la convención no se interpreta', () => {
  assert.equal(comisionDeDocumento('documento cualquiera'), null);
});

test('la clave de opción por comisión se separa en base y comisión', () => {
  assert.equal(claveConComision('ABD_OP_COND', 'B'), 'ABD_OP_COND@B');
  assert.deepEqual(separarComision('ABD_OP_COND@B'), { base: 'ABD_OP_COND', comision: 'B' });
  assert.deepEqual(separarComision('ABD_OP_COND'), { base: 'ABD_OP_COND', comision: null });
});

test('pregunta comisión sólo cuando un grupo tiene más de una', () => {
  const docs = [{ clave: 'ABD_condiciones_A_2026_1C' }, { clave: 'ABD_condiciones_B_2026_1C' }];
  assert.deepEqual(comisionesAPreguntar(docs), ['A', 'B']);
  assert.deepEqual(comisionesAPreguntar([{ clave: 'ABD_condiciones_A_2026_1C' }]), []);
  assert.deepEqual(comisionesAPreguntar([{ clave: 'ABD_programa_2026_1C' }]), []);
});

test('el filtro deja la comisión elegida y los documentos generales', () => {
  const docs = [
    { clave: 'ABD_programa_2026_1C' },
    { clave: 'ABD_condiciones_A_2026_1C' },
    { clave: 'ABD_condiciones_B_2026_1C' },
  ];
  assert.deepEqual(
    filtrarPorComision(docs, 'B').map((d) => d.clave),
    ['ABD_programa_2026_1C', 'ABD_condiciones_B_2026_1C'],
  );
});

/* ==========================================================================
 * Flujo completo contra la base de prueba
 * ======================================================================== */

before(async () => {
  await prepararBasePrueba();
});

after(async () => {
  await cerrarBasePrueba();
});

test('si la respuesta tiene varias comisiones, pregunta antes de mostrar documentos', async () => {
  const turno = await procesarSeleccion({ opcion: 'ABD_OP_COND' });
  assert.equal(turno.tipo, 'aclaracion');
  if (turno.tipo === 'aclaracion') {
    assert.equal(turno.aclaracion.mensaje, MENSAJE_COMISION);
    assert.deepEqual(
      turno.aclaracion.opciones.map((o) => [o.clave, o.etiqueta]),
      [
        ['ABD_OP_COND@A', 'Comisión A'],
        ['ABD_OP_COND@B', 'Comisión B'],
      ],
    );
  }
});

test('elegida la comisión, muestra sólo su documento', async () => {
  const turno = await procesarSeleccion({ opcion: 'ABD_OP_COND@B' });
  assert.equal(turno.tipo, 'respuesta');
  if (turno.tipo === 'respuesta') {
    assert.deepEqual(
      turno.respuesta.documentos.map((d) => d.clave),
      ['ABD_condiciones_B_2026_1C'],
    );
  }
});

test('una respuesta sin comisiones responde directo con sus documentos', async () => {
  const turno = await procesarSeleccion({ opcion: 'ABD_OP_PROG' });
  assert.equal(turno.tipo, 'respuesta');
  if (turno.tipo === 'respuesta') {
    assert.deepEqual(
      turno.respuesta.documentos.map((d) => d.clave),
      ['ABD_programa_2026_1C'],
    );
  }
});
