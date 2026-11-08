/**
 * Carga (ETL, paso 3): escribe en la base.
 *  - `aplicarContenido`: contenido de la planilla, en una transacción.
 *  - `sincronizarDocumentos`: fichas de documentos con Drive y sus fragmentos.
 *
 * Las consultas SQL están en `repositories/sync-load.repository.ts`.
 */

import type { PoolClient } from 'pg';
import { getPool } from '../db/pool.js';
import { hasGoogleDrive } from '../config/env.js';
import { parsearDocumento } from '../lib/comisiones.js';
import { normalizar } from '../lib/normalizar.js';
import * as driveReal from '../clients/drive.js';
import type { ArchivoDrive } from '../clients/drive.js';
import {
  actualizarFicha,
  borrarFueraDe,
  desvincularDocumentos,
  documentosAusentes,
  expansionDeAlias,
  fichasDocumentos,
  idsPorClave,
  insertarAdjunto,
  insertarAlias,
  insertarIgnorado,
  insertarPalabraVacia,
  insertarTerminoFragmento,
  terminosFragmento,
  insertarPregunta,
  insertarVariante,
  reemplazarFragmentos,
  upsertCategoria,
  upsertContacto,
  upsertDocumento,
  upsertOpcion,
  upsertRespuesta,
  vaciarDependientes,
} from '../repositories/sync-load.repository.js';
import { extraerFragmentos } from './sync-extract.service.js';
import { firmaExtraccion } from '../lib/fragmentos.js';
import type { DatosContenido, ResumenCarga } from './sync-transform.service.js';

/** Lo que la sincronización necesita de Drive. Por defecto, el cliente real; en pruebas, un fake. */
export type PuertoDrive = Pick<typeof driveReal, 'listarArchivos' | 'descargarArchivo' | 'enlaceDeLectura' | 'enlaceDeDescarga'>;

export interface OpcionesDocumentos {
  carpetaId?: string;
  dryRun?: boolean;
  drive?: PuertoDrive;
  /** Recibe cada avance de la sincronización, para mostrarlo mientras corre. */
  progreso?: (linea: string) => void;
}

