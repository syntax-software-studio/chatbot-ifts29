/**
 * Servicio de conversación.
 *
 * Reglas del MVP híbrido (menú guiado + lenguaje natural controlado):
 *  - El menú guiado por niveles se mantiene tal cual: es el camino principal y
 *    el que garantiza una respuesta autorizada.
 *  - Una consulta escrita se interpreta (normalización + coincidencia exacta +
 *    variantes + `pg_trgm`) pero NUNCA genera contenido: si se reconoce la
 *    intención, la respuesta se emite con `procesarSeleccion`, o sea con la
 *    misma respuesta, los mismos documentos y los mismos contactos del menú.
 *  - Si la consulta es ambigua se pide aclaración con opciones reales; si no hay
 *    información autorizada se informa que no se dispone de ella (D06/D08).
 *  - Toda respuesta proviene de contenido cargado por la institución y, si
 *    aplica, viene acompañada del documento vigente de Drive (RF07).
 *  - Cuando la información depende de un dato (comisión, cuatrimestre), el
 *    menú lo resuelve con pantallas de opciones, sin pedir datos personales (RF06).
 *  - La derivación es siempre asincrónica: se muestran datos de contacto, el
 *    bot no escribe ni gestiona trámites (RF04).
 */

import {
  obtenerNodo,
  obtenerOpcion,
  obtenerRespuesta,
  obtenerContactos,
  textoDerivacion,
  CATEGORIA_RAIZ,
} from '../repositories/chat-menu.repository.js';
import { registrarMetrica, type Evento } from './analytics.service.js';
import { interpretarConsulta } from './kb.service.js';
import { buscarExtractos } from './fragmentos.service.js';
import { badRequest } from '../utils/errors.js';
import { env } from '../config/env.js';
import {
  claveConComision,
  comisionesAPreguntar,
  filtrarPorComision,
  separarComision,
} from '../lib/comisiones.js';
import type { Extracto, NodoMenu, TurnoChat } from '../db/types.js';

/** Claves reservadas para las métricas agregadas de las consultas escritas. */
const CLAVE_METRICA_SALUDO = '(texto_regla)';
const CLAVE_METRICA_ACLARACION = '(aclaracion)';
const CLAVE_METRICA_NO_DISPONIBLE = '(no_disponible)';

/** Pregunta que se muestra cuando los documentos de una respuesta dependen de la comisión. */
export const MENSAJE_COMISION = '¿De qué comisión sos?';

export async function menuInicial(): Promise<NodoMenu> {
  return obtenerNodo(CATEGORIA_RAIZ);
}

/** Nodo de una categoría concreta, para navegación directa o pruebas. */
export async function menuDeCategoria(categoriaClave: string): Promise<NodoMenu> {
  return obtenerNodo(categoriaClave);
}

export interface EntradaChat {
  /** Clave de la opción que el estudiante tocó. */
  opcion?: string;
  /** Categoría a la que navega (alternativa explícita a `opcion`). */
  categoria?: string;
}

/**
 * Procesa una selección del menú y devuelve el turno siguiente.
 *
 * `evento` permite que el flujo de texto libre registre un evento distinto al
 * de la navegacion por botones, sin duplicar la resolucion de la opcion. Si se
 * omite, se conserva el comportamiento original: `seleccion` para navegar o
 * responder, `derivacion` para derivar a contactos.
 */
