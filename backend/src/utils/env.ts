/**
 * Configuracion de entorno centralizada.
 * Lee process.env una sola vez y aplica defaults seguros para demo local.
 *
 * Carga ademas el `.env` de la raiz del repo si existe, para que el proyecto
 * se pueda configurar en un solo archivo (copiado de `.env.example`) sin
 * depender de `dotenv` ni de flags por script. Las variables ya presentes en
 * el entorno ganan sobre el archivo: en Vercel manda la configuracion del
 * proyecto y el `.env` no existe.
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
    /** ID de la planilla de contenido ("Bot IFTS29 - Contenido"). Sólo lectura. */
    sheetId: str('GOOGLE_SHEET_ID'),
    /**
     * Crear el permiso "cualquiera con el enlace" es una escritura en Drive:
     * el alcance `drive.readonly` siempre devuelve 403. Por eso el default es
     * false y el bot opera en modo estrictamente solo lectura. Activarlo
     * requiere cambiar el scope a `drive.file`/`drive` en drive.service.ts.
     */
    publicLinks: bool('DRIVE_PUBLIC_LINKS', false),
    linkCacheTtl: int('DRIVE_LINK_CACHE_TTL', 3600),
  },

  syncSecret: str('SYNC_SECRET'),
  rateLimit: {
    windowMs: int('RATE_LIMIT_WINDOW_MS', 60_000),
    max: int('RATE_LIMIT_MAX', 120),
  },

  /**
   * Motor de lenguaje natural controlado.
   *
   * Los umbrales son valores INICIALES y calibrables (D04): se ajustan con
   * consultas reales, no son constantes de negocio. Se pueden mover por entorno
   * sin recompilar ni tocar codigo.
   */
  lenguajeNatural: {
    /** Longitud maxima y minima del mensaje escrito por el estudiante. */
    maxMensaje: int('KB_MAX_MENSAJE', 800),
    minMensaje: int('KB_MIN_MENSAJE', 2),
    /** >= 0.90 -> respuesta autorizada. */
    umbralAlto: float('KB_UMBRAL_ALTO', 0.9),
    /** >= 0.70 (y < 0.90) -> aclaracion. Por debajo -> no disponible. */
    umbralMedio: float('KB_UMBRAL_MEDIO', 0.7),
    /** Dos intenciones tan parecidas que hay que preguntar (D06). */
    margenAmbiguedad: float('KB_MARGEN_AMBIGUEDAD', 0.05),
    /**
     * Maximo de opciones en una aclaracion (D06).
     *
     * 4 y no 3 a proposito: las consultas genericas del catalogo ("cuando
     * empiezan las clases", "programa", "dias de cursada") tienen exactamente
     * cuatro destinos posibles (las cuatro materias), y con un tope de 3 se
     * ocultaria uno de ellos sin avisar, que es peor que mostrarlo.
     */
    maxOpcionesAclaracion: int('KB_MAX_OPCIONES_ACLARACION', 4),
  },

  allowedOrigins,
  iframeAncestors: list('IFRAME_ANCESTORS', allowedOrigins),
} as const;

/** ¿La API tiene configurada una base de datos real? */
export const hasDatabase = (): boolean => env.databaseUrl.length > 0;

/** ¿La API tiene configurado el acceso a Google Drive? */
export const hasGoogleDrive = (): boolean =>
  env.google.clientEmail.length > 0 && env.google.privateKey.length > 0;
