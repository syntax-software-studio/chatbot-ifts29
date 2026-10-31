/**
 * Rate limit en memoria por IP.
 *
 * El despliegue objetivo es serverless, donde cada instancia es efímera: este
 * límite es una protection de cortesía contra abuso, no un control estricto de
 * concurrencia. Para un límite global real, configurar un WAF en el proveedor
 * (RNF02: la concurrencia simultánea queda pendiente de estimación).
 */

import type { RequestHandler } from 'express';
import { env } from '../config/env.js';
import { tooManyRequests } from '../utils/errors.js';

interface Contador {
  inicio: number;
  hits: number;
}

const contadores = new Map<string, Contador>();

function contador(ip: string): Contador {
  const ahora = Date.now();
  const previo = contadores.get(ip);

  if (!previo || ahora - previo.inicio > env.rateLimit.windowMs) {
    const nuevo: Contador = { inicio: ahora, hits: 1 };
    contadores.set(ip, nuevo);
    return nuevo;
  }

  previo.hits += 1;
  return previo;
}

// Purga periódica para no retener IPs indefinidamente.
const purga = setInterval(() => {
  const limite = Date.now() - env.rateLimit.windowMs;
  for (const [ip, c] of contadores) {
    if (c.inicio < limite) contadores.delete(ip);
  }
}, env.rateLimit.windowMs);
purga.unref();

export const rateLimit: RequestHandler = (req, res, next) => {
  const ip =
    (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim() ??
    req.socket.remoteAddress ??
    'desconocido';

  const c = contador(ip);
  const restante = Math.max(0, env.rateLimit.max - c.hits);

  res.setHeader('RateLimit-Limit', String(env.rateLimit.max));
  res.setHeader('RateLimit-Remaining', String(restante));
  res.setHeader('RateLimit-Reset', String(Math.ceil((c.inicio + env.rateLimit.windowMs) / 1000)));

  if (c.hits > env.rateLimit.max) {
    next(tooManyRequests());
    return;
  }
  next();
};
