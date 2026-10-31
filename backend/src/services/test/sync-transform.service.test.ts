/**
 * Tests de la conversión y validación del contenido (`convertirContenido`).
 *
 * Función pura: no hay base ni red. El contenido de prueba es chico y se arma
 * acá, sin depender de la planilla real.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { convertirContenido } from '../sync-transform.service.js';
import type { Fila, Pestana } from '../src/lib/planilla.js';

type Hojas = Partial<Record<Pestana, Fila[]>>;

/** Contenido válido mínimo: un menú con una respuesta, una intención y un contacto de derivación. */
const contenidoValido = (): Hojas => ({
  categorias: [
    { clave: 'RAIZ', nombre: 'Inicio', mensaje: 'Hola', orden: '0', es_raiz: 'TRUE' },
    { clave: 'ACAD', nombre: 'Materias', mensaje: '', orden: '1', es_raiz: 'FALSE' },
  ],
  respuestas: [{ clave: 'ABD_programa', texto: 'Programa de ABD.', orden: '1' }],
  opciones: [
    { clave: 'RAIZ_OP_ACAD', categoria: 'RAIZ', etiqueta: 'Materias', tipo: 'navegar', destino: 'ACAD', respuesta: '', orden: '1', es_volver: 'FALSE' },
    { clave: 'ACAD_OP_ABD', categoria: 'ACAD', etiqueta: 'ABD', tipo: 'responder', destino: '', respuesta: 'ABD_programa', orden: '1', es_volver: 'FALSE' },
    { clave: 'RAIZ_OP_NOENCONTRE', categoria: 'RAIZ', etiqueta: 'No encontré', tipo: 'derivar', destino: '', respuesta: '', orden: '9', es_volver: 'FALSE' },
  ],
  respuesta_documentos: [{ respuesta: 'ABD_programa', documento: 'ABD_programa_2026_1C.pdf', orden: '1' }],
  intenciones: [{ clave: 'programa_ABD', nombre: 'Programa de ABD', dominio: 'academico', opcion: 'ACAD_OP_ABD' }],
  preguntas: [{ intencion: 'programa_ABD', pregunta: '¿Cuál es el programa?', prioridad: '30', umbral: '0,7' }],
  variantes: [
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa?', texto: 'Programa de ABD', peso: '1' },
  ],
  contactos: [
    { clave: 'bedelia', nombre: 'Bedelía', area: 'Bedelía', comision: 'General', email: 'b@bue.edu.ar', perfil: '', motivo: 'Trámites', orden: '3', opcion: 'RAIZ_OP_NOENCONTRE' },
  ],
});

test('un contenido válido se convierte sin errores', () => {
  const r = convertirContenido(contenidoValido());
  assert.equal(r.ok, true, r.errores.join('\n'));
  assert.equal(r.datos?.categorias[0]?.esRaiz, true);
  assert.equal(r.datos?.opciones.find((o) => o.clave === 'RAIZ_OP_NOENCONTRE')?.tipo, 'derivar');
});

test('el umbral con coma decimal se convierte a número', () => {
  const r = convertirContenido(contenidoValido());
  assert.equal(r.datos?.preguntas[0]?.umbral, 0.7);
});

test('el documento se identifica por el nombre sin .pdf, y conserva el nombre de archivo', () => {
  const r = convertirContenido(contenidoValido());
  assert.deepEqual(r.datos?.documentos, [
    { clave: 'ABD_programa_2026_1C', nombreArchivo: 'ABD_programa_2026_1C.pdf' },
  ]);
  assert.equal(r.datos?.respuestaDocumentos[0]?.documento, 'ABD_programa_2026_1C');
});

test('las variantes se guardan normalizadas con el mismo normalizador del bot', () => {
  const r = convertirContenido(contenidoValido());
  assert.equal(r.datos?.variantes[0]?.normalizado, 'programa abd');
});

test('las celdas vacías de opcionales quedan en null', () => {
  const r = convertirContenido(contenidoValido());
  assert.equal(r.datos?.categorias[1]?.mensaje, null);
  assert.equal(r.datos?.contactos[0]?.perfil, null);
});

test('una opción de navegación sin destino es un error', () => {
  const h = contenidoValido();
  h.opciones![0]!.destino = '';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('RAIZ_OP_ACAD') && e.includes('navegar')));
});

test('una opción de respuesta sin respuesta es un error', () => {
  const h = contenidoValido();
  h.opciones![1]!.respuesta = '';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('ACAD_OP_ABD') && e.includes('responder')));
});

test('una intención que apunta a una opción inexistente es un error', () => {
  const h = contenidoValido();
  h.intenciones![0]!.opcion = 'NO_EXISTE';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('NO_EXISTE')));
});

test('un booleano que no es TRUE ni FALSE es un error', () => {
  const h = contenidoValido();
  h.categorias![0]!.es_raiz = 'SI';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('es_raiz')));
});

test('un número inválido es un error', () => {
  const h = contenidoValido();
  h.preguntas![0]!.prioridad = 'alta';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('prioridad')));
});

test('dos variantes iguales después de normalizar son un error', () => {
  const h = contenidoValido();
  h.variantes!.push({ intencion: 'programa_ABD', pregunta: '¿Cuál es el programa?', texto: 'PROGRAMA DE ABD', peso: '1' });
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('repetida')));
});

test('una variante sin pregunta correspondiente es un error', () => {
  const h = contenidoValido();
  h.variantes![0]!.pregunta = 'otra pregunta';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('no existe en preguntas')));
});

test('un adjunto a una respuesta inexistente es un error', () => {
  const h = contenidoValido();
  h.respuesta_documentos![0]!.respuesta = 'NO_EXISTE';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('NO_EXISTE')));
});

test('todos los errores se reportan juntos', () => {
  const h = contenidoValido();
  h.opciones![0]!.destino = '';
  h.categorias![0]!.es_raiz = 'SI';
  h.intenciones![0]!.dominio = 'otro';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.length >= 3, `se esperaban al menos 3 errores, hay ${r.errores.length}`);
});

test('un contacto que apunta a una opción que no es de derivación es un error', () => {
  const h = contenidoValido();
  h.contactos![0]!.opcion = 'ACAD_OP_ABD';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('bedelia') && e.includes('derivar')));
});

test('un contacto sin opción de derivación existente es un error', () => {
  const h = contenidoValido();
  h.contactos![0]!.opcion = 'NO_EXISTE';
  const r = convertirContenido(h);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('NO_EXISTE')));
});
