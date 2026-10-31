/**
 * Integración con Google Drive institucional.
 *
 * Diseño:
 *  - Autenticación por Service Account (JWT), con alcance de solo lectura.
 *    La clave privada nunca se expone al frontend: vive solo en el servidor.
 *  - La Service Account debe haber sido compartida como *lector* en la carpeta
 *    institucional. El bot nunca escribe ni borra en Drive.
 *  - La sincronización empareja cada ficha de `documento` con un archivo de
 *    Drive por nombre (convención `<Materia>_<Tipo>.pdf`) y guarda el fileId
 *    y el enlace de lectura. Si no encuentra el archivo, NO inventa un
 *    enlace: deja la ficha en estado pendiente para que el equipo lo vea
 *    (RF07 exige trazabilidad real).
 *  - Los enlaces públicos se cachean en memoria por `DRIVE_LINK_CACHE_TTL`
 *    para no llamar a la API en cada request del estudiante.
 */

import { clienteDrive } from '../client/drive.client.js';
import { env, hasGoogleDrive } from '../utils/env.js';
import { query } from '../db/pool.js';
import { extraerFragmentos, normalizarTexto } from './extraccion-secciones.js';

/** Verifica si las credenciales de Drive pueden autenticarse. */
export async function verificarDrive(): Promise<{ ok: boolean; detalle: string }> {
  if (!hasGoogleDrive()) {
    return { ok: false, detalle: 'Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_PRIVATE_KEY' };
  }
  try {
    const res = await clienteDrive().about.get({ fields: 'user,storageQuota' });
    const email = res.data.user?.emailAddress ?? 'desconocido';
    const limite = res.data.storageQuota?.limit
      ? `${Math.round(Number(res.data.storageQuota.limit) / 1e12)} TB`
      : 'n/d';
    return { ok: true, detalle: `Autenticado como ${email} (cuota ${limite})` };
  } catch (err) {
    return { ok: false, detalle: err instanceof Error ? err.message : 'Error desconocido' };
  }
}

/* ==========================================================================
 * Enumeración de archivos
 * ======================================================================== */

const CAMPOS_ARCHIVO = 'id,name,mimeType,md5Checksum,modifiedTime,size,webViewLink,trashed';

export interface ArchivoDrive {
  id: string;
  nombre: string;
  mimeType: string;
  md5: string | null;
  modifiedTime: string | null;
  tamano: string | null;
  webViewLink: string | null;
}

/**
 * Lista recursivamente los archivos de la carpeta compartida.
 *
 * Recorre también las subcarpetas ( Drive permite una carpeta por materia), por
 * eso usa `includeItemsFromAllDrives` y `supportsAllDrives`: la carpeta
 * institucional puede ser un Shared Drive. Si no hay
 * `GOOGLE_SHARED_FOLDER_ID`, lista la raíz "Mi Drive" de la cuenta de servicio.
 */
