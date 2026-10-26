/**
 * Sincronización completa: contenido de la planilla y documentos de Drive.
 *
 * Es el único punto de entrada para actualizar la base. Primero lee y valida la
 * planilla: si tiene errores, no escribe nada. Después carga el contenido y
 * sincroniza las fichas de documentos con Drive.
 */

import { sincronizarDocumentos, type ResultadoSync } from './drive.service.js';
import { aplicarContenido, convertirContenido, type ResumenCarga } from './carga-contenido.service.js';
import { leerContenido } from './fuente-contenido.service.js';

export interface ResultadoSincronizacion {
  ok: boolean;
  /** Problemas de la planilla o de la configuración. Si hay, no se escribió nada. */
  errores: string[];
  contenido?: ResumenCarga;
  documentos?: ResultadoSync;
}

export async function sincronizar(
  opciones: { carpetaId?: string; dryRun?: boolean } = {},
): Promise<ResultadoSincronizacion> {
  const lectura = await leerContenido();
  if (!lectura.ok) return { ok: false, errores: lectura.errores };

  const conversion = convertirContenido(lectura.hojas);
  if (!conversion.ok || !conversion.datos) return { ok: false, errores: conversion.errores };

  // En modo de prueba se valida la planilla, pero no se escribe el contenido.
  const contenido = opciones.dryRun ? undefined : await aplicarContenido(conversion.datos);
  const documentos = await sincronizarDocumentos(opciones);

  return {
    ok: true,
    errores: [],
    ...(contenido ? { contenido } : {}),
    documentos,
  };
}
