/**
 * Tests de la normalización de texto y de la comparación por palabras.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { normalizar, normalizarConsulta, similitudPorPalabras } from '../normalizar.js';

test('normalizar quita tildes, mayusculas y puntuacion', () => {
  assert.equal(normalizar('¿Cuándo empiezan las clases?'), 'cuando empiezan las clases');
  assert.equal(normalizar('TÉCNICAS de Programación!!!'), 'tecnicas de programacion');
  assert.equal(normalizar('inscripción.'), 'inscripcion');
});

test('normalizar conserva los espacios entre palabras', () => {
  assert.equal(normalizar('  Hola   MUNDO  '), 'hola mundo');
  assert.equal(normalizar('a, b'), 'a b');
});

test('normalizar recorta letras repetidas de tipeo', () => {
  assert.equal(normalizar('holaaaaaa'), 'holaa');
  // No toca la puntuacion con sentido ni las palabras cortas.
  assert.equal(normalizar('inscripción a materias'), 'inscripcion a materias');
});

test('normalizarConsulta expande siglas y quita palabras vacías', () => {
  const alias = new Map([['abd', 'administracion bases datos']]);
  assert.equal(normalizarConsulta('Programa de ABD', alias), 'programa administracion bases datos');
});

test('similitudPorPalabras cuenta las palabras en común y tolera un error de tipeo', () => {
  assert.equal(similitudPorPalabras('tecnicas programacion', 'tecnicas de programacion'), 2 / 3);
  assert.equal(similitudPorPalabras('progrmacion', 'programacion'), 1);
});
