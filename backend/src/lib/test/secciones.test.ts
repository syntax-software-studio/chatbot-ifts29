/**
 * Tests de la partición de un documento en secciones. Son funciones puras: no
 * leen PDFs, así que no necesitan Drive ni base de datos.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizar } from '../normalizar.js';
import {
  esEncabezadoMayusculas,
  fragmentar,
  tituloConocido,
  type LineaPdf,
} from '../secciones.js';

const lineas = (...textos: string[]): LineaPdf[] => textos.map((text) => ({ text, page: 1 }));

test('reconoce un título conocido aunque tenga tilde o error de tipeo', () => {
  assert.equal(tituloConocido('BIGLIOGRAFÍA'), 'bibliografia');
  assert.equal(tituloConocido('FUNDAMENTACIÓN'), 'fundamentacion');
  assert.equal(tituloConocido('Condiciones de regularización de la cursada'), 'condiciones de regularizacion de la cursada');
});

test('una oración que contiene un título no es un título', () => {
  // "representación." no es "presentación": termina en punto.
  assert.equal(tituloConocido('representación.'), null);
  assert.equal(tituloConocido('Este es el programa de la presentación de la materia y sus contenidos.'), null);
});

test('no toma viñetas como título', () => {
  assert.equal(tituloConocido('● Promoción'), null);
});

test('un encabezado en mayúsculas necesita letras suficientes y no tiene datos de tabla', () => {
  assert.equal(esEncabezadoMayusculas('REPASO'), true);
  assert.equal(esEncabezadoMayusculas('CPU'), false);
  assert.equal(esEncabezadoMayusculas('IFTS N° 29'), false);
  assert.equal(esEncabezadoMayusculas('SEMANA / FECHAS'), false);
  assert.equal(esEncabezadoMayusculas('● OBLIGATORIA'), false);
});

test('parte el texto en secciones por título y deja el texto antes del primer título sin título', () => {
  const frags = fragmentar(lineas(
    'Materia Año 2026',
    'FUNDAMENTACIÓN',
    'Las bases de datos son fundamentales.',
    'OBJETIVO DE LA MATERIA',
    'Conocer sistemas gestores.',
  ));
  assert.deepEqual(frags, [
    { titulo: '', texto: 'Materia Año 2026' },
    { titulo: 'FUNDAMENTACIÓN', texto: 'Las bases de datos son fundamentales.' },
    { titulo: 'OBJETIVO DE LA MATERIA', texto: 'Conocer sistemas gestores.' },
  ]);
});

test('un título al inicio de línea seguido de : abre sección con el resto de la línea', () => {
  const frags = fragmentar(lineas(
    'PROMOCIÓN :',
    'Calificación de 7 en cada parcial.',
    'FINAL: aquellos que posean una calificación menor a 7.',
  ));
  assert.deepEqual(frags.map((f) => f.titulo), ['PROMOCIÓN :', 'FINAL']);
  assert.equal(frags[1]?.texto, 'aquellos que posean una calificación menor a 7.');
});

test('normalizar quita tildes, signos y mayúsculas, para la búsqueda', () => {
  assert.equal(normalizar('Régimen de Cursada: 75% de las PFO.'), 'regimen de cursada 75 de las pfo');
});
