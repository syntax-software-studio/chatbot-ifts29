/**
 * POST /api/chat
 * Procesa el turno siguiente del estudiante: una opción del menú o una
 * consulta escrita.
 *
 * Dos caminos, un mismo contrato de respuesta:
 *
 *   { "opcion": "ADM_OP_SIU" }                  -> flujo guiado (sin cambios)
 *   { "categoria": "ACADEMICAS" }               -> navegación directa (sin cambios)
 *   { "message": "¿Cómo accedo al SIU?" }       -> lenguaje natural controlado
 *   { "message": "...", "conversationId": "x" } -> id reservado, sin memoria todavía
 *
 * `opcion` / `categoria` y `message` son mutuamente excluyentes: si vienen
 * juntos la petición se rechaza, para que ningún cliente se comporte de forma
 * distinta a la esperada. `conversationId` se acepta pero no se usa: la memoria
 * conversacional está postergada (D10).
 */

import { Router } from 'express';
import { z } from 'zod';
import { procesarSeleccion, procesarConsulta, registrarAperturaDocumento } from '../services/chat.service.js';
import { asyncHandler } from '../middleware/error.js';
import { badRequest, validationError } from '../utils/errors.js';
import { normalizar } from '../utils/normalizar.js';
import { fuente } from '../db/catalogo.js';
import { env } from '../utils/env.js';

const cuerpoSchema = z
  .object({
    opcion: z.string().min(1).max(64).optional(),
    categoria: z.string().min(1).max(64).optional(),
    /** Consulta escrita. Validada a mano para poder dar mensajes en castellano. */
    message: z.string().optional(),
    /** Reservado para una fase futura de memoria conversacional (D10). */
    conversationId: z.string().min(1).max(64).optional(),
    /** Nombres antiguos del campo de texto: se siguen rechazando. */
    mensaje: z.string().optional(),
    texto: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    const anotar = (message: string) =>
      ctx.addIssue({ code: z.ZodIssueCode.custom, message });

    // 1. `mensaje` / `texto` nunca fueron campos válidos: se explica cuál es.
    if (v.mensaje !== undefined || v.texto !== undefined) {
      anotar('El campo de texto libre es "message".');
      return;
    }

    const hayMenu = v.opcion !== undefined || v.categoria !== undefined;
    const hayTexto = v.message !== undefined;

    // 2. Sin ninguna entrada utilizable.
    if (!hayMenu && !hayTexto) {
      anotar('Se requiere "opcion", "categoria" o "message" en el cuerpo de la petición.');
      return;
    }

    // 3. Los dos flujos a la vez son ambiguos.
    if (hayMenu && hayTexto) {
      anotar('Se requiere "opcion"/"categoria" o "message", no ambos a la vez.');
      return;
    }

    // 4. Regla original del menú: exactamente una de las dos claves.
    //    Falla si vienen las dos o si no viene ninguna.
    if (hayMenu && (v.opcion !== undefined) === (v.categoria !== undefined)) {
      anotar('Se requiere exactamente uno de: "opcion" o "categoria".');
      return;
    }

    // 5. Longitud de la consulta escrita (mínima y máxima configurables).
    if (hayTexto) {
      const largo = normalizar(v.message ?? '').length;
      if (largo < env.lenguajeNatural.minMensaje) {
        anotar('Escribí una consulta para que pueda ayudarte.');
        return;
      }
      if ((v.message ?? '').length > env.lenguajeNatural.maxMensaje) {
        anotar(
          `La consulta es demasiado larga (máximo ${env.lenguajeNatural.maxMensaje} caracteres). ` +
            'Resumí la consulta en una línea.',
        );
      }
    }
  });

export const chatRouter = Router();

chatRouter.post(
  '/chat',
  asyncHandler(async (req, res) => {
    const parsed = cuerpoSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw validationError(parsed.error.issues.map((i) => i.message).join(' '));
    }

    const { message, ...entrada } = parsed.data;

    // Texto libre: interpreta la intención y emite la respuesta autorizada.
    const turno =
      entrada.opcion !== undefined || entrada.categoria !== undefined
        ? await procesarSeleccion(entrada)
        : await procesarConsulta(message ?? '');

    res.json({ origen: fuente(), ...turno });
  }),
);

/** POST /api/chat/documento - contabiliza la apertura de un documento. */
chatRouter.post(
  '/chat/documento',
  asyncHandler(async (req, res) => {
    const clave = z.string().min(1).max(64).safeParse((req.body ?? {}).clave);
    if (!clave.success) throw badRequest('Se requiere "clave" del documento.');
    await registrarAperturaDocumento(clave.data);
    res.status(204).end();
  }),
);
