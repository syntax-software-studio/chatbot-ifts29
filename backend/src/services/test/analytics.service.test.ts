/**
 * Reporte mensual de métricas contra la base de prueba. La planilla se simula: no se
 * llama a Google.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { prepararBasePrueba, cerrarBasePrueba } from '../../../test/helpers/entorno-prueba.js';
import { exportarMes } from '../analytics.service.js';
import type { PuertoMetricasSheet } from '../../clients/sheets-metricas.client.js';
import type { Tabla } from '../../lib/metricas.js';
import { query } from '../../db/pool.js';

before(async () => {
  await prepararBasePrueba();
  await query(`
    INSERT INTO metrica_opcion (opcion_clave, categoria_clave, evento, fecha, total) VALUES
      ('ABD_OP_PROG', NULL, 'seleccion', '2026-10-05', 3),
      ('ABD_OP_PROG', NULL, 'texto_exacto', '2026-10-31', 2),
      ('(no_disponible)', NULL, 'no_disponible', '2026-11-01', 9)`);
});

after(async () => {
  await cerrarBasePrueba();
});

/** Planilla simulada: guarda lo que se publica y devuelve un ID fijo. */
function fakeSheet(): PuertoMetricasSheet & { publicados: Array<{ pestana: string; tabla: Tabla }> } {
  const publicados: Array<{ pestana: string; tabla: Tabla }> = [];
  return {
    publicados,
    publicarMes: async (pestana, tabla) => {
      publicados.push({ pestana, tabla });
      return 'SHEET-PRUEBA';
    },
  };
}

test('el reporte de un mes incluye sus días y no los del mes siguiente', async () => {
  const sheet = fakeSheet();
  const r = await exportarMes('2026-10', sheet);

  const { pestana, tabla } = sheet.publicados[0]!;
  assert.equal(pestana, '2026-10');
  assert.deepEqual(tabla.slice(1), [
    ['2026-10-05', 'ABD_OP_PROG', '', 'seleccion', 3],
    ['2026-10-31', 'ABD_OP_PROG', '', 'texto_exacto', 2],
  ]);
  assert.deepEqual(r, { mes: '2026-10', archivoId: 'SHEET-PRUEBA', registros: 2, total: 5 });
});

test('republicar un mes reemplaza su registro de control, no lo duplica', async () => {
  await exportarMes('2026-10', fakeSheet());
  await exportarMes('2026-10', fakeSheet());
  const r = await query<{ n: number }>("SELECT count(*)::int AS n FROM metrica_exportacion WHERE mes = '2026-10'");
  assert.equal(r.rows[0]!.n, 1);
});
