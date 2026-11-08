/**
 * Consultas de la carga: contenido de la planilla y fichas de documentos.
 *
 * Las funciones que reciben `client` corren dentro de la transacción de
 * `aplicarContenido`. Las demás usan el pool, como el resto de los repositorios.
 */

import type { PoolClient } from 'pg';
import { parsearDocumento } from '../lib/comisiones.js';
import { query } from '../db/pool.js';
import type { ArchivoDrive } from '../clients/drive.js';

/** Tablas que la carga identifica por `clave`. */
export type Tabla = 'menu_categoria' | 'respuesta' | 'opcion' | 'documento' | 'contacto';

export interface FichaDb {
  clave: string;
  drive_file_id: string | null;
  drive_md5: string | null;
  fragmentos_md5: string | null;
}

// ---------------------------------------------------------------------------
// Transacción: contenido de la planilla
// ---------------------------------------------------------------------------

/** Vacía las tablas que dependen de otras, para que no bloqueen los borrados que siguen. */
export async function vaciarDependientes(client: PoolClient): Promise<void> {
  await client.query('DELETE FROM termino_equivalente');
  await client.query('DELETE FROM termino_ignorado');
  await client.query('DELETE FROM palabra_vacia');
  await client.query('DELETE FROM termino_reconocimiento_fragmento');
  await client.query('DELETE FROM pregunta_variante');
  await client.query('DELETE FROM pregunta');
  await client.query('DELETE FROM respuesta_documento');
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
    `INSERT INTO menu_categoria (clave, nombre, mensaje, orden, es_raiz, activo)
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
    enMenu: boolean;
    orden: number;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO opcion (clave, categoria_id, etiqueta, tipo, categoria_destino_id, respuesta_id, es_volver, en_menu, orden, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
     ON CONFLICT (clave) DO UPDATE SET
       categoria_id = EXCLUDED.categoria_id, etiqueta = EXCLUDED.etiqueta, tipo = EXCLUDED.tipo,
       categoria_destino_id = EXCLUDED.categoria_destino_id, respuesta_id = EXCLUDED.respuesta_id,
       es_volver = EXCLUDED.es_volver, en_menu = EXCLUDED.en_menu, orden = EXCLUDED.orden, activo = TRUE`,
    [o.clave, o.categoriaId, o.etiqueta, o.tipo, o.destinoId, o.respuestaId, o.esVolver, o.enMenu, o.orden],
  );
}

/** Ficha del documento, por nombre de archivo. Los campos del nombre se guardan; Drive completa el resto después. */
export async function upsertDocumento(client: PoolClient, d: { clave: string }): Promise<void> {
  const p = parsearDocumento(d.clave);
  await client.query(
    `INSERT INTO documento (clave, materia, tipo, comision, anio, cuatrimestre)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (clave) DO UPDATE
        SET materia = EXCLUDED.materia, tipo = EXCLUDED.tipo, comision = EXCLUDED.comision,
            anio = EXCLUDED.anio, cuatrimestre = EXCLUDED.cuatrimestre`,
    [d.clave, p?.materia ?? null, p?.tipo ?? null, p?.comision ?? null, p?.anio ?? null, p?.cuatrimestre ?? null],
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
    opcionId: number | undefined;
  },
): Promise<void> {
  await client.query(
    `INSERT INTO contacto (clave, nombre, area, comision, email, url_perfil, motivo, orden, opcion_id, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE)
     ON CONFLICT (clave) DO UPDATE SET
       nombre = EXCLUDED.nombre, area = EXCLUDED.area, comision = EXCLUDED.comision,
       email = EXCLUDED.email, url_perfil = EXCLUDED.url_perfil, motivo = EXCLUDED.motivo,
       orden = EXCLUDED.orden, opcion_id = EXCLUDED.opcion_id, activo = TRUE`,
    [c.clave, c.nombre, c.area, c.comision, c.email, c.perfil, c.motivo, c.orden, c.opcionId],
  );
}

export async function insertarAlias(client: PoolClient, a: { alias: string; expansion: string }): Promise<void> {
  await client.query('INSERT INTO termino_equivalente (alias, expansion) VALUES ($1, $2)', [a.alias, a.expansion]);
}

