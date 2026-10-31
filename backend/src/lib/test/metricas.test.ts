/**
 * Reporte mensual de métricas: calendario, rango y tabla.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { esMesValido, filasATabla, mesAnterior, rangoDelMes } from '../metricas.js';

test('el mes anterior se calcula en calendario, también al cambiar de año', () => {
  assert.equal(mesAnterior(new Date('2026-11-01T06:00:00Z')), '2026-10');
  assert.equal(mesAnterior(new Date('2026-01-01T06:00:00Z')), '2025-12');
});

test('el rango de un mes va desde su primer día hasta el primero del mes siguiente', () => {
  assert.deepEqual(rangoDelMes('2026-10'), { desde: '2026-10-01', hasta: '2026-11-01' });
  assert.deepEqual(rangoDelMes('2026-12'), { desde: '2026-12-01', hasta: '2027-01-01' });
});

test('solo se aceptan meses con formato AAAA-MM', () => {
  assert.equal(esMesValido('2026-10'), true);
  assert.equal(esMesValido('2026-13'), false);
  assert.equal(esMesValido('26-10'), false);
});

test('la tabla lleva cabecera y una fila por registro, con categoría vacía si no hay', () => {
  const tabla = filasATabla([
    { fecha: '2026-10-05', opcion_clave: 'ABD_OP_PROG', categoria_clave: null, evento: 'seleccion', total: 3 },
    { fecha: '2026-10-06', opcion_clave: 'a,"b"', categoria_clave: 'RAIZ', evento: 'texto_exacto', total: 1 },
  ]);
  assert.deepEqual(tabla, [
    ['fecha', 'opcion_clave', 'categoria_clave', 'evento', 'total'],
    ['2026-10-05', 'ABD_OP_PROG', '', 'seleccion', 3],
    ['2026-10-06', 'a,"b"', 'RAIZ', 'texto_exacto', 1],
  ]);
});