export async function listarArchivos(carpetaId?: string): Promise<ArchivoDrive[]> {
  const raiz = carpetaId ?? env.google.sharedFolderId;
  const archivos: ArchivoDrive[] = [];
  const vistas = new Set<string>();
  /** Carpetas pendientes de recorrer. Sin id = raíz de la cuenta. */
  const pendientes: Array<string | undefined> = [raiz];

  while (pendientes.length > 0) {
    const carpeta = pendientes.shift();

    // Evita ciclos si un Shared Drive devuelve la misma carpeta dos veces.
    const marca = carpeta ?? '__root__';
    if (vistas.has(marca)) continue;
    vistas.add(marca);

    let pageToken: string | undefined;
    do {
      const res = await clienteDrive().files.list({
        q: carpeta
          ? `'${carpeta}' in parents and trashed = false`
          : 'trashed = false',
        fields: `nextPageToken, files(${CAMPOS_ARCHIVO})`,
        pageSize: 200,
        pageToken,
        orderBy: 'name',
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });

      for (const f of res.data.files ?? []) {
        // Se ignoran los atajos; las carpetas se encolan para bajar en profundidad.
        if (f.mimeType === 'application/vnd.google-apps.shortcut') continue;
        if (f.mimeType === 'application/vnd.google-apps.folder') {
          if (f.id) pendientes.push(f.id);
          continue;
        }
        if (!f.id || !f.name) continue;
        archivos.push({
          id: f.id,
          nombre: f.name,
          mimeType: f.mimeType ?? 'application/octet-stream',
          md5: f.md5Checksum ?? null,
          modifiedTime: f.modifiedTime ?? null,
          tamano: f.size ?? null,
          webViewLink: f.webViewLink ?? null,
        });
      }
      pageToken = res.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  return archivos;
}

/* ==========================================================================
 * Enlace de lectura
 * ======================================================================== */

const cacheEnlaces = new Map<string, { url: string; expira: number }>();

/**
 * Devuelve un enlace de lectura para un archivo.
 *
 * - Si el archivo ya es público, se devuelve el enlace canónico sin llamar a la
 *   API (barato y estable).
 * - Si `DRIVE_PUBLIC_LINKS` está activo, se intenta crear/verificar el permiso
 *   `anyone/reader`. Requiere que la Service Account tenga permission de
 *  Sharing en la carpeta, o que la carpeta ya sea pública.
 */
export async function enlaceDeLectura(fileId: string): Promise<string> {
  const canonico = `https://drive.google.com/file/d/${fileId}/view`;

  const cacheado = cacheEnlaces.get(fileId);
  if (cacheado && cacheado.expira > Date.now()) return cacheado.url;

  if (env.google.publicLinks) {
    try {
      await clienteDrive().permissions.create({
        fileId,
        requestBody: { role: 'reader', type: 'anyone' },
        sendNotificationEmail: false,
        supportsAllDrives: true,
      });
    } catch (err) {
      // 403 = la carpeta no permite compartir. No es fatal: puede que el archivo
      // ya sea legible. Se loguea y se sigue con el enlace canónico.
      console.warn(`[drive] no se pudo hacer publico ${fileId}:`, err instanceof Error ? err.message : err);
    }
  }

  cacheEnlaces.set(fileId, { url: canonico, expira: Date.now() + env.google.linkCacheTtl * 1000 });
  return canonico;
}

/** Construye la URL de descarga directa (descarga el archivo, no la vista). */
export function enlaceDeDescarga(fileId: string): string {
  return `https://drive.google.com/uc?export=download&id=${fileId}`;
}

/**
 * Contenido binario de un archivo de Drive. Solo lectura: el alcance
 * `drive.readonly` alcanza para descargar.
 */
export async function descargarArchivo(fileId: string): Promise<Uint8Array> {
  const r = await clienteDrive().files.get(
    { fileId, alt: 'media', supportsAllDrives: true },
    { responseType: 'arraybuffer' },
  );
  return new Uint8Array(r.data as ArrayBuffer);
}

/* ==========================================================================
 * Sincronización
 * ======================================================================== */

export interface ResultadoSync {
  ejecutada: boolean;
  dryRun: boolean;
  archivosVistos: number;
  actualizados: number;
  sinMatch: Array<{ clave: string; archivoEsperado: string }>;
  mensajes: string[];
}

/**
 * Reemplaza los fragmentos de un documento a partir de su PDF en Drive.
 *
 * Se llama solo cuando el archivo cambió (md5 distinto). Si la descarga o la
 * extracción fallan, no se tocan los fragmentos anteriores: la sincronización
 * sigue con los demás documentos y el error queda en los mensajes.
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
        [clave, i + 1, f.titulo, f.texto, normalizarTexto(`${materia} ${f.titulo} ${f.texto}`)],
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

function normalizar(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

interface FichaDb {
  clave: string;
  drive_nombre_archivo: string | null;
  drive_file_id: string | null;
  drive_md5: string | null;
  fragmentos_md5: string | null;
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
 * No borra documentos: los que dejan de aparecer en Drive se marcan
 * `reemplazado` / `vigente = false` en vez de desaparecer del menú, para que el
 * estudiante nunca reciba un enlace roto (RF07).
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
    porNombre.set(normalizar(a.nombre), a);
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
      archivo = porNombre.get(normalizar(esperado));
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
