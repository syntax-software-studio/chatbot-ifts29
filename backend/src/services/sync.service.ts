/**
 * Sincronización completa: contenido de la planilla y documentos de Drive.
 *
 * Es el único punto de entrada para actualizar la base. Primero lee y valida la
 * planilla: si tiene errores, no escribe nada. Después carga el contenido y
 * sincroniza las fichas de documentos con Drive.
 */

import { sincronizarDocumentos, aplicarContenido, type OpcionesDocumentos, type ResultadoSync } from './sync-load.service.js';
import { convertirContenido, type ResumenCarga } from './sync-transform.service.js';
import { leerContenido } from './sync-extract.service.js';
import type { ResultadoContenido } from '../lib/planilla.js';

export interface ResultadoSincronizacion {
  ok: boolean;
  /** Problemas de la planilla o de la configuración. Si hay, no se escribió nada. */
  errores: string[];
  contenido?: ResumenCarga;
  documentos?: ResultadoSync;
}

/** Pasos que usa la sincronización. Por defecto, los reales; en pruebas, fakes. */
export interface PasosSincronizacion {
  leerContenido: () => Promise<ResultadoContenido>;
  aplicarContenido: typeof aplicarContenido;
  sincronizarDocumentos: (opciones: OpcionesDocumentos) => Promise<ResultadoSync>;
}

const pasosReales: PasosSincronizacion = { leerContenido, aplicarContenido, sincronizarDocumentos };

export async function sincronizar(
  opciones: OpcionesDocumentos = {},
  pasos: Partial<PasosSincronizacion> = {},
): Promise<ResultadoSincronizacion> {
  const p = { ...pasosReales, ...pasos };

  const lectura = await p.leerContenido();
  if (!lectura.ok) return { ok: false, errores: lectura.errores };

  const conversion = convertirContenido(lectura.hojas);
  if (!conversion.ok || !conversion.datos) return { ok: false, errores: conversion.errores };

  // En modo de prueba se valida la planilla, pero no se escribe el contenido.
  const contenido = opciones.dryRun ? undefined : await p.aplicarContenido(conversion.datos);
  const documentos = await p.sincronizarDocumentos(opciones);

  return {
    ok: true,
    errores: [],
    ...(contenido ? { contenido } : {}),
    documentos,
  };
}