export interface ResultadoSync {
  ejecutada: boolean;
  dryRun: boolean;
  archivosVistos: number;
  actualizados: number;
  sinMatch: Array<{ clave: string; archivoEsperado: string }>;
  mensajes: string[];
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
function conTiempoLimite<T>(promesa: Promise<T>, ms: number, que: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limite = new Promise<never>((_, rechazar) => {
    timer = setTimeout(() => rechazar(new Error(`${que}: más de ${ms / 1000} s`)), ms);
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(timer));
}

async function actualizarFragmentos(
  clave: string,
  archivo: { id: string; md5: string | null },
  registrar: (mensaje: string) => void,
  drive: PuertoDrive,
  titulos: string[],
): Promise<void> {
  try {
    if (parsearDocumento(clave)?.tipo === 'cronograma') {
      registrar(`fragmentos: ${clave} omitido (cronograma en tabla, no fragmentable)`);
      return;
    }
    const bytes = await conTiempoLimite(drive.descargarArchivo(archivo.id), 60_000, `descarga de ${clave}`);
    const fragmentos = await extraerFragmentos(bytes, titulos);
    // El nombre de la materia (por ejemplo "administracion bases datos" para ABD)
    // entra en el texto de búsqueda: casi ninguna sección lo repite.
    const codigo = clave.split('_')[0]!.toLowerCase();
    const materia = (await expansionDeAlias(codigo)) ?? '';
    await reemplazarFragmentos(
      clave,
      fragmentos.map((f, i) => ({
        orden: i + 1,
        titulo: f.titulo,
        texto: f.texto,
        textoBusqueda: normalizar(`${materia} ${f.titulo} ${f.texto}`),
      })),
      firmaExtraccion(archivo.md5 ?? '', titulos),
    );
    registrar(
      fragmentos.length > 0
        ? `fragmentos: ${clave} -> ${fragmentos.length}`
        : `fragmentos: ${clave} sin texto extraíble (se muestra el documento completo)`,
    );
  } catch (err) {
    registrar(`fragmentos: ${clave} falló: ${err instanceof Error ? err.message : String(err)}`);
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
 * No borra documentos: los que dejan de aparecer en Drive pierden su archivo
 * (`drive_file_id`). Sin archivo el bot no ofrece enlace, así que el estudiante
 * nunca recibe uno roto (RF07).
 */
export async function sincronizarDocumentos(opciones: OpcionesDocumentos = {}): Promise<ResultadoSync> {
  const drive = opciones.drive ?? driveReal;
  const mensajes: string[] = [];
  const avisar = opciones.progreso ?? (() => {});
  const registrar = (mensaje: string) => {
    mensajes.push(mensaje);
    avisar(mensaje);
  };
  const resultado: ResultadoSync = {
    ejecutada: false,
    dryRun: opciones.dryRun ?? false,
    archivosVistos: 0,
    actualizados: 0,
    sinMatch: [],
    mensajes,
  };

  if (!opciones.drive && !hasGoogleDrive()) {
    registrar('Google Drive no configurado: se omite la sincronización.');
    return resultado;
  }

  const archivos = await drive.listarArchivos(opciones.carpetaId);
  resultado.archivosVistos = archivos.length;
  resultado.ejecutada = true;

  const porNombre = new Map<string, ArchivoDrive>();
  for (const a of archivos) {
    porNombre.set(claveDeArchivo(a.nombre), a);
  }

  const fichas = await fichasDocumentos();
  const titulos = await terminosFragmento();

  for (const [i, ficha] of fichas.entries()) {
    avisar(`[${i + 1}/${fichas.length}] ${ficha.clave}`);
    if (!parsearDocumento(ficha.clave)) {
      registrar(`nombre fuera de la convención: ${ficha.clave} (sus campos de materia, tipo y año quedan vacíos)`);
    }
    const esperado = `${ficha.clave}.pdf`;
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
      if (archivo.mimeType === 'application/pdf' && ficha.fragmentos_md5 !== firmaExtraccion(archivo.md5 ?? '', titulos)) {
        await actualizarFragmentos(ficha.clave, archivo, registrar, drive, titulos);
      }
      continue;
    }

    if (!resultado.dryRun) {
      // Hace público el archivo si la configuración lo pide. El enlace se calcula al consultar.
      await drive.enlaceDeLectura(archivo.id);
      await actualizarFicha(ficha.clave, archivo);
    }

    if (cambio && archivo.mimeType === 'application/pdf') {
      await actualizarFragmentos(ficha.clave, archivo, registrar, drive, titulos);
    }

    resultado.actualizados += 1;
    registrar(`${cambio ? 'actualizado' : 'verificado'}: ${ficha.clave} -> ${archivo.nombre}`);
  }

  // Documentos vinculados cuyo archivo ya no está en la carpeta.
  const ausentes = await documentosAusentes(archivos.map((a) => a.id));
  if (!resultado.dryRun) await desvincularDocumentos(ausentes);
  for (const clave of ausentes) {
    registrar(`sin archivo en Drive: ${clave} (el bot no ofrece enlace hasta que se vuelva a subir)`);
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
  const claves = (xs: { clave: string }[]) => xs.map((x) => x.clave);

  // Primero se vacían las tablas que dependen de otras, para que no bloqueen
  // los borrados de menú, respuestas y documentos que vienen después.
  await vaciarDependientes(client);

  // Menú: upsert por clave; lo que ya no está en la planilla se borra.
  for (const c of datos.categorias) await upsertCategoria(client, c);
  for (const r of datos.respuestas) await upsertRespuesta(client, r);

  // Opciones: necesitan los ids de categoría y respuesta.
  await borrarFueraDe(client, 'opcion', claves(datos.opciones));
  const categoriaId = await idsPorClave(client, 'menu_categoria');
  const respuestaId = await idsPorClave(client, 'respuesta');
  for (const o of datos.opciones) {
    await upsertOpcion(client, {
      clave: o.clave,
      categoriaId: categoriaId.get(o.categoria),
      etiqueta: o.etiqueta,
      tipo: o.tipo,
      destinoId: o.destino ? categoriaId.get(o.destino) : undefined,
      respuestaId: o.respuesta ? respuestaId.get(o.respuesta) : undefined,
      esVolver: o.esVolver,
      enMenu: o.enMenu,
      orden: o.orden,
    });
  }
  await borrarFueraDe(client, 'menu_categoria', claves(datos.categorias));
  await borrarFueraDe(client, 'respuesta', claves(datos.respuestas));

  // Documentos: fichas por nombre de archivo. Las que la planilla ya no referencia
  // se borran: el historial vive en la planilla.
  for (const d of datos.documentos) await upsertDocumento(client, d);
  await borrarFueraDe(client, 'documento', claves(datos.documentos));
  const documentoId = await idsPorClave(client, 'documento');

  // Adjuntos: ya se borraron al inicio; se insertan de nuevo.
  for (const rd of datos.respuestaDocumentos) {
    await insertarAdjunto(client, {
      respuestaId: respuestaId.get(rd.respuesta),
      documentoId: documentoId.get(rd.documento),
      orden: rd.orden,
    });
  }

  // Contactos: cada uno pertenece a una sola opción de derivación ('derivar').
  const opcionMenuId = await idsPorClave(client, 'opcion');
  for (const c of datos.contactos) {
    await upsertContacto(client, { ...c, opcionId: opcionMenuId.get(c.opcion) });
  }
  await borrarFueraDe(client, 'contacto', claves(datos.contactos));

  // Base de conocimiento: ya se borró al inicio; se inserta de nuevo.
  for (const a of datos.alias) await insertarAlias(client, a);
  for (const t of datos.ignorados) await insertarIgnorado(client, t.termino);
  for (const p of datos.palabrasVacias) await insertarPalabraVacia(client, p);
  for (const t of datos.terminosFragmento) await insertarTerminoFragmento(client, t);

  const preguntaIdPorClave = new Map<string, number>();
  for (const p of datos.preguntas) {
    const id = await insertarPregunta(client, {
      opcionId: opcionMenuId.get(p.opcion),
      pregunta: p.pregunta,
      prioridad: p.prioridad,
      umbral: p.umbral,
    });
    preguntaIdPorClave.set(`${p.opcion}\u0000${p.pregunta}`, id);
  }

  for (const v of datos.variantes) {
    await insertarVariante(client, {
      preguntaId: preguntaIdPorClave.get(`${v.opcion}\u0000${v.pregunta}`),
      texto: v.texto,
      normalizado: v.normalizado,
      peso: v.peso,
    });
  }

  return {
    categorias: datos.categorias.length,
    respuestas: datos.respuestas.length,
    opciones: datos.opciones.length,
    documentos: datos.documentos.length,
    respuestaDocumentos: datos.respuestaDocumentos.length,
    preguntas: datos.preguntas.length,
    variantes: datos.variantes.length,
    contactos: datos.contactos.length,
  };
}
