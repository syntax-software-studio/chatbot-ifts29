/**
 * Cliente HTTP de la API.
 *
 * Incluye timeout con `AbortController` para que una caída de la API no deje
 * al estudiante con un botón que no responde (RNF03: interacción fluida).
 */

import { config } from '../config';
import type { NodoMenu, TurnoChat } from '../types';

const TIMEOUT_MS = 8000;

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

function url(path: string): string {
  return `${config.apiBaseUrl}${path}`;
}

async function pedir<T>(path: string, init?: RequestInit): Promise<T> {
  const controlador = new AbortController();
  const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url(path), {
      ...init,
      signal: controlador.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });

    if (res.status === 204) return undefined as T;

    const cuerpo = (await res.json().catch(() => null)) as
      | { error?: { code?: string; message?: string } }
      | null;

    if (!res.ok) {
      throw new ApiError(
        res.status,
        cuerpo?.error?.code ?? 'HTTP_ERROR',
        cuerpo?.error?.message ?? `Error ${res.status} al consultar el asistente.`,
      );
    }

    return cuerpo as T;
  } catch (err) {
    if (err instanceof ApiError) throw err;
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'TIMEOUT', 'La consulta tardó demasiado. Probá de nuevo.');
    }
    throw new ApiError(0, 'NETWORK', 'No se pudo conectar con el asistente. Revisá tu conexión.');
  } finally {
    clearTimeout(temporizador);
  }
}

/** Nodo raíz con el saludo inicial y las tres opciones de entrada. */
export const obtenerMenu = (categoria?: string): Promise<NodoMenu> =>
  pedir<NodoMenu>(categoria ? `/api/menu?categoria=${encodeURIComponent(categoria)}` : '/api/menu');

export interface EntradaChat {
  opcion?: string;
  categoria?: string;
  /** Consulta escrita. Mutuamente excluyente con `opcion`/`categoria`. */
  message?: string;
  /** Reservado para una fase futura de memoria conversacional (D10). */
  conversationId?: string;
}

/** Procesa la opción que el estudiante seleccionó. */
export const enviarSeleccion = (entrada: EntradaChat): Promise<TurnoChat> =>
  pedir<TurnoChat>('/api/chat', { method: 'POST', body: JSON.stringify(entrada) });

/**
 * Envía una consulta escrita.
 *
 * La API devuelve siempre un turno con contenido institucional (respuesta,
 * aclaración o aviso de que no hay información): nunca un texto generado.
 */
export const enviarMensaje = (mensaje: string): Promise<TurnoChat> =>
  pedir<TurnoChat>('/api/chat', { method: 'POST', body: JSON.stringify({ message: mensaje }) });

/** Avisa que se abrió un documento (métrica agregada, sin datos personales). */
export const registrarApertura = (clave: string): Promise<void> =>
  pedir<void>('/api/chat/documento', { method: 'POST', body: JSON.stringify({ clave }) }).catch(() => {
    // La métrica nunca debe interrumpir la navegación hacia el documento.
  });
