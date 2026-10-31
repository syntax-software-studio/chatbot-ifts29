/**
 * Consultas de la carga: contenido de la planilla y fichas de documentos.
 *
 * Las funciones que reciben `client` corren dentro de la transacción de
 * `aplicarContenido`. Las demás usan el pool, como el resto de los repositorios.
 */

import type { PoolClient } from 'pg';
import { query } from '../db/pool.js';
import type { ArchivoDrive } from '../clients/drive.js';

/** Tablas que la carga identifica por `clave`. */
export type Tabla = 'categoria' | 'respuesta' | 'opcion_menu' | 'documento' | 'contacto' | 'kb_intencion';

export interface FichaDb {
  clave: string;
  drive_nombre_archivo: string | null;
  drive_file_id: string | null;
  drive_md5: string | null;
  fragmentos_md5: string | null;
}

// ---------------------------------------------------------------------------
// Transacción: contenido de la planilla
// ---------------------------------------------------------------------------

/** Vacía las tablas que dependen de otras, para que no bloqueen los borrados que siguen. */
export async function vaciarDependientes(client: PoolClient): Promise<void> {
  await client.query('DELETE FROM kb_alias');
  await client.query('DELETE FROM kb_termino_ignorado');
  await client.query('DELETE FROM kb_pregunta_variante');
  await client.query('DELETE FROM kb_pregunta');
  await client.query('DELETE FROM kb_intencion');
  await client.query('DELETE FROM respuesta_documento');
  await client.query('DELETE FROM opcion_contacto');
}

/** Mapa clave → id de una tabla. */
export async function idsPorClave(client: PoolClient, tabla: Tabla): Promise<Map<string, number>> {
  const r = await client.query<{ id: number; clave: string }>(`SELECT id, clave FROM ${tabla}`);
  return new Map(r.rows.map((row) => [row.clave, row.id]));
}

/** Borra las filas de la tabla cuya clave no está en `claves`. */
export async function borrarFueraDe(client: PoolClient, tabla: Tabla, claves: string[]): Promise<void> {
  await client.query(`DELETE FROM ${tabla} WHERE NOT (clave = ANY($1::text[]))`, [claves]);
}

export async function upsertCategoria(
  client: PoolClient,
  c: { clave: string; nombre: string; mensaje: string | null; orden: number; esRaiz: boolean },
): Promise<void> {
  await client.query(
    `INSERT INTO categoria (clave, nombre, mensaje, orden, es_raiz, activo)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (clave) DO UPDATE SET
       nombre = EXCLUDED.nombre, mensaje = EXCLUDED.mensaje,
       orden = EXCLUDED.orden, es_raiz = EXCLUDED.es_raiz, activo = TRUE`,
    [c.clave, c.nombre, c.mensaje, c.orden, c.esRaiz],
  );
}

export async function upsertRespuesta(client: PoolClient, r: { clave: string; texto: string; orden: number }): Promise<void> {
  await client.query(
    `INSERT INTO respuesta (clave, texto, orden, activo)
     VALUES ($1, $2, $3, TRUE)
     ON CONFLICT (clave) DO UPDATE SET texto = EXCLUDED.texto, orden = EXCLUDED.orden, activo = TRUE`,
    [r.clave, r.texto, r.orden],
  );
}

export async function upsertOpcion(
  client: PoolClient,
  o: {
    clave: string;
    categoriaId: number | undefined;
    etiqueta: string;
    tipo: string;
    destinoId: number | undefined;
    respuestaId: number | undefined;
    esVolver: boolean;
    orden: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO opcion_menu (clave, categoria_id, etiqueta, tipo, categoria_destino_id, respuesta_id, es_volver, orden, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     ON CONFLICT (clave) DO UPDATE SET
       categoria_id = EXCLUDED.categoria_id, etiqueta = EXCLUDED.etiqueta, tipo = EXCLUDED.tipo,
       categoria_destino_id = EXCLUDED.categoria_destino_id, respuesta_id = EXCLUDED.respuesta_id,
       es_volver = EXCLUDED.es_volver, orden = EXCLUDED.orden, activo = TRUE`,
    [o.clave, o.categoriaId, o.etiqueta, o.tipo, o.destinoId, o.respuestaId, o.esVolver, o.orden],
  );
}

/** Ficha del documento, por nombre de archivo. Drive completa el resto después. */
export async function upsertDocumento(client: PoolClient, d: { clave: string; nombreArchivo: string }): Promise<void> {
  await client.query(
    `INSERT INTO documento (clave, nombre, tipo, drive_nombre_archivo, vigente, estado)
     VALUES ($1, $2, 'documento', $2, TRUE, 'vigente')
     ON CONFLICT (clave) DO UPDATE SET drive_nombre_archivo = EXCLUDED.drive_nombre_archivo, vigente = TRUE, estado = 'vigente'`,
    [d.clave, d.nombreArchivo],
  );
}

export async function insertarAdjunto(
  client: PoolClient,
  a: { respuestaId: number | undefined; documentoId: number | undefined; orden: number },
): Promise<void> {
  await client.query('INSERT INTO respuesta_documento (respuesta_id, documento_id, orden) VALUES ($1, $2, $3)', [
    a.respuestaId,
    a.documentoId,
    a.orden,
  ]);
}

export async function upsertContacto(
  client: PoolClient,
  c: {
    clave: string;
    nombre: string;
    area: string | null;
    comision: string | null;
    email: string | null;
    perfil: string | null;
    motivo: string | null;
    orden: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO contacto (clave, nombre, area, comision, email, url_perfil, motivo, orden, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
     ON CONFLICT (clave) DO UPDATE SET
       nombre = EXCLUDED.nombre, area = EXCLUDED.area, comision = EXCLUDED.comision,
       email = EXCLUDED.email, url_perfil = EXCLUDED.url_perfil, motivo = EXCLUDED.motivo,
       orden = EXCLUDED.orden, activo = TRUE`,
    [c.clave, c.nombre, c.area, c.comision, c.email, c.perfil, c.motivo, c.orden],
  );
}

export async function insertarOpcionContacto(
  client: PoolClient,
  oc: { opcionId: number | undefined; contactoId: number | undefined; orden: number },
): Promise<void> {
  await client.query('INSERT INTO opcion_contacto (opcion_id, contacto_id, orden) VALUES ($1, $2, $3)', [
    oc.opcionId,
    oc.contactoId,
    oc.orden,
  ]);
}

export async function insertarAlias(client: PoolClient, a: { alias: string; expansion: string }): Promise<void> {
  await client.query('INSERT INTO kb_alias (alias, expansion) VALUES ($1, $2)', [a.alias, a.expansion]);
}

export async function insertarIgnorado(client: PoolClient, termino: string): Promise<void> {
  await client.query('INSERT INTO kb_termino_ignorado (termino) VALUES ($1)', [termino]);
}

export async function insertarIntencion(
  client: PoolClient,
  i: { clave: string; nombre: string; dominio: string; opcion: string },
): Promise<void> {
  await client.query(
    'INSERT INTO kb_intencion (clave, nombre, domain, opcion_clave, activo) VALUES ($1, $2, $3, $4, TRUE)',
    [i.clave, i.nombre, i.dominio, i.opcion],
  );
}

/** Devuelve el id de la pregunta insertada. */
export async function insertarPregunta(
  client: PoolClient,
  p: { intencionId: number | undefined; pregunta: string; prioridad: number; umbral: number },
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO kb_pregunta (intencion_id, pregunta, priority, minimum_threshold, activo)
     VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
    [p.intencionId, p.pregunta, p.prioridad, p.umbral],
  );
  return r.rows[0]!.id;
}

