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
} from '../fragmentos.js';

const lineas = (...textos: string[]): LineaPdf[] => textos.map((text) => ({ text, page: 1 }));

/** Lista de reconocimiento, ya normalizada como llega desde la planilla. */
const TITULOS = [
  'fundamentacion', 'presentacion', 'objetivo de la materia', 'objetivos de la materia',
  'objetivos de aprendizaje', 'objetivos especificos', 'recorridos', 'unidades tematicas',
  'contenidos minimos', 'bibliografia', 'formas y criterios de evaluacion',
  'metodologia de ensenanza y aprendizaje', 'regimen de cursada y evaluacion',
  'condiciones de regularizacion de la cursada', 'condiciones de aprobacion de la materia',
  'promocion', 'final', 'cronograma',
];

const reconoce = (texto: string) => tituloConocido(texto, TITULOS);
const partir = (l: LineaPdf[]) => fragmentar(l, TITULOS);

test('reconoce un título conocido aunque tenga tilde o error de tipeo', () => {
  assert.equal(reconoce('BIGLIOGRAFÍA'), 'bibliografia');
  assert.equal(reconoce('FUNDAMENTACIÓN'), 'fundamentacion');
  assert.equal(reconoce('Condiciones de regularización de la cursada'), 'condiciones de regularizacion de la cursada');
});

test('una oración que contiene un título no es un título', () => {
  // "representación." no es "presentación": termina en punto.
  assert.equal(reconoce('representación.'), null);
  assert.equal(reconoce('Este es el programa de la presentación de la materia y sus contenidos.'), null);
});

test('no toma viñetas como título', () => {
  assert.equal(reconoce('● Promoción'), null);
});

test('un encabezado en mayúsculas necesita letras suficientes y no tiene datos de tabla', () => {
  assert.equal(esEncabezadoMayusculas('REPASO'), true);
  assert.equal(esEncabezadoMayusculas('CPU'), false);
  assert.equal(esEncabezadoMayusculas('IFTS N° 29'), false);
  assert.equal(esEncabezadoMayusculas('SEMANA / FECHAS'), false);
  assert.equal(esEncabezadoMayusculas('● OBLIGATORIA'), false);
});

test('parte el texto en secciones por título y deja el texto antes del primer título sin título', () => {
  const frags = partir(lineas(
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

test('una línea de título seguida de texto con dos puntos no divide la sección', () => {
  const frags = partir(lineas(
    'PROMOCIÓN',
    'Calificación de 7 en cada parcial.',
    'FINAL: aquellos que posean una calificación menor a 7.',
  ));
  assert.deepEqual(frags.map((f) => f.titulo), ['PROMOCIÓN']);
  assert.ok(frags[0]?.texto.includes('FINAL: aquellos'));
});

test('normalizar quita tildes, signos y mayúsculas, para la búsqueda', () => {
  assert.equal(normalizar('Régimen de Cursada: 75% de las PFO.'), 'regimen de cursada 75 de las pfo');
});
