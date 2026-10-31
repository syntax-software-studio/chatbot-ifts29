/**
 * Carga (ETL, paso 3): escribe en la base.
 *  - `aplicarContenido`: contenido de la planilla, en una transacción.
 *  - `sincronizarDocumentos`: fichas de documentos con Drive y sus fragmentos.
 *
 * Pendiente: las consultas SQL de este archivo están inline. Moverlas a
 * repositories/sync-load.repository.ts.
 */

import type { PoolClient } from 'pg';
import { getPool, query } from '../db/pool.js';
import { env, hasGoogleDrive } from '../config/env.js';
import { normalizar, normalizarConsulta } from '../lib/normalizar.js';
import {
  type ArchivoDrive,
  descargarArchivo,
  enlaceDeDescarga,
  enlaceDeLectura,
  listarArchivos,
} from '../clients/drive.js';
import { extraerFragmentos } from './sync-extract.service.js';
import type {
  Alias,
  Categoria,
  Contacto,
  DatosContenido,
  Documento,
  Intencion,
  Opcion,
  Pregunta,
  Respuesta,
  RespuestaDocumento,
  ResumenCarga,
  TerminoIgnorado,
  Variante,
} from './sync-transform.service.js';

export interface ResultadoSync {
  ejecutada: boolean;
  dryRun: boolean;
  archivosVistos: number;
  actualizados: number;
  sinMatch: Array<{ clave: string; archivoEsperado: string }>;
  mensajes: string[];
}

interface FichaDb {
  clave: string;
  drive_nombre_archivo: string | null;
  drive_file_id: string | null;
  drive_md5: string | null;
  fragmentos_md5: string | null;
}

/**
 * Clave para emparejar nombres de archivo: minúsculas, sin tildes, separadores
 * como guiones bajos. No es normalización de texto para buscar; es el identificador
 * con el que se compara el nombre que espera la base con el nombre real en Drive.
 */
