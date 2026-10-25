/**
 * GET /api/menu
 * Devuelve el nodo del menú con su mensaje y opciones.
 *   ?categoria=RAIZ (por defecto) | ADMINISTRATIVAS | ACADEMICAS | ...
 *   ?mapa=1 -> devuelve todo el árbol en una sola llamada (útil para tests).
 */

import { Router } from 'express';
import { z } from 'zod';
import { menuDeCategoria, menuInicial } from '../services/chat.service.js';
import { listarCategorias, obtenerNodo, obtenerOpcion, CATEGORIA_RAIZ } from '../db/catalogo.js';
import { asyncHandler } from '../middleware/error.js';
import { notFound } from '../utils/errors.js';

const querySchema = z.object({
  categoria: z.string().min(1).max(64).optional(),
  mapa: z.enum(['1', 'true']).optional(),
});

export const menuRouter = Router();

menuRouter.get(
  '/menu',
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      res.status(400).json({ error: { code: 'BAD_REQUEST', message: 'Parámetros inválidos.' } });
      return;
    }

    const { categoria, mapa } = parsed.data;

    if (mapa) {
      const categorias = await listarCategorias();
      const arbol = await Promise.all(
        categorias.map(async (c) => {
          const nodo = await obtenerNodo(c.clave);
          return { categoria: c.clave, mensaje: nodo.mensaje, opciones: nodo.opciones };
        }),
      );
      res.json({ raiz: CATEGORIA_RAIZ, categorias: arbol });
      return;
    }

    const nodo = categoria && categoria !== CATEGORIA_RAIZ
      ? await menuDeCategoria(categoria)
      : await menuInicial();

    res.json(nodo);
  }),
);

/** GET /api/menu/:clave - detalle de una opción (diagnóstico / tests). */
menuRouter.get(
  '/menu/:clave',
  asyncHandler(async (req, res) => {
    const clave = String(req.params.clave ?? '');
    const opcion = await obtenerOpcion(clave).catch(() => null);
    if (!opcion) throw notFound(`Opción no encontrada: ${clave}`);
    res.json(opcion);
  }),
);
