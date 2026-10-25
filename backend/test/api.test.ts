/**
 * Tests del contrato HTTP de `/api/chat` (de punta a punta sobre la app real).
 *
 * Levanta la app Express en un puerto efímero y habla HTTP de verdad, para
 * verificar lo que los tests de servicio no alcanzan: el contrato, los códigos
 * de error y las reglas de validación del cuerpo.
 *
 * Corre contra el catálogo semilla (sin `DATABASE_URL`), que es el mismo
 * contenido que se carga en Neon.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';

// Debe ir primero: vacia DATABASE_URL antes de que se importe la app.
import './solo-semilla.js';
import { createApp } from '../src/app.js';
import type { TurnoChat, NodoMenu } from '../src/db/types.js';

let servidor: Server;
let base: string;

before(async () => {
  const app = createApp();
  await new Promise<void>((resolve) => {
    servidor = app.listen(0, () => resolve());
  });
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
});

after(async () => {
  await new Promise<void>((resolve) => servidor.close(() => resolve()));
});

const post = async (cuerpo: unknown): Promise<{ status: number; json: any }> => {
  const res = await fetch(`${base}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(cuerpo),
  });
  return { status: res.status, json: await res.json().catch(() => null) };
};

test('el menú raíz sigue funcionando', async () => {
  const res = await fetch(`${base}/api/menu`);
  assert.equal(res.status, 200);
  const nodo = (await res.json()) as NodoMenu;
  assert.equal(nodo.categoria.clave, 'RAIZ');
  assert.ok(nodo.opciones.length > 0);
});

test('una opción del menú se procesa como siempre', async () => {
  const { status, json } = await post({ opcion: 'ADM_OP_SIU' });
  assert.equal(status, 200);
  assert.equal(json.tipo, 'respuesta');
  assert.ok(json.respuesta.texto.length > 0);
  // Una selección del menú no lleva metadatos de interpretación.
  assert.equal(json.meta, undefined);
});

test('una consulta escrita devuelve la respuesta institucional', async () => {
  const { status, json } = await post({ message: '¿Cómo accedo al SIU Guaraní?' });
  assert.equal(status, 200);
  const turno = json as TurnoChat;
  assert.equal(turno.tipo, 'respuesta');
  assert.equal(turno.meta?.intent, 'acceso_siu');
  assert.equal(turno.meta?.matchType, 'exacto');
  assert.ok(turno.meta);
});

test('una consulta ambigua devuelve aclaración con opciones del menú', async () => {
  const { status, json } = await post({ message: '¿Cuándo empiezan las clases?' });
  assert.equal(status, 200);
  assert.equal(json.tipo, 'aclaracion');
  assert.equal(json.aclaracion.opciones.length, 4);

  // La opción propuesta se puede usar como cualquier opción del menú.
  const clave = json.aclaracion.opciones[0].clave;
  const elegida = await post({ opcion: clave });
  assert.equal(elegida.status, 200);
  assert.ok(['respuesta', 'nodo', 'derivacion'].includes(elegida.json.tipo));
});

test('una consulta fuera del dominio devuelve el aviso institucional', async () => {
  const { status, json } = await post({ message: '¿Quién va a ganar el mundial?' });
  assert.equal(status, 200);
  assert.equal(json.tipo, 'no_disponible');
  assert.ok(json.mensaje.includes('No dispongo de esa información'));
});

test('un saludo devuelve el menú raíz', async () => {
  const { status, json } = await post({ message: 'hola' });
  assert.equal(status, 200);
  assert.equal(json.tipo, 'nodo');
  assert.equal(json.meta?.source, 'rule');
});

test('se acepta conversationId y se ignora', async () => {
  const { status, json } = await post({ message: 'programa', conversationId: 'abc123' });
  assert.equal(status, 200);
  assert.equal(json.tipo, 'aclaracion');
});

test('el cuerpo se valida: campos, exclusividad y longitud', async () => {
  // Sin cuerpo utilizable.
  const vacio = await post({});
  assert.equal(vacio.status, 400);
  assert.equal(vacio.json.error.code, 'VALIDATION_ERROR');

  // Nombres antiguos del campo de texto: se rechazan con explicación.
  const antiguo = await post({ mensaje: 'hola' });
  assert.equal(antiguo.status, 400);
  assert.match(antiguo.json.error.message, /"message"/);

  const texto = await post({ texto: 'hola' });
  assert.equal(texto.status, 400);

  // Los dos flujos a la vez son ambiguos.
  const ambos = await post({ opcion: 'ADM_OP_SIU', message: 'hola' });
  assert.equal(ambos.status, 400);
  assert.match(ambos.json.error.message, /no ambos a la vez/);

  // Regla original del menú: exactamente una clave.
  const dosMenu = await post({ opcion: 'ADM_OP_SIU', categoria: 'RAIZ' });
  assert.equal(dosMenu.status, 400);

  // Consulta demasiado corta.
  const corta = await post({ message: '¿?' });
  assert.equal(corta.status, 400);

  // Consulta demasiado larga (límite por defecto: 800 caracteres).
  const larga = await post({ message: 'a'.repeat(801) });
  assert.equal(larga.status, 400);
  assert.match(larga.json.error.message, /demasiado larga/);
});