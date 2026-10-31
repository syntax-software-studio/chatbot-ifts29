/**
 * Cliente de Google Drive
 * Permisos de lectura de archivos.
 */

import { google, type drive_v3 } from 'googleapis';
import { hasGoogleDrive } from '../config/env.js';
import { HttpError } from '../utils/errors.js';
import { credencialGoogle } from './google-auth.js';

const ALCANCE_DRIVE = 'https://www.googleapis.com/auth/drive.readonly';

let cliente: drive_v3.Drive | null = null;

export function clienteDrive(): drive_v3.Drive {
  if (!hasGoogleDrive()) {
    throw new HttpError(503, 'DRIVE_NO_CONFIGURADO', 'Google Drive no está configurado en este entorno.');
  }
  if (!cliente) {
    cliente = google.drive({ version: 'v3', auth: credencialGoogle(ALCANCE_DRIVE) });
  }
  return cliente;
}
