/**
 * Flujo del chat con documentos por comisión, contra la base de prueba.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { prepararBasePrueba, cerrarBasePrueba } from '../../../test/helpers/entorno-prueba.js';
import { procesarSeleccion, MENSAJE_COMISION } from '../chat.service.js';

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
