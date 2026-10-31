/**
 * Cliente de Google Drive: lo que la aplicación le pide a Drive.
 *
 * Solo habla con la API (listar, descargar, enlazar y verificar credenciales).
 * No escribe en la base: quien decide qué cambió es `documentos.ts`.
 *
 * Autenticación por Service Account con alcance de solo lectura. La clave privada
 * vive solo en el servidor. El bot nunca escribe ni borra en Drive.
 */

import { clienteDrive } from '../clients/drive.client.js';
import { env, hasGoogleDrive } from '../config/env.js';

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
 * Recorre también las subcarpetas (Drive permite una carpeta por materia), por
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
 * Enlaces y descarga
 * ======================================================================== */

const cacheEnlaces = new Map<string, { url: string; expira: number }>();

/**
 * Devuelve un enlace de lectura para un archivo.
 *
 * - Si el archivo ya es público, se devuelve el enlace canónico sin llamar a la
 *   API (barato y estable).
 * - Si `DRIVE_PUBLIC_LINKS` está activo, se intenta crear/verificar el permiso
 *   `anyone/reader`. Requiere que la Service Account tenga permiso de compartir
 *   en la carpeta, o que la carpeta ya sea pública.
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