export async function procesarSeleccion(
  entrada: EntradaChat,
  eventoTurno?: Evento,
): Promise<TurnoChat> {
  // 1. Navegación explícita por categoría.
  if (entrada.categoria) {
    const nodo = await obtenerNodo(entrada.categoria);
    return { tipo: 'nodo', nodo };
  }

  if (!entrada.opcion) {
    throw badRequest('Se requiere "opcion" o "categoria" en el cuerpo de la petición.');
  }

  // 2. Resolución de la opción. Puede traer la comisión elegida (`CLAVE@B`).
  const { base, comision } = separarComision(entrada.opcion);
  const opcion = await obtenerOpcion(base);
  const evento: Evento = eventoTurno ?? (opcion.tipo === 'derivar' ? 'derivacion' : 'seleccion');

  // 2.a. Navegación a subnivel.
  if (opcion.tipo === 'navegar') {
    if (!opcion.categoriaClave) {
      throw badRequest(`La opción "${opcion.clave}" no tiene destino configurado.`);
    }
    await registrarMetrica(opcion.clave, evento);
    const nodo = await obtenerNodo(opcion.categoriaClave);
    return { tipo: 'nodo', nodo };
  }

  // 2.c. Respuesta con contenido y documentos adjuntos.
  if (opcion.tipo === 'responder') {
    if (opcion.respuestaId === null) {
      throw badRequest(`La opción "${opcion.clave}" no tiene respuesta asociada.`);
    }
    const respuesta = await obtenerRespuesta(opcion.respuestaId);

    // Documentos por comisión: si hay más de una y no se eligió ninguna, se pregunta.
    const comisiones = comisionesAPreguntar(respuesta.documentos);
    if (comisiones.length > 0 && comision === null) {
      return {
        tipo: 'aclaracion',
        aclaracion: {
          mensaje: MENSAJE_COMISION,
          opciones: comisiones.map((c) => ({
            clave: claveConComision(opcion.clave, c),
            etiqueta: `Comisión ${c}`,
            descripcion: null,
            tipo: 'responder' as const,
            esVolver: false,
            icono: null,
          })),
        },
      };
    }

    const documentos = comision === null ? respuesta.documentos : filtrarPorComision(respuesta.documentos, comision);
    await registrarMetrica(opcion.clave, evento);
    return { tipo: 'respuesta', claveOpcion: opcion.clave, respuesta: { ...respuesta, documentos }, nodoActual: '' };
  }

  // 2.d. Derivación asincrónica con contactos (RF04).
  if (opcion.tipo === 'derivar') {
    const [texto, contactos] = await Promise.all([
      textoDerivacion(opcion.respuestaId),
      obtenerContactos(opcion.opcionId),
    ]);
    await registrarMetrica(opcion.clave, evento);
    return { tipo: 'derivacion', claveOpcion: opcion.clave, derivacion: { texto, contactos } };
  }

  // 2.e. Regresión defensiva: un tipo nuevo no debería dejar al estudiante sin salida.
  await registrarMetrica(opcion.clave, 'error');
  return {
    tipo: 'error',
    mensaje: `La opción "${opcion.clave}" no está disponible en este momento. Volvé a intentar desde el menú principal.`,
  };
}

/**
 * Aviso mostrado cuando el estudiante abre un documento.
 * Se contabiliza como `documento_abierto` para detectar qué contenido se usa
 * (métricas agregadas, sin datos personales).
 */
export async function registrarAperturaDocumento(clave: string): Promise<void> {
  await registrarMetrica(clave, 'documento_abierto');
}

/**
 * Procesa una consulta escrita en lenguaje natural.
 *
 * El motor (`nl.service`) decide SOLO la intención; la respuesta institucional
 * se emite con el mismo `procesarSeleccion` que usa el menú, de modo que menú y
 * texto libre terminan exactamente en la misma respuesta autorizada (con sus
 * documentos y contactos) y no hay dos sistemas de contenido.
 */
export async function procesarConsulta(texto: string): Promise<TurnoChat> {
  const resolucion = await interpretarConsulta(texto);

  switch (resolucion.clase) {
    case 'opcion': {
      const turno = await procesarSeleccion({ opcion: resolucion.opcionClave }, resolucion.evento);
      // Un turno de error no lleva metadatos de interpretación.
      if (turno.tipo === 'error') return turno;
      if (turno.tipo === 'respuesta') {
        // Consulta escrita: si una sección de los documentos responde, se muestra
        // ese extracto en lugar del texto general. Sin extracto, queda el documento completo.
        const extractos = await buscarExtractos(
          turno.respuesta.documentos.map((d) => d.clave),
          resolucion.terminos,
        ).catch((): Extracto[] => []);
        if (extractos.length > 0) {
          return { ...turno, respuesta: { ...turno.respuesta, extractos }, meta: resolucion.meta };
        }
      }
      return { ...turno, meta: resolucion.meta };
    }

    case 'saludo': {
      // La regla de saludos devuelve el menú raíz, no una respuesta de la base.
      await registrarMetrica(CLAVE_METRICA_SALUDO, 'texto_regla');
      const nodo = await obtenerNodo(CATEGORIA_RAIZ);
      return { tipo: 'nodo', nodo, meta: resolucion.meta };
    }

    case 'aclaracion':
      await registrarMetrica(CLAVE_METRICA_ACLARACION, 'aclaracion');
      return { tipo: 'aclaracion', aclaracion: resolucion.aclaracion, meta: resolucion.meta };

    case 'no_disponible':
      await registrarMetrica(CLAVE_METRICA_NO_DISPONIBLE, 'no_disponible');
      return { tipo: 'no_disponible', mensaje: resolucion.mensaje, meta: resolucion.meta };

    case 'error':
      await registrarMetrica(CLAVE_METRICA_NO_DISPONIBLE, 'error');
      return { tipo: 'error', mensaje: resolucion.mensaje };
  }
}
