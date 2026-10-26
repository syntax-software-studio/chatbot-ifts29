/**
 * CORS + cabeceras de embebido (iframe).
 *
 * El widget se sirve desde `chatbot-ifts29-jade.vercel.app` y se incrusta en el
 * campus virtual de Moodle. Por eso:
 *  - `Access-Control-Allow-Origin` se limita a una lista explícita de orígenes
 *    (el propio, el Moodle institucional y localhost en desarrollo).
 *  - `Content-Security-Policy: frame-ancestors` habilita esos mismos orígenes
 *    como ancestros de iframe. `X-Frame-Options` NO se usa porque no admite
 *    listas y rompería el embebido.
 */

import type { RequestHandler } from 'express';
import { env } from '../utils/env.js';

function resolverOrigen(reqOrigin: string | undefined): string | null {
  if (!reqOrigin) return null; // mismo origen / curl / health checks
  if (env.allowedOrigins.includes(reqOrigin)) return reqOrigin;
  // Debe terminar en la lista exacta, no en wildcard de sufijo.
  return null;
}

export const corsMiddleware: RequestHandler = (req, res, next) => {
  const origen = resolverOrigen(req.headers.origin);

  if (origen) {
    res.setHeader('Access-Control-Allow-Origin', origen);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
    res.setHeader('Access-Control-Max-Age', '86400');
  }

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  next();
};

export const securityHeaders: RequestHandler = (_req, res, next) => {
  const ancestors = env.iframeAncestors.length > 0 ? env.iframeAncestors.join(' ') : "'self'";
  res.setHeader('Content-Security-Policy', `frame-ancestors ${ancestors}`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.removeHeader('X-Powered-By');
  next();
};
