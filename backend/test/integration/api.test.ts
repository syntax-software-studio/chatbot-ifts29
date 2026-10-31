/**
 * Tests del contrato HTTP de la API, de punta a punta, contra la base de prueba.
 *
 * Levanta la app Express en un puerto efímero y habla HTTP de verdad. Verifica
 * el recorrido del menú, el texto libre, la derivación por pantallas y las
 * reglas de validación del cuerpo.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Debe ir primero: fija DATABASE_URL de prueba antes de cargar la aplicación.
import { prepararBasePrueba, cerrarBasePrueba } from '../helpers/entorno-prueba.js';
import { createApp } from '../../src/app.js';

let servidor: Server;
let base: string;

before(async () => {
  await prepararBasePrueba();
  const app = createApp();
  await new Promise<void>((resolve) => {
    servidor = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => servidor.close(() => resolve()));
  await cerrarBasePrueba();
});

const chat = async (cuerpo: unknown): Promise<{ status: number; json: any }> => {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { status: res.status, json: await res.json() };
};

const claves = (opciones: Array<{ clave: string }>): string[] => opciones.map((o) => o.clave);

test('health responde ok con la base de datos', async () => {
  const res = await fetch(`${base}/api/health`);
  const json = (await res.json()) as any;
  assert.equal(json.estado, 'ok');
});

test('el menú raíz trae sus opciones desde la base', async () => {
  const res = await fetch(`${base}/api/menu`);
  const json = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.equal(json.categoria.clave, 'RAIZ');
  assert.ok(claves(json.opciones).includes('RAIZ_OP_ACAD'));
  assert.ok(claves(json.opciones).includes('RAIZ_OP_NOENCONTRE'));
});

test('elegir una materia navega a sus opciones', async () => {
  const r = await chat({ opcion: 'ACAD_OP_ABD' });
  assert.equal(r.status, 200);
  assert.equal(r.json.tipo, 'nodo');
  assert.ok(claves(r.json.nodo.opciones).includes('ABD_OP_PROG'));
});

test('elegir una respuesta devuelve su texto y sus documentos', async () => {
  const r = await chat({ opcion: 'ABD_OP_PROG' });
  assert.equal(r.status, 200);
  assert.equal(r.json.tipo, 'respuesta');
  assert.equal(r.json.respuesta.texto, 'Este es el programa de Administración de Bases de Datos.');
  assert.equal(r.json.respuesta.documentos.length, 1);
  assert.equal(r.json.respuesta.documentos[0].clave, 'ABD_programa_2026_1C');
});

test('"No encontré lo que busco" muestra la pantalla de motivos', async () => {
  const r = await chat({ opcion: 'RAIZ_OP_NOENCONTRE' });
  assert.equal(r.status, 200);
  assert.equal(r.json.tipo, 'nodo');
  assert.ok(claves(r.json.nodo.opciones).includes('DERIVACION_OP_TRAMITES'));
});

test('una opción de derivación devuelve su contacto asociado', async () => {
  const r = await chat({ opcion: 'DERIVACION_OP_TRAMITES' });
  assert.equal(r.status, 200);
  assert.equal(r.json.tipo, 'derivacion');
  assert.deepEqual(
    r.json.derivacion.contactos.map((c: { clave: string }) => c.clave),
    ['bedelia'],
  );
});

test('una consulta escrita responde con la misma respuesta del menú', async () => {
  const r = await chat({ message: 'programa de ABD' });
  assert.equal(r.status, 200);
  assert.equal(r.json.tipo, 'respuesta');
  assert.equal(r.json.claveOpcion, 'ABD_OP_PROG');
});

test('una consulta ambigua devuelve aclaración con opciones del menú', async () => {
  const r = await chat({ message: 'abd' });
  assert.equal(r.status, 200);
  assert.equal(r.json.tipo, 'aclaracion');
  assert.deepEqual(claves(r.json.aclaracion.opciones).sort(), ['ABD_OP_COND', 'ABD_OP_PROG']);
});

test('un cuerpo sin entrada devuelve 400', async () => {
  const r = await chat({});
  assert.equal(r.status, 400);
});

test('enviar opción y texto juntos devuelve 400', async () => {
  const r = await chat({ opcion: 'ABD_OP_PROG', message: 'programa de ABD' });
  assert.equal(r.status, 400);
});

test('una consulta demasiado corta devuelve 400', async () => {
  const r = await chat({ message: 'a' });
  assert.equal(r.status, 400);
});

test('una opción inexistente no responde con contenido', async () => {
  const r = await chat({ opcion: 'NO_EXISTE' });
  assert.ok(r.status >= 400, `se esperaba un error, llegó ${r.status}`);
});

test('las métricas responden con el agregado', async () => {
  const res = await fetch(`${base}/api/metricas`);
  const json = (await res.json()) as any;
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(json.top));
});