export async function insertarVariante(
  client: PoolClient,
  v: { preguntaId: number | undefined; texto: string; normalizado: string; peso: number },
): Promise<void> {
  await client.query(
    `INSERT INTO kb_pregunta_variante (pregunta_id, original_text, normalized_text, weight, activo)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [v.preguntaId, v.texto, v.normalizado, v.peso],
  );
}

// ---------------------------------------------------------------------------
// Pool: documentos de Drive y fragmentos
// ---------------------------------------------------------------------------

/** Expansión del alias de una materia, por ejemplo "abd" → "administracion bases datos". */
export async function expansionDeAlias(alias: string): Promise<string | undefined> {
  const r = await query<{ expansion: string }>('SELECT expansion FROM kb_alias WHERE alias = $1', [alias]);
  return r.rows[0]?.expansion;
}

export async function fichasDocumentos(): Promise<FichaDb[]> {
  const r = await query<FichaDb>(
    `SELECT clave, drive_nombre_archivo, drive_file_id, drive_md5, fragmentos_md5
       FROM documento
      WHERE estado <> 'archivado'
      ORDER BY clave`,
  );
  return r.rows;
}

/** Datos de Drive que guarda la ficha al sincronizarla. */
export async function actualizarFicha(
  clave: string,
  archivo: Pick<ArchivoDrive, 'id' | 'nombre' | 'mimeType' | 'md5' | 'modifiedTime'>,
  enlaces: { descarga: string; lectura: string },
): Promise<void> {
  await query(
    `UPDATE documento
        SET drive_file_id        = $1,
            drive_nombre_archivo = $2,
            mime_type            = $3,
            drive_md5            = $4,
            drive_modified_time  = $5,
            drive_url            = $6,
            drive_view_url       = $7,
            nombre               = COALESCE(NULLIF(nombre, ''), $2),
            sincronizado_en      = now(),
            actualizado_en       = now(),
            vigente              = TRUE,
            estado               = 'vigente'
      WHERE clave = $8`,
    [archivo.id, archivo.nombre, archivo.mimeType, archivo.md5, archivo.modifiedTime, enlaces.descarga, enlaces.lectura, clave],
  );
}

/**
 * Reemplaza los fragmentos de un documento y registra el MD5 del PDF del que salieron.
 * No es transaccional: si se corta a mitad, el documento queda con fragmentos parciales
 * y un MD5 viejo, así que la siguiente sincronización lo vuelve a extraer.
 */
export async function reemplazarFragmentos(
  clave: string,
  fragmentos: Array<{ orden: number; titulo: string; texto: string; textoBusqueda: string }>,
  md5: string | null,
): Promise<void> {
  await query('DELETE FROM documento_fragmento WHERE documento_id = (SELECT id FROM documento WHERE clave = $1)', [clave]);
  for (const f of fragmentos) {
    await query(
      `INSERT INTO documento_fragmento (documento_id, orden, titulo, texto, texto_busqueda)
       SELECT id, $2, $3, $4, $5 FROM documento WHERE clave = $1`,
      [clave, f.orden, f.titulo, f.texto, f.textoBusqueda],
    );
  }
  await query('UPDATE documento SET fragmentos_md5 = $2 WHERE clave = $1', [clave, md5]);
}

/** Documentos vigentes cuyo archivo ya no aparece en Drive. */
export async function contarHuerfanos(idsVistos: string[]): Promise<number> {
  const r = await query<{ n: number }>(
    `SELECT count(*)::int AS n
       FROM documento
      WHERE drive_file_id IS NOT NULL
        AND estado = 'vigente'
        AND drive_file_id <> ALL($1::text[])`,
    [idsVistos],
  );
  return r.rows[0]?.n ?? 0;
}
