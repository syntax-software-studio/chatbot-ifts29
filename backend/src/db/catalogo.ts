/**
 * Capa de acceso a datos del catálogo.
 *
 * Dos orígenes con la misma interfaz:
 *   - `neon` : PostgreSQL real (producción).
 *   - `seed` : catálogo en memoria (`db/002_seed.sql` replicado en TypeScript).
 *
 * Todas las consultas están parametrizadas y solo devuelven contenido
 * institucional. No se persiste ni se lee ningún dato del estudiante.
 */

import { query, getPool } from './pool.js';
import { seedData, type SeedData, type SeedContacto } from '../seed/catalogo.js';
import { notFound } from '../utils/errors.js';
import type {
  Categoria,
  Contacto,
  Documento,
  FuenteDatos,
  NodoMenu,
  OpcionMenu,
  Respuesta,
  Derivacion,
  TipoOpcion,
} from './types.js';

export const CATEGORIA_RAIZ = 'RAIZ';

/** ¿Estamos usando la base PostgreSQL o el catálogo semilla? */
export function fuente(): FuenteDatos {
  return getPool() ? 'base' : 'seed';
}

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
 * Lectura del árbol - Seed
 * ======================================================================== */

function seedOpcionesDe(categoriaId: number): OpcionMenu[] {
  return seedData.opciones
    .filter((o) => o.categoria_id === categoriaId && o.activo)
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .map(toOpcion);
}

function seedDocumentosDeRespuesta(respuestaId: number): Documento[] {
  return seedData.respuestaDocumento
    .filter((rd) => rd.respuesta_id === respuestaId)
    .sort((a, b) => a.orden - b.orden)
    .map((rd) => seedData.documentos.find((d) => d.id === rd.documento_id))
    .filter((d): d is NonNullable<typeof d> => Boolean(d))
    .map(toDocumento);
}

function seedContactosDeOpcion(opcionId: number): Contacto[] {
  return seedData.opcionContacto
    .filter((oc) => oc.opcion_id === opcionId)
    .sort((a, b) => a.orden - b.orden)
    .map((oc) => seedData.contactos.find((c) => c.id === oc.contacto_id))
    .filter((c): c is SeedContacto => c !== undefined && c.activo)
    .map(toContacto);
}

/* ==========================================================================
 * API pública
 * ======================================================================== */

/** Devuelve el nodo raíz (saludo inicial) o el nodo de una categoría. */
export async function obtenerNodo(categoriaClave: string = CATEGORIA_RAIZ): Promise<NodoMenu> {
  if (getPool()) {
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

  const cat = seedData.categorias.find((x) => x.clave === categoriaClave && x.activo);
  if (!cat) throw notFound(`Categoría no encontrada: ${categoriaClave}`);
  return {
    categoria: toCategoria(cat),
    mensaje: cat.mensaje ?? cat.nombre,
    opciones: seedOpcionesDe(cat.id),
    esRaiz: cat.es_raiz,
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
  if (getPool()) {
    const r = await query<
      RawOpcion & { respuesta_id: number | null; categoria_destino_id: number | null; categoria_clave: string }
    >(SQL_OPCION_POR_CLAVE, [opcionClave]);
    const row = r.rows[0];
    if (!row) throw notFound(`Opción no encontrada: ${opcionClave}`);

    let destino: string | null = null;
    if (row.categoria_destino_id) {
      const d = await query<{ clave: string }>('SELECT clave FROM categoria WHERE id = $1', [
        row.categoria_destino_id,
      ]);
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

  const o = seedData.opciones.find((x) => x.clave === opcionClave && x.activo);
  if (!o) throw notFound(`Opción no encontrada: ${opcionClave}`);
  const destinoCat = o.categoria_destino_id
    ? seedData.categorias.find((c) => c.id === o.categoria_destino_id)
    : undefined;

  return {
    clave: o.clave,
    etiqueta: o.etiqueta,
    tipo: o.tipo,
    categoriaClave: destinoCat?.clave ?? null,
    respuestaId: o.respuesta_id,
    opcionId: o.id,
  };
}

/** Texto + documentos adjuntos de una respuesta. */
export async function obtenerRespuesta(respuestaId: number): Promise<Respuesta> {
  if (getPool()) {
    const r = await query<RawRespuesta>(SQL_RESPUESTA, [respuestaId]);
    const row = r.rows[0];
    if (!row) throw notFound(`Respuesta no encontrada: ${respuestaId}`);

    const docs = await query<RawDocumento>(SQL_DOCUMENTOS_DE_RESPUESTA, [respuestaId]);
    return { texto: row.texto, documentos: docs.rows.map(toDocumento) };
  }

  const resp = seedData.respuestas.find((x) => x.id === respuestaId && x.activo);
  if (!resp) throw notFound(`Respuesta no encontrada: ${respuestaId}`);
  return { texto: resp.texto, documentos: seedDocumentosDeRespuesta(respuestaId) };
}

/** Contactos de derivación de una opción. */
export async function obtenerContactos(opcionId: number): Promise<Contacto[]> {
  if (getPool()) {
    const r = await query<RawContacto>(SQL_CONTACTOS_DE_OPCION, [opcionId]);
    return r.rows.map(toContacto);
  }
  return seedContactosDeOpcion(opcionId);
}

/** Categorías hoja del árbol, útil para el mapa de navegación y las pruebas. */
export async function listarCategorias(): Promise<Categoria[]> {
  if (getPool()) {
    const r = await query<RawCategoria>(
      'SELECT id, clave, nombre, mensaje, orden, es_raiz FROM categoria WHERE activo ORDER BY orden, id',
    );
    return r.rows.map(toCategoria);
  }
  return seedData.categorias
    .filter((c) => c.activo)
    .sort((a, b) => a.orden - b.orden || a.id - b.id)
    .map(toCategoria);
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
export { seedData };
export type { SeedData };
