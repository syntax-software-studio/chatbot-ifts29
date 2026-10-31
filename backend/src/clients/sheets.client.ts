/**
 * Cliente de Google Sheets
 * Permisos de lectura de planillas.
 */

import { google, type sheets_v4 } from 'googleapis';
import { credencialGoogle } from './google-auth.js';

const ALCANCE_SHEETS = 'https://www.googleapis.com/auth/spreadsheets.readonly';

let cliente: sheets_v4.Sheets | null = null;

export function clienteSheets(): sheets_v4.Sheets {
  if (!cliente) {
    cliente = google.sheets({ version: 'v4', auth: credencialGoogle(ALCANCE_SHEETS) });
  }
  return cliente;
}
