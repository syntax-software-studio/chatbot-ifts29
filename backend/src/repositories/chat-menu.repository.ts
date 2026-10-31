/**
 * Capa de acceso a datos del catálogo. Lee el menú desde PostgreSQL.
 *
 * Todas las consultas están parametrizadas y solo devuelven contenido
 * institucional. No se persiste ni se lee ningún dato del estudiante.
 */

import { query } from '../db/pool.js';
import { notFound } from '../utils/errors.js';
import type { Categoria, Contacto, Documento, NodoMenu, OpcionMenu, Respuesta, Derivacion, TipoOpcion } from '../db/types.js';

export const CATEGORIA_RAIZ = 'RAIZ';

/* ==========================================================================
 * Mapeadores
 * ======================================================================== */

interface RawCategoria {
  id: number;
  clave: string;
  nombre: string;
  mensaje: string | null;
  orden: number;
  es_raiz: boolean;
}

interface RawOpcion {
  id: number;
  clave: string;
  etiqueta: string;
  descripcion: string | null;
  tipo: TipoOpcion;
  es_volver: boolean;
  icono: string | null;
}

interface RawRespuesta {
  id: number;
  texto: string;
}

interface RawDocumento {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  mime_type: string;
  drive_view_url: string | null;
  vigente: boolean;
  estado: Documento['estado'];
  actualizado_en: string | null;
  sincronizado_en: string | null;
}

interface RawContacto {
  id: number;
  clave: string;
  nombre: string;
  area: string | null;
  email: string | null;
  url_perfil: string | null;
  motivo: string | null;
}

const toCategoria = (r: RawCategoria): Categoria => ({
  id: r.id,
  clave: r.clave,
  nombre: r.nombre,
  mensaje: r.mensaje,
  orden: r.orden,
  esRaiz: r.es_raiz,
});

const toOpcion = (r: RawOpcion): OpcionMenu => ({
  clave: r.clave,
  etiqueta: r.etiqueta,
  descripcion: r.descripcion,
  tipo: r.tipo,
  esVolver: r.es_volver,
  icono: r.icono,
});

const toDocumento = (r: RawDocumento): Documento => ({
  id: r.id,
  clave: r.clave,
  nombre: r.nombre,
  descripcion: r.descripcion,
  tipo: r.tipo,
  mimeType: r.mime_type,
  url: r.drive_view_url,
  vigente: r.vigente,
  estado: r.estado,
  fechaActualizacion: r.actualizado_en,
  sincronizado: r.sincronizado_en !== null,
});

const toContacto = (r: RawContacto): Contacto => ({
  id: r.id,
  clave: r.clave,
  nombre: r.nombre,
  area: r.area,
  email: r.email,
  urlPerfil: r.url_perfil,
  motivo: r.motivo,
});

/* ==========================================================================
 * Lectura del árbol - Neon
 * ======================================================================== */

const SQL_CATEGORIA_POR_CLAVE = `
  SELECT id, clave, nombre, mensaje, orden, es_raiz
    FROM categoria
   WHERE clave = $1 AND activo
   LIMIT 1`;

const SQL_OPCIONES = `
  SELECT o.id, o.clave, o.etiqueta, o.descripcion, o.tipo, o.es_volver, o.icono
    FROM opcion_menu o
   WHERE o.categoria_id = $1 AND o.activo
   ORDER BY o.orden, o.id`;

const SQL_OPCION_POR_CLAVE = `
  SELECT o.id, o.clave, o.etiqueta, o.descripcion, o.tipo, o.es_volver, o.icono,
         o.respuesta_id, o.categoria_destino_id, c.clave AS categoria_clave
    FROM opcion_menu o
    JOIN categoria c ON c.id = o.categoria_id
   WHERE o.clave = $1 AND o.activo AND c.activo
   LIMIT 1`;

const SQL_RESPUESTA = `
  SELECT r.id, r.texto
    FROM respuesta r
   WHERE r.id = $1 AND r.activo
   LIMIT 1`;

