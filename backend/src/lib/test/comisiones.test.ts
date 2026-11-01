/**
 * Lógica de comisiones: nombre de documento, pregunta y filtrado.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  claveConComision,
  comisionesAPreguntar,
  filtrarPorComision,
  parsearDocumento,
  separarComision,
  type DocumentoConComision,
} from '../comisiones.js';

/** Campos que la sincronización guarda para una clave de documento. */
const doc = (clave: string): DocumentoConComision & { clave: string } => ({
  clave,
  ...parsearDocumento(clave)!,
});

/* ==========================================================================
 * Helpers puros
 * ======================================================================== */

test('el nombre del documento da materia, tipo, comisión, año y cuatrimestre', () => {
  assert.deepEqual(parsearDocumento('ABD_condiciones_B_2026_1C'), {
    materia: 'ABD',
    tipo: 'condiciones',
    comision: 'B',
    anio: 2026,
    cuatrimestre: '1C',
  });
});

test('un documento sin comisión ni cuatrimestre deja esos campos vacíos', () => {
  assert.deepEqual(parsearDocumento('GENERAL_reglamento_2026'), {
    materia: 'GENERAL',
    tipo: 'reglamento',
    comision: null,
    anio: 2026,
    cuatrimestre: null,
  });
});

test('un nombre fuera de la convención no se interpreta', () => {
  assert.equal(parsearDocumento('documento cualquiera'), null);
});

test('la clave de opción por comisión se separa en base y comisión', () => {
  assert.equal(claveConComision('ABD_OP_COND', 'B'), 'ABD_OP_COND@B');
  assert.deepEqual(separarComision('ABD_OP_COND@B'), { base: 'ABD_OP_COND', comision: 'B' });
  assert.deepEqual(separarComision('ABD_OP_COND'), { base: 'ABD_OP_COND', comision: null });
});

test('pregunta comisión sólo cuando un grupo tiene más de una', () => {
  const docs = [doc('ABD_condiciones_A_2026_1C'), doc('ABD_condiciones_B_2026_1C')];
  assert.deepEqual(comisionesAPreguntar(docs), ['A', 'B']);
  assert.deepEqual(comisionesAPreguntar([doc('ABD_condiciones_A_2026_1C')]), []);
  assert.deepEqual(comisionesAPreguntar([doc('ABD_programa_2026_1C')]), []);
});

test('el filtro deja la comisión elegida y los documentos generales', () => {
  const docs = [
    doc('ABD_programa_2026_1C'),
    doc('ABD_condiciones_A_2026_1C'),
    doc('ABD_condiciones_B_2026_1C'),
  ];
  assert.deepEqual(
    filtrarPorComision(docs, 'B').map((d) => d.clave),
    ['ABD_programa_2026_1C', 'ABD_condiciones_B_2026_1C'],
  );
});

/* ==========================================================================
 * Flujo completo contra la base de prueba
 * ======================================================================== */

