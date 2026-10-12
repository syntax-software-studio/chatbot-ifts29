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
 *  - Cuando la información depende del contexto (comisión, cuatrimestre), se
 *    pregunta con opciones del menú, sin pedir datos personales (RF06).
 *  - La derivación es siempre asincrónica: se muestran datos de contacto, el
 *    bot no escribe ni gestiona trámites (RF04).
 */

import {
  obtenerNodo,
  obtenerOpcion,
  obtenerRespuesta,
  obtenerContactos,
  obtenerContextosDeOpcion,
  textoDerivacion,
  CATEGORIA_RAIZ,
} from '../db/catalogo.js';
import { registrarMetrica, type Evento } from './metricas.service.js';
import {
  interpretarConsulta,
  CLAVE_METRICA_ACLARACION,
  CLAVE_METRICA_NO_DISPONIBLE,
  CLAVE_METRICA_SALUDO,
} from './nl.service.js';
import { badRequest } from '../utils/errors.js';
import type { NodoMenu, TurnoChat } from '../db/types.js';

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
  /** Valor de un submenú contextual, cuando la opción lo pidió. */
  contexto?: number;
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

  // 2. Resolución de la opción.
  const opcion = await obtenerOpcion(entrada.opcion);
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

  // 2.b. Submenú contextual: la respuesta depende de un dato (comisión, etc.).
  const contextos = await obtenerContextosDeOpcion(opcion.opcionId);
  if (contextos.length > 0 && entrada.contexto === undefined) {
    return {
      tipo: 'contexto',
      claveOpcion: opcion.clave,
      pregunta: {
        texto: '¿Sobre qué comisión necesitás la información?',
        clave: contextos[0]!.clave,
        opciones: contextos,
      },
    };
  }

  // 2.c. Respuesta con contenido y documentos adjuntos.
  if (opcion.tipo === 'responder') {
    if (opcion.respuestaId === null) {
      throw badRequest(`La opción "${opcion.clave}" no tiene respuesta asociada.`);
    }
    const respuesta = await obtenerRespuesta(opcion.respuestaId);

    // Si venía de un submenú contextual, se agrega el dato elegido.
    if (entrada.contexto !== undefined && contextos.length > 0) {
      const elegido = contextos.find((c) => c.contextoId === entrada.contexto);
      if (elegido?.valor) {
        respuesta.texto = `Sobre ${elegido.etiqueta}:\n${elegido.valor}`;
      }
    }

    await registrarMetrica(opcion.clave, evento);
    return { tipo: 'respuesta', claveOpcion: opcion.clave, respuesta, nodoActual: '' };
  }

  // 2.d. Derivación asincrónica con contactos (RF04).
  if (opcion.tipo === 'derivar') {
    // Si el submenu contextual eligio una comision, solo se derivan sus contactos.
    const comision = contextos.find((c) => c.contextoId === entrada.contexto)?.ambitoClave ?? null;
    const [texto, contactos] = await Promise.all([
      textoDerivacion(opcion.respuestaId),
      obtenerContactos(opcion.opcionId, comision),
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
      // Un turno de contexto o de error no lleva metadatos de interpretación:
      // todavía no se emitió una respuesta de conocimiento.
      if (turno.tipo === 'contexto' || turno.tipo === 'error') return turno;
      return { ...turno, meta: resolucion.meta };
    }

    case 'nodo':
      await registrarMetrica(CLAVE_METRICA_SALUDO, 'texto_regla');
      return { tipo: 'nodo', nodo: resolucion.nodo, meta: resolucion.meta };

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