const SQL_DOCUMENTOS_DE_RESPUESTA = `
  SELECT d.id, d.clave, d.nombre, d.descripcion, d.tipo, d.mime_type,
         d.drive_view_url, d.vigente, d.estado, d.actualizado_en, d.sincronizado_en
    FROM respuesta_documento rd
    JOIN documento d ON d.id = rd.documento_id
   WHERE rd.respuesta_id = $1 AND d.estado <> 'archivado'
   ORDER BY rd.orden, d.id`;

const SQL_CONTACTOS_DE_OPCION = `
  SELECT c.id, c.clave, c.nombre, c.area, c.email,
         c.url_perfil, c.motivo
    FROM opcion_contacto oc
    JOIN contacto c ON c.id = oc.contacto_id
   WHERE oc.opcion_id = $1 AND c.activo
   ORDER BY oc.orden, c.id`;
/* ==========================================================================
 * API pública
 * ======================================================================== */

/** Devuelve el nodo raíz (saludo inicial) o el nodo de una categoría. */
export async function obtenerNodo(categoriaClave: string = CATEGORIA_RAIZ): Promise<NodoMenu> {
  const cat = await query<RawCategoria>(SQL_CATEGORIA_POR_CLAVE, [categoriaClave]);
  const row = cat.rows[0];
  if (!row) throw notFound(`Categoría no encontrada: ${categoriaClave}`);

  const ops = await query<RawOpcion>(SQL_OPCIONES, [row.id]);
  return {
    categoria: toCategoria(row),
    mensaje: row.mensaje ?? row.nombre,
    opciones: ops.rows.map(toOpcion),
    esRaiz: row.es_raiz,
  };
}

export interface OpcionResuelta {
  clave: string;
  etiqueta: string;
  tipo: TipoOpcion;
  categoriaClave: string | null;
  respuestaId: number | null;
  opcionId: number;
}

/** Resuelve una opción por clave y devuelve la información necesaria. */
export async function obtenerOpcion(opcionClave: string): Promise<OpcionResuelta> {
  const r = await query<
    RawOpcion & { respuesta_id: number | null; categoria_destino_id: number | null; categoria_clave: string }
  >(SQL_OPCION_POR_CLAVE, [opcionClave]);
  const row = r.rows[0];
  if (!row) throw notFound(`Opción no encontrada: ${opcionClave}`);

  let destino: string | null = null;
  if (row.categoria_destino_id) {
    const d = await query<{ clave: string }>('SELECT clave FROM categoria WHERE id = $1', [row.categoria_destino_id]);
    destino = d.rows[0]?.clave ?? null;
  }

  return {
    clave: row.clave,
    etiqueta: row.etiqueta,
    tipo: row.tipo,
    categoriaClave: destino,
    respuestaId: row.respuesta_id,
    opcionId: row.id,
  };
}

/** Texto + documentos adjuntos de una respuesta. */
export async function obtenerRespuesta(respuestaId: number): Promise<Respuesta> {
  const r = await query<RawRespuesta>(SQL_RESPUESTA, [respuestaId]);
  const row = r.rows[0];
  if (!row) throw notFound(`Respuesta no encontrada: ${respuestaId}`);

  const docs = await query<RawDocumento>(SQL_DOCUMENTOS_DE_RESPUESTA, [respuestaId]);
  return { texto: row.texto, documentos: docs.rows.map(toDocumento) };
}

/** Contactos de derivación de una opción. */
export async function obtenerContactos(opcionId: number): Promise<Contacto[]> {
  const r = await query<RawContacto>(SQL_CONTACTOS_DE_OPCION, [opcionId]);
  return r.rows.map(toContacto);
}

/** Categorías del árbol, útil para el mapa de navegación y las pruebas. */
export async function listarCategorias(): Promise<Categoria[]> {
  const r = await query<RawCategoria>(
    'SELECT id, clave, nombre, mensaje, orden, es_raiz FROM categoria WHERE activo ORDER BY orden, id',
  );
  return r.rows.map(toCategoria);
}

/** Texto introductorio de una derivación (opcional). */
export async function textoDerivacion(respuestaId: number | null): Promise<string> {
  if (respuestaId === null) return 'Elegí con quién necesitás hablar.';
  try {
    const { texto } = await obtenerRespuesta(respuestaId);
    return texto;
  } catch {
    return 'Elegí con quién necesitás hablar.';
  }
}

export type { Derivacion };
