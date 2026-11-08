/**
 * Fragmentos (servicio del dominio de documentos): decide qué sección de un
 * documento se muestra como extracto para una consulta de texto libre.
 *
 * La búsqueda y el SQL están en `repositories/fragmentos.repository.ts`. Este
 * servicio aporta la regla de negocio: el umbral de confianza y el límite de
 * extractos. Si ninguno supera el umbral, el chat muestra el documento completo.
 */

import { env } from '../config/env.js';
import { buscarFragmentos, buscarFragmentosGlobal } from '../repositories/fragmentos.repository.js';
import { urlDeLectura } from '../clients/drive.js';
import type { Documento, Extracto } from '../db/types.js';

/** Extractos de los documentos indicados que responden a los términos de la consulta. */
export async function buscarExtractos(clavesDocumentos: string[], terminos: string[]): Promise<Extracto[]> {
  const encontrados = await buscarFragmentos(clavesDocumentos, terminos, env.lenguajeNatural.umbralPasaje);
  return encontrados.map(({ titulo, texto }) => ({ titulo, texto }));
}

/** Busca en todos los documentos indexados. Devuelve extractos + documentos de origen. */
export async function buscarExtractosGlobal(
  terminos: string[],
): Promise<{ extractos: Extracto[]; documentos: Documento[] }> {
  const encontrados = await buscarFragmentosGlobal(terminos, env.lenguajeNatural.umbralPasaje);
  if (encontrados.length === 0) return { extractos: [], documentos: [] };

  const extractos = encontrados.map(({ titulo, texto }) => ({ titulo, texto }));

  const vistos = new Set<string>();
  const documentos: Documento[] = [];
  for (const f of encontrados) {
    if (!vistos.has(f.documento.clave)) {
      vistos.add(f.documento.clave);
      documentos.push({
        id: f.documento.id,
        clave: f.documento.clave,
        nombre: `${f.documento.clave}.pdf`,
        tipo: f.documento.tipo ?? 'documento',
        materia: f.documento.materia,
        comision: f.documento.comision,
        anio: f.documento.anio,
        cuatrimestre: f.documento.cuatrimestre,
        mimeType: 'application/pdf',
        url: f.documento.driveFileId ? urlDeLectura(f.documento.driveFileId) : null,
        fechaActualizacion: f.documento.actualizadoEn,
        sincronizado: f.documento.sincronizadoEn !== null,
      });
    }
  }

  return { extractos, documentos };
}
