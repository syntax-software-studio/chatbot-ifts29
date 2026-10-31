/**
 * Tests del normalizador y de la similitud trigram.
 *
 * `similitudTrigram` tiene que ser una replica exacta de `similarity()` de
 * `pg_trgm`; los valores esperados de abajo estan derivados de la definicion
 * (`contrib/pg_trgm`: trigramas por palabra, con dos espacios de delimitacion,
 * deduplicados, y coeficiente `comunes / (n1 + n2 - comunes)`).
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MIN_CARACTERES, esConsultaUtil, normalizar, similitudTrigram } from '../src/lib/normalizar.js';

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

test('esConsultaUtil exige el largo minimo', () => {
  assert.equal(MIN_CARACTERES, 2);
  assert.equal(esConsultaUtil('a'), false);
  assert.equal(esConsultaUtil('¿'), false);
  assert.equal(esConsultaUtil('   '), false);
  assert.equal(esConsultaUtil('ab'), true);
  assert.equal(esConsultaUtil('¿Cuándo empiezan las clases?'), true);
});

test('similitudTrigram: casos base del algoritmo', () => {
  // "word" -> {"  w"," wo","wor","ord","rd ","d  "} (6 trigramas distintos)
  // "words" -> {"  w"," wo","wor","ord","rds","ds ","s  "} (7); comunes = 4
  assert.equal(similitudTrigram('word', 'word'), 1);
  assert.equal(similitudTrigram('word', 'words'), 4 / 9);

  // "cat" -> 5 trigramas; "cart" -> 6; comunes = {"  c"," ca","t  "} = 3
  assert.equal(similitudTrigram('cat', 'cart'), 3 / 8);

  // Sin trigramas en comun.
  assert.equal(similitudTrigram('aaa', 'bbb'), 0);
  assert.equal(similitudTrigram('', 'cualquier cosa'), 0);
});

test('similitudTrigram es simetrica y acotada', () => {
  const pares: Array<[string, string]> = [
    ['inscripcion a materias', 'inscripcion a exámenes'],
    ['cuando empiezan las clases', 'cuando se cursa'],
    ['tecnicas de programacion', 'programacion'],
  ];
  for (const [a, b] of pares) {
    assert.equal(similitudTrigram(a, b), similitudTrigram(b, a));
    const s = similitudTrigram(a, b);
    assert.ok(s >= 0 && s <= 1, `similitud fuera de rango: ${s}`);
  }
});

test('similitudTrigram no cruza palabras ni distingue reordenamientos', () => {
  // Orden de palabras irrelevante para pg_trgm (mismo conjunto de trigramas):
  // por eso la coincidencia EXACTA del nivel A no puede implementarse como
  // "similitud >= 1", sino comparando el texto normalizado.
  assert.equal(similitudTrigram('tecnicas de programacion', 'programacion de tecnicas'), 1);
});