/**
 * Tests de la validación de la fuente de contenido (`interpretarContenido`).
 *
 * Son funciones puras: no hay red ni credenciales. Los datos son chicos y se
 * arman acá, sin depender de la planilla real.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ESQUEMA_CONTENIDO, interpretarContenido, type Valores } from '../src/services/fuente-contenido.service.js';

/** Una pestaña: encabezado del esquema y, opcionalmente, filas de ejemplo. */
const pestana = (nombre: keyof typeof ESQUEMA_CONTENIDO, ...filas: string[][]): Valores => [
  [...ESQUEMA_CONTENIDO[nombre]],
  ...filas,
];

/** Todas las pestañas del esquema, con una fila de ejemplo en cada una. */
const contenidoValido = (): Record<string, Valores> => ({
  categorias: pestana('categorias', ['RAIZ', 'Inicio', 'Hola', '0', 'TRUE']),
  opciones: pestana('opciones', ['RAIZ_OP_ACAD', 'RAIZ', 'Materias', 'navegar', 'M_ACAD', '', '1', 'FALSE']),
  respuestas: pestana('respuestas', ['ABD_programa', 'Texto del programa, con coma y "comillas".', '1']),
  respuesta_documentos: pestana('respuesta_documentos', ['ABD_programa', 'ABD_programa_2026_1C.pdf', '1']),
  intenciones: pestana('intenciones', ['programa_ABD', 'Programa de ABD', 'administrativo', 'ABD_OP_PROG']),
  preguntas: pestana('preguntas', ['programa_ABD', '¿Cuál es el programa?', '30', '0.7']),
  variantes: pestana('variantes', ['programa_ABD', '¿Cuál es el programa?', 'programa de abd', '1']),
  contactos: pestana('contactos', ['bedelia', 'Bedelía', 'Bedelía', 'General', 'bedelia@bue.edu.ar', '', 'Trámites', '3', 'DERIVACION_OP_TRAMITES']),
});

test('un contenido válido se interpreta completo y sin errores', () => {
  const r = interpretarContenido(contenidoValido());
  assert.equal(r.ok, true);
  assert.deepEqual(r.errores, []);
  assert.deepEqual(r.hojas.contactos?.[0], {
    clave: 'bedelia',
    nombre: 'Bedelía',
    area: 'Bedelía',
    comision: 'General',
    email: 'bedelia@bue.edu.ar',
    perfil: '',
    motivo: 'Trámites',
    orden: '3',
    opcion: 'DERIVACION_OP_TRAMITES',
  });
});

test('las celdas con comas y comillas llegan intactas', () => {
  const r = interpretarContenido(contenidoValido());
  assert.equal(r.hojas.respuestas?.[0]?.texto, 'Texto del programa, con coma y "comillas".');
});

test('las filas vacías se descartan', () => {
  const c = contenidoValido();
  c.contactos = pestana(
    'contactos',
    ['', '', '', '', '', '', '', ''],
    ['bedelia', 'Bedelía', 'Bedelía', 'General', '', '', 'Trámites', '3'],
  );
  const r = interpretarContenido(c);
  assert.equal(r.ok, true);
  assert.equal(r.hojas.contactos?.length, 1);
});

test('una pestaña faltante se reporta por nombre', () => {
  const c = contenidoValido();
  delete c.variantes;
  const r = interpretarContenido(c);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('"variantes"')));
  assert.equal(r.hojas.variantes, undefined);
});

test('encabezados distintos al esquema se reportan con lo esperado y lo encontrado', () => {
  const c = contenidoValido();
  c.preguntas = [['intencion', 'texto_pregunta', 'prioridad', 'umbral']];
  const r = interpretarContenido(c);
  assert.equal(r.ok, false);
  const error = r.errores.find((e) => e.includes('"preguntas"'));
  assert.ok(error, 'debe reportar la pestaña preguntas');
  assert.ok(error.includes('intencion, pregunta, prioridad, umbral'));
  assert.ok(error.includes('texto_pregunta'));
});

test('el orden de las columnas también se valida', () => {
  const c = contenidoValido();
  c.respuestas = [['texto', 'clave', 'orden']];
  const r = interpretarContenido(c);
  assert.equal(r.ok, false);
  assert.ok(r.errores.some((e) => e.includes('"respuestas"')));
});

test('las pestañas fuera del esquema se ignoran sin error', () => {
  const c = contenidoValido();
  c['hoja de trabajo'] = [['cualquier', 'cosa'], ['x', 'y']];
  const r = interpretarContenido(c);
  assert.equal(r.ok, true);
  assert.equal(r.hojas['hoja de trabajo' as 'contactos'], undefined);
});

test('se reportan todos los problemas juntos, no sólo el primero', () => {
  const c = contenidoValido();
  delete c.variantes;
  c.categorias = [['clave', 'nombre']];
  const r = interpretarContenido(c);
  assert.equal(r.ok, false);
  assert.equal(r.errores.length, 2);
});