export async function insertarIgnorado(client: PoolClient, termino: string): Promise<void> {
  await client.query('INSERT INTO termino_ignorado (termino) VALUES ($1)', [termino]);
}

/** Devuelve el id de la pregunta insertada. */
export async function insertarPregunta(
  client: PoolClient,
  p: { opcionId: number | undefined; pregunta: string; prioridad: number; umbral: number },
): Promise<number> {
  const r = await client.query<{ id: number }>(
    `INSERT INTO pregunta (opcion_id, pregunta, prioridad, umbral_minimo, activo)
     VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
    [p.opcionId, p.pregunta, p.prioridad, p.umbral],
  );
  return r.rows[0]!.id;
}

export async function insertarVariante(
  client: PoolClient,
  v: { preguntaId: number | undefined; texto: string; normalizado: string; peso: number },
): Promise<void> {
  await client.query(
    `INSERT INTO pregunta_variante (pregunta_id, texto_original, texto_normalizado, peso, activo)
     VALUES ($1, $2, $3, $4, TRUE)`,
    [v.preguntaId, v.texto, v.normalizado, v.peso],
  );
}

// ---------------------------------------------------------------------------
// Pool: documentos de Drive y fragmentos
// ---------------------------------------------------------------------------

/** Expansión del alias de una materia, por ejemplo "abd" → "administracion bases datos". */
export async function expansionDeAlias(alias: string): Promise<string | undefined> {
  const r = await query<{ expansion: string }>('SELECT expansion FROM termino_equivalente WHERE alias = $1', [alias]);
  return r.rows[0]?.expansion;
}

export async function fichasDocumentos(): Promise<FichaDb[]> {
  const r = await query<FichaDb>(
    `SELECT clave, drive_file_id, drive_md5, fragmentos_md5
       FROM documento
      ORDER BY clave`,
  );
  return r.rows;
}

/** Vincula la ficha con el archivo de Drive que le corresponde. */
export async function actualizarFicha(clave: string, archivo: Pick<ArchivoDrive, 'id' | 'md5'>): Promise<void> {
  await query(
    `UPDATE documento
        SET drive_file_id   = $1,
            drive_md5       = $2,
            sincronizado_en = now(),
            actualizado_en  = now()
      WHERE clave = $3`,
    [archivo.id, archivo.md5, clave],
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

/** Documentos vinculados cuyo archivo ya no está en la carpeta de Drive. */
export async function documentosAusentes(idsVistos: string[]): Promise<string[]> {
  const r = await query<{ clave: string }>(
    `SELECT clave
       FROM documento
      WHERE drive_file_id IS NOT NULL
        AND drive_file_id <> ALL($1::text[])
      ORDER BY clave`,
    [idsVistos],
  );
  return r.rows.map((x) => x.clave);
}

/**
 * Quita el archivo a los documentos que salieron de la carpeta. Sin archivo no hay
 * enlace ni texto que mostrar, así que también se borran sus fragmentos.
 */
export async function desvincularDocumentos(claves: string[]): Promise<void> {
  if (claves.length === 0) return;
  await query(
    `DELETE FROM documento_fragmento
      WHERE documento_id IN (SELECT id FROM documento WHERE clave = ANY($1::text[]))`,
    [claves],
  );
  await query(
    `UPDATE documento
        SET drive_file_id = NULL, drive_md5 = NULL, fragmentos_md5 = NULL, actualizado_en = now()
      WHERE clave = ANY($1::text[])`,
    [claves],
  );
}

export async function insertarTerminoFragmento(client: PoolClient, termino: string): Promise<void> {
  await client.query('INSERT INTO termino_reconocimiento_fragmento (termino) VALUES ($1)', [termino]);
}

/** Títulos que reconocen una sección dentro de los PDF. Llegan ya normalizados. */
export async function terminosFragmento(): Promise<string[]> {
  const r = await query<{ termino: string }>('SELECT termino FROM termino_reconocimiento_fragmento ORDER BY termino');
  return r.rows.map((x) => x.termino);
}

export async function insertarPalabraVacia(client: PoolClient, termino: string): Promise<void> {
  await client.query('INSERT INTO palabra_vacia (termino) VALUES ($1)', [termino]);
}