function claveDeArchivo(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Reemplaza los fragmentos de un documento a partir de su PDF en Drive.
 *
 * Se llama solo cuando el archivo cambió (md5 distinto) o los fragmentos son de
 * otra versión. Si la descarga o la extracción fallan, no se tocan los fragmentos
 * anteriores: la sincronización sigue con los demás documentos.
 */
async function actualizarFragmentos(
  clave: string,
  archivo: { id: string; md5: string | null },
  mensajes: string[],
): Promise<void> {
  try {
    const fragmentos = await extraerFragmentos(await descargarArchivo(archivo.id));
    // El nombre de la materia (por ejemplo "administracion bases datos" para ABD)
    // entra en el texto de búsqueda: casi ninguna sección lo repite.
    const codigo = clave.split('_')[0]!.toLowerCase();
    const materia = (await query<{ expansion: string }>('SELECT expansion FROM kb_alias WHERE alias = $1', [codigo])).rows[0]?.expansion ?? '';
    await query('DELETE FROM documento_fragmento WHERE documento_id = (SELECT id FROM documento WHERE clave = $1)', [clave]);
    for (const [i, f] of fragmentos.entries()) {
      await query(
        `INSERT INTO documento_fragmento (documento_id, orden, titulo, texto, texto_busqueda)
         SELECT id, $2, $3, $4, $5 FROM documento WHERE clave = $1`,
        [clave, i + 1, f.titulo, f.texto, normalizar(`${materia} ${f.titulo} ${f.texto}`)],
      );
    }
    await query('UPDATE documento SET fragmentos_md5 = $2 WHERE clave = $1', [clave, archivo.md5]);
    mensajes.push(
      fragmentos.length > 0
        ? `fragmentos: ${clave} -> ${fragmentos.length}`
        : `fragmentos: ${clave} sin texto extraíble (se muestra el documento completo)`,
    );
  } catch (err) {
    mensajes.push(`fragmentos: ${clave} falló: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Sincroniza las fichas de `documento` con el contenido real de Drive.
 *
 * Emparejamiento (exacto, sin heurísticas):
 *  1. Por `drive_file_id` ya conocido (idempotencia: solo refresca metadata).
 *  2. Por nombre normalizado exacto del archivo esperado.
 *
 * No se usa un match aproximado por prefijo de materia: "Programa" y
 * "Cronograma" de una misma materia comparten prefijo, así que un match laxo
 * podría adjuntar el PDF equivocado al estudiante. Un enlace incorrecto es
 * peor que un enlace ausente (RF07), por eso los que no coinciden se reportan
 * en `sinMatch` para que el equipo renombre el archivo en Drive.
 *
 * No borra documentos: los que dejan de aparecer en Drive se marcan como
 * `vigente = false` en vez de desaparecer, para que el estudiante nunca reciba un
 * enlace roto (RF07).
 */
export async function sincronizarDocumentos(opciones: { carpetaId?: string; dryRun?: boolean } = {}): Promise<ResultadoSync> {
  const mensajes: string[] = [];
  const resultado: ResultadoSync = {
    ejecutada: false,
    dryRun: opciones.dryRun ?? false,
    archivosVistos: 0,
    actualizados: 0,
    sinMatch: [],
    mensajes,
  };

  if (!hasGoogleDrive()) {
    mensajes.push('Google Drive no configurado: se omite la sincronización.');
    return resultado;
  }

  const archivos = await listarArchivos(opciones.carpetaId);
  resultado.archivosVistos = archivos.length;
  resultado.ejecutada = true;

  const porNombre = new Map<string, ArchivoDrive>();
  for (const a of archivos) {
    porNombre.set(claveDeArchivo(a.nombre), a);
  }

  const fichas = await query<FichaDb>(
    `SELECT clave, drive_nombre_archivo, drive_file_id, drive_md5, fragmentos_md5
       FROM documento
      WHERE estado <> 'archivado'
      ORDER BY clave`,
  );

  for (const ficha of fichas.rows) {
    const esperado = ficha.drive_nombre_archivo;
    let archivo: ArchivoDrive | undefined;

    if (ficha.drive_file_id) {
      archivo = archivos.find((a) => a.id === ficha.drive_file_id);
    }
    if (!archivo && esperado) {
      archivo = porNombre.get(claveDeArchivo(esperado));
    }

    if (!archivo) {
      resultado.sinMatch.push({ clave: ficha.clave, archivoEsperado: esperado ?? '(sin nombre)' });
      continue;
    }

    const cambio = archivo.id !== ficha.drive_file_id || archivo.md5 !== ficha.drive_md5;
    if (!cambio && !resultado.dryRun) {
      // Ya estaba sincronizado. Solo se extrae si los fragmentos no son de esta
      // versión del archivo (por ejemplo, documentos anteriores a la extracción).
      if (archivo.mimeType === 'application/pdf' && ficha.fragmentos_md5 !== archivo.md5) {
        await actualizarFragmentos(ficha.clave, archivo, mensajes);
      }
      continue;
    }

    if (!resultado.dryRun) {
      const enlace = await enlaceDeLectura(archivo.id);
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
        [
          archivo.id,
          archivo.nombre,
          archivo.mimeType,
          archivo.md5,
          archivo.modifiedTime,
          enlaceDeDescarga(archivo.id),
          enlace,
          ficha.clave,
        ],
      );
    }

    if (cambio && archivo.mimeType === 'application/pdf') {
      await actualizarFragmentos(ficha.clave, archivo, mensajes);
    }

    resultado.actualizados += 1;
    mensajes.push(`${cambio ? 'actualizado' : 'verificado'}: ${ficha.clave} -> ${archivo.nombre}`);
  }

  // Fichas ya sincronizadas cuyo archivo desapareció de Drive.
  if (!resultado.dryRun) {
    const r = await query<{ n: number }>(
      `SELECT count(*)::int AS n
         FROM documento
        WHERE drive_file_id IS NOT NULL
          AND estado = 'vigente'
          AND drive_file_id <> ALL($1::text[])`,
      [archivos.map((a) => a.id)],
    );
    const huerfanos = r.rows[0]?.n ?? 0;
    if (huerfanos > 0) {
      mensajes.push(
        `${huerfanos} documento(s) marcados como vigente pero ausentes de Drive: revisar antes de publicar.`,
      );
    }
  }

  return resultado;
}

/** Escribe el contenido en una sola transacción. Si algo falla, no queda nada a medias. */
export async function aplicarContenido(datos: DatosContenido): Promise<ResumenCarga> {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL no configurada: no hay base donde cargar el contenido.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resumen = await escribir(client, datos);
    await client.query('COMMIT');
    return resumen;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function escribir(client: PoolClient, datos: DatosContenido): Promise<ResumenCarga> {
  const ids = async (tabla: string): Promise<Map<string, number>> => {
    const r = await client.query<{ id: number; clave: string }>(`SELECT id, clave FROM ${tabla}`);
    return new Map(r.rows.map((row) => [row.clave, row.id]));
  };
  const claves = (xs: { clave: string }[]) => xs.map((x) => x.clave);

  // Primero se vacían las tablas que dependen de otras, para que no bloqueen
  // los borrados de menú, respuestas y documentos que vienen después.
  await client.query('DELETE FROM kb_alias');
  await client.query('DELETE FROM kb_termino_ignorado');
  await client.query('DELETE FROM kb_pregunta_variante');
  await client.query('DELETE FROM kb_pregunta');
  await client.query('DELETE FROM kb_intencion');
  await client.query('DELETE FROM respuesta_documento');
  await client.query('DELETE FROM opcion_contacto');

  // Menú: upsert por clave; lo que ya no está en la planilla se borra.
  for (const c of datos.categorias) {
    await client.query(
      `INSERT INTO categoria (clave, nombre, mensaje, orden, es_raiz, activo)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (clave) DO UPDATE SET
         nombre = EXCLUDED.nombre, mensaje = EXCLUDED.mensaje,
         orden = EXCLUDED.orden, es_raiz = EXCLUDED.es_raiz, activo = TRUE`,
      [c.clave, c.nombre, c.mensaje, c.orden, c.esRaiz],
    );
  }
  for (const r of datos.respuestas) {
    await client.query(
      `INSERT INTO respuesta (clave, texto, orden, activo)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (clave) DO UPDATE SET texto = EXCLUDED.texto, orden = EXCLUDED.orden, activo = TRUE`,
      [r.clave, r.texto, r.orden],
    );
  }

  // Opciones: necesitan los ids de categoría y respuesta.
  await client.query('DELETE FROM opcion_menu WHERE NOT (clave = ANY($1::text[]))', [claves(datos.opciones)]);
  const categoriaId = await ids('categoria');
  const respuestaId = await ids('respuesta');
  for (const o of datos.opciones) {
    await client.query(
      `INSERT INTO opcion_menu (clave, categoria_id, etiqueta, tipo, categoria_destino_id, respuesta_id, es_volver, orden, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       ON CONFLICT (clave) DO UPDATE SET
         categoria_id = EXCLUDED.categoria_id, etiqueta = EXCLUDED.etiqueta, tipo = EXCLUDED.tipo,
         categoria_destino_id = EXCLUDED.categoria_destino_id, respuesta_id = EXCLUDED.respuesta_id,
         es_volver = EXCLUDED.es_volver, orden = EXCLUDED.orden, activo = TRUE`,
      [
        o.clave,
        categoriaId.get(o.categoria),
        o.etiqueta,
        o.tipo,
        o.destino ? categoriaId.get(o.destino) : null,
        o.respuesta ? respuestaId.get(o.respuesta) : null,
        o.esVolver,
        o.orden,
      ],
    );
  }
  await client.query('DELETE FROM categoria WHERE NOT (clave = ANY($1::text[]))', [claves(datos.categorias)]);
  await client.query('DELETE FROM respuesta WHERE NOT (clave = ANY($1::text[]))', [claves(datos.respuestas)]);

  // Documentos: fichas por nombre de archivo. Drive completa el resto.
  for (const d of datos.documentos) {
    await client.query(
      `INSERT INTO documento (clave, nombre, tipo, drive_nombre_archivo, vigente, estado)
       VALUES ($1, $2, 'documento', $2, TRUE, 'vigente')
       ON CONFLICT (clave) DO UPDATE SET drive_nombre_archivo = EXCLUDED.drive_nombre_archivo, vigente = TRUE, estado = 'vigente'`,
      [d.clave, d.nombreArchivo],
    );
  }
  // Fichas que la planilla ya no referencia se borran: el historial vive en la planilla.
  await client.query('DELETE FROM documento WHERE NOT (clave = ANY($1::text[]))', [claves(datos.documentos)]);
  const documentoId = await ids('documento');

  // Adjuntos: ya se borraron al inicio; se insertan de nuevo.
  for (const rd of datos.respuestaDocumentos) {
    await client.query(
      'INSERT INTO respuesta_documento (respuesta_id, documento_id, orden) VALUES ($1, $2, $3)',
      [respuestaId.get(rd.respuesta), documentoId.get(rd.documento), rd.orden],
    );
  }

  // Contactos: upsert; la asociación con derivación se reemplaza completa.
  for (const c of datos.contactos) {
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
  await client.query('DELETE FROM contacto WHERE NOT (clave = ANY($1::text[]))', [claves(datos.contactos)]);

  // Derivación: cada contacto pertenece a una sola opción de tipo 'derivar'.
  const contactoId = await ids('contacto');
  const opcionMenuId = await ids('opcion_menu');
  for (const c of datos.contactos) {
    await client.query(
      'INSERT INTO opcion_contacto (opcion_id, contacto_id, orden) VALUES ($1, $2, $3)',
      [opcionMenuId.get(c.opcion), contactoId.get(c.clave), c.orden],
    );
  }
  const opcionContacto = datos.contactos.length;

  // Base de conocimiento: ya se borró al inicio; se inserta de nuevo.
  for (const a of datos.alias) {
    await client.query('INSERT INTO kb_alias (alias, expansion) VALUES ($1, $2)', [a.alias, a.expansion]);
  }
  for (const t of datos.ignorados) {
    await client.query('INSERT INTO kb_termino_ignorado (termino) VALUES ($1)', [t.termino]);
  }
  for (const i of datos.intenciones) {
    await client.query(
      'INSERT INTO kb_intencion (clave, nombre, domain, opcion_clave, activo) VALUES ($1, $2, $3, $4, TRUE)',
      [i.clave, i.nombre, i.dominio, i.opcion],
    );
  }
  const intencionId = await ids('kb_intencion');

  const preguntaIdPorClave = new Map<string, number>();
  for (const p of datos.preguntas) {
    const r = await client.query<{ id: number }>(
      `INSERT INTO kb_pregunta (intencion_id, pregunta, priority, minimum_threshold, activo)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
      [intencionId.get(p.intencion), p.pregunta, p.prioridad, p.umbral],
    );
    preguntaIdPorClave.set(`${p.intencion}\u0000${p.pregunta}`, r.rows[0]!.id);
  }

  for (const v of datos.variantes) {
    await client.query(
      `INSERT INTO kb_pregunta_variante (pregunta_id, original_text, normalized_text, weight, activo)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [preguntaIdPorClave.get(`${v.intencion}\u0000${v.pregunta}`), v.texto, v.normalizado, v.peso],
    );
  }

  return {
    categorias: datos.categorias.length,
    respuestas: datos.respuestas.length,
    opciones: datos.opciones.length,
    documentos: datos.documentos.length,
    respuestaDocumentos: datos.respuestaDocumentos.length,
    intenciones: datos.intenciones.length,
    preguntas: datos.preguntas.length,
    variantes: datos.variantes.length,
    contactos: datos.contactos.length,
    opcionContacto,
  };
}
