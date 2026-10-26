/**
 * Configuración de la interfaz.
 *
 * Paleta institucional (guía de estilos del proyecto):
 *   #1D3343  azul institucional  -> header, burbuja del bot, launcher
 *   #FCFCFC  blanco              -> texto sobre azul, tarjetas
 *   #FFCD02  amarillo institucional -> subtítulo del header, avatar, acentos
 */

export const PALETA = {
  azul: '#1D3343',
  azulOscuro: '#15262F',
  azulClaro: '#2C4A5E',
  blanco: '#FCFCFC',
  amarillo: '#FFCD02',
  amarilloSuave: '#FFF8DC',
  texto: '#1F2A33',
  textoSuave: '#5A6B78',
  borde: '#E1E7EB',
  exito: '#2E7D5B',
} as const;

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_INSTITUTO_NOMBRE?: string;
  readonly VITE_INSTITUTO_SUBTITULO?: string;
  readonly VITE_ALLOWED_ORIGINS?: string;
  readonly VITE_WIDGET_DEBUG?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

function bool(v: string | undefined, fallback = false): boolean {
  if (v === undefined || v === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(v.toLowerCase());
}

const env: ImportMetaEnv = (import.meta as unknown as ImportMeta).env ?? {};

export const config = {
  /** Vacío = mismo origen. Definirlo solo si la API vive en otro despliegue. */
  apiBaseUrl: (env.VITE_API_BASE_URL ?? '').replace(/\/$/, ''),
  institutoNombre: env.VITE_INSTITUTO_NOMBRE ?? 'IFTS N°29',
  institutoSubtitulo: env.VITE_INSTITUTO_SUBTITULO ?? 'En linea',
  allowedOrigins: (env.VITE_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  debug: bool(env.VITE_WIDGET_DEBUG, false),
  /**
   * Campo de texto libre.
   *
   * Los límites replican `KB_MIN_MENSAJE` / `KB_MAX_MENSAJE` del backend: se
   * validan en el cliente para dar respuesta inmediata, pero la API vuelve a
   * validarlos (el cliente no es una frontera de seguridad).
   */
  minMensaje: 2,
  maxMensaje: 800,
  /** Origen canónico de la app, usado por el script inyector. */
  origenApp: 'https://chatbot-ifts29-jade.vercel.app',
  /** Origen del Moodle institucional: el contenedor que embebe el widget. */
  origenMoodle: 'https://aulasvirtuales.bue.edu.ar',
  /**
   * `targetOrigin` de los `postMessage` hacia la página padre.
   *
   * Se usa el origen explícito en lugar de `'*'` para que la medición del alto
   * solo pueda ser escuchada por el Moodle institucional.
   */
  origenPadre: 'https://aulasvirtuales.bue.edu.ar',
} as const;

/** Etiquetas de archivos por mime type, para las tarjetas de documento. */
export const ETIQUETA_MIME: Record<string, string> = {
  'application/pdf': 'Documento PDF',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Planilla Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Presentación',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Documento Word',
  'application/msword': 'Documento Word',
  'application/vnd.ms-excel': 'Planilla Excel',
};
