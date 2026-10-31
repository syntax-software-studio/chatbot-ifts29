/**
 * Fragmentos (servicio del dominio de documentos): decide qué sección de un
 * documento se muestra como extracto para una consulta de texto libre.
 *
 * La búsqueda y el SQL están en `repositories/fragmentos.repository.ts`. Este
 * servicio aporta la regla de negocio: el umbral de confianza y el límite de
 * extractos. Si ninguno supera el umbral, el chat muestra el documento completo.
 */

import { env } from '../config/env.js';
import { buscarFragmentos } from '../repositories/fragmentos.repository.js';
import type { Extracto } from '../db/types.js';

/** Extractos de los documentos indicados que responden a los términos de la consulta. */
export async function buscarExtractos(clavesDocumentos: string[], terminos: string[]): Promise<Extracto[]> {
  const encontrados = await buscarFragmentos(clavesDocumentos, terminos, env.lenguajeNatural.umbralPasaje);
  return encontrados.map(({ titulo, texto }) => ({ titulo, texto }));
}
