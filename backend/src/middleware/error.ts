/** Manejador de errores y 404 uniforme para toda la API. */

import type { ErrorRequestHandler, RequestHandler } from 'express';
import { HttpError } from '../utils/errors.js';
import { env } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Ruta no encontrada: ${req.method} ${req.path}`,
    },
  });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
    return;
  }

  const mensaje = err instanceof Error ? err.message : 'Error interno';
  console.error('[api] error no controlado:', err);

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Ocurrió un error inesperado. Probá de nuevo o escribí a Bedelía.',
      // El detalle real solo se expone fuera de producción.
      ...(env.isProduction ? {} : { detalle: mensaje }),
    },
  });
};

/** Envuelve un handler async para propagar errores a `errorHandler`. */
export function asyncHandler<T extends RequestHandler>(fn: T): RequestHandler {
  return (req, res, next) => {
    void Promise.resolve(fn(req, res, next)).catch(next);
  };
}
