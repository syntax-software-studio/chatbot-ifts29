/**
 * Orquestación de la sincronización: si la planilla tiene errores no se escribe nada.
 * Los pasos (lectura, carga, documentos) son fakes; no hay base ni Drive.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { sincronizar } from '../sync.service.js';
import { contenidoPrueba } from '../../../test/fixtures/contenido.js';
import type { ResultadoContenido } from '../../lib/planilla.js';
import type { ResultadoSync } from '../sync-load.service.js';
import type { ResumenCarga } from '../sync-transform.service.js';

const documentosVacio: ResultadoSync = {
  ejecutada: true,
  dryRun: false,
  archivosVistos: 0,
  actualizados: 0,
  sinMatch: [],
  mensajes: [],
};

const lectura = (hojas: ResultadoContenido['hojas'], ok = true, errores: string[] = []): ResultadoContenido => ({
  ok,
  hojas,
  errores,
});

test('si la planilla tiene errores de lectura, no escribe nada', async () => {
  let escribio = false;
  const r = await sincronizar({}, {
    leerContenido: async () => lectura({}, false, ['falta la pestaña categorias']),
    aplicarContenido: async () => {
      escribio = true;
      return {} as ResumenCarga;
    },
    sincronizarDocumentos: async () => {
      escribio = true;
      return documentosVacio;
    },
  });
  assert.equal(r.ok, false);
  assert.deepEqual(r.errores, ['falta la pestaña categorias']);
  assert.equal(escribio, false);
});

test('si la planilla no convierte, tampoco escribe', async () => {
  // Una opción de navegación sin destino es un error de conversión.
  const rota = structuredClone(contenidoPrueba);
  rota.opciones = rota.opciones!.map((o) => ({ ...o, tipo: 'navegar', destino: '' }));
  let escribio = false;
  const r = await sincronizar({}, {
    leerContenido: async () => lectura(rota),
    aplicarContenido: async () => {
      escribio = true;
      return {} as ResumenCarga;
    },
    sincronizarDocumentos: async () => {
      escribio = true;
      return documentosVacio;
    },
  });
  assert.equal(r.ok, false);
  assert.ok(r.errores.length > 0);
  assert.equal(escribio, false);
});

test('con la planilla válida escribe el contenido antes que los documentos', async () => {
  const orden: string[] = [];
  const r = await sincronizar({}, {
    leerContenido: async () => lectura(contenidoPrueba),
    aplicarContenido: async () => {
      orden.push('contenido');
      return {} as ResumenCarga;
    },
    sincronizarDocumentos: async () => {
      orden.push('documentos');
      return documentosVacio;
    },
  });
  assert.equal(r.ok, true);
  assert.deepEqual(orden, ['contenido', 'documentos']);
  assert.ok(r.contenido);
});

test('en dryRun valida la planilla y sincroniza documentos, sin escribir el contenido', async () => {
  const orden: string[] = [];
  let opcionesDocumentos: unknown;
  const r = await sincronizar({ dryRun: true }, {
    leerContenido: async () => lectura(contenidoPrueba),
    aplicarContenido: async () => {
      orden.push('contenido');
      return {} as ResumenCarga;
    },
    sincronizarDocumentos: async (opciones) => {
      orden.push('documentos');
      opcionesDocumentos = opciones;
      return documentosVacio;
    },
  });
  assert.equal(r.ok, true);
  assert.equal(r.contenido, undefined);
  assert.deepEqual(orden, ['documentos']);
  assert.deepEqual(opcionesDocumentos, { dryRun: true });
});
