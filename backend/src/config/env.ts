/**
 * Configuración de la aplicación, leída de `process.env`.
 * Si existe, también carga el `.env` de la raíz; las variables del entorno tienen prioridad.
 */

import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const raizRepo = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const archivoEnv = join(raizRepo, '.env');

if (existsSync(archivoEnv)) {
  try {
    process.loadEnvFile(archivoEnv);
  } catch (err) {
    console.warn(
      `[env] no se pudo leer ${archivoEnv}: ${err instanceof Error ? err.message : 'error desconocido'}`,
    );
  }
}

function str(key: string, fallback = ''): string {
  const v = process.env[key];
  return v === undefined || v === '' ? fallback : v;
}

function bool(key: string, fallback: boolean): boolean {
  const v = process.env[key];
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

function int(key: string, fallback: number): number {
  const v = Number.parseInt(process.env[key] ?? '', 10);
  return Number.isFinite(v) ? v : fallback;
}

function float(key: string, fallback: number): number {
  const v = Number.parseFloat(process.env[key] ?? '');
  return Number.isFinite(v) ? v : fallback;
}

function list(key: string, fallback: string[]): string[] {
  const raw = str(key);
  if (!raw) return fallback;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

const DEFAULT_ALLOWED_ORIGINS = [
  'https://chatbot-ifts29-jade.vercel.app',
  'https://aulasvirtuales.bue.edu.ar',
  'http://localhost:5173',
  'http://localhost:3000',
];

const allowedOrigins = list('CORS_ORIGINS', list('VITE_ALLOWED_ORIGINS', DEFAULT_ALLOWED_ORIGINS));

export const env = {
  nodeEnv: str('NODE_ENV', 'development'),
  isProduction: str('NODE_ENV', 'development') === 'production',
  port: int('PORT', 3000),

  databaseUrl: str('DATABASE_URL'),

  google: {
    clientEmail: str('GOOGLE_SERVICE_ACCOUNT_EMAIL'),
    privateKey: str('GOOGLE_PRIVATE_KEY').replace(/\\n/g, '\n'),
    sharedFolderId: str('GOOGLE_SHARED_FOLDER_ID'),
    sheetId: str('GOOGLE_SHEET_ID'),
    // Enlaces públicos. Apagado: la cuenta de servicio es de solo lectura.
    publicLinks: bool('DRIVE_PUBLIC_LINKS', false),
    linkCacheTtl: int('DRIVE_LINK_CACHE_TTL', 3600),
  },

  syncSecret: str('SYNC_SECRET'),
  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 60_000),
    max: int('RATE_LIMIT_MAX', 120),
  },

  // Umbrales calibrables por entorno (ver docs/02 y docs/08).
  lenguajeNatural: {
    maxMensaje: int('KB_MAX_MENSAJE', 800),
    minMensaje: int('KB_MIN_MENSAJE', 2),
    umbralAlto: float('KB_UMBRAL_ALTO', 0.9),
    umbralMedio: float('KB_UMBRAL_MEDIO', 0.7),
    margenAmbiguedad: float('KB_MARGEN_AMBIGUEDAD', 0.05),
    umbralPasaje: float('KB_UMBRAL_PASAJE', 0.9),
    // Cuatro, por las cuatro materias: con menos se ocultaría una opción.
    maxOpcionesAclaracion: int('KB_MAX_OPCIONES_ACLARACION', 4),
  },

  allowedOrigins,
  iframeAncestors: list('IFRAME_ANCESTORS', allowedOrigins),
} as const;

export const hasDatabase = (): boolean => env.databaseUrl.length > 0;

export const hasGoogleDrive = (): boolean =>
  env.google.clientEmail.length > 0 && env.google.privateKey.length > 0;
