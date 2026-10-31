/**
 * Estado de la conversación guiada.
 *
 * El asistente mantiene una lista de turnos ya resueltos para que el estudiante
 * pueda volver a leer lo anterior, y expone el "nodo actual" (categoría sobre
 * la que mostrar opciones).
 *
 * Hay dos caminos de entrada y ambos terminan en el mismo contenido:
 *   - tocar una opción del menú;
 *   - escribir una consulta, que la API interpreta y resuelve contra la misma
 *     base de conocimiento del menú (respuesta, aclaración o aviso).
 *
 * No se persiste historial en el servidor: la sesión vive en la pestaña del
 * navegador y se descarta al cerrarla (RNF05 - sin datos personales). El texto
 * escrito se muestra en la conversación local y no se guarda en ningún lado.
 */

import { useCallback, useRef, useState } from 'react';
import { obtenerMenu, enviarSeleccion, enviarMensaje, ApiError } from '../api/client';
import type { OpcionMenu, Respuesta, TurnoChat } from '../types';

/**
 * Texto de una respuesta. Si trae extractos (pasajes del documento que responden
 * la consulta), se muestran y se indica que el PDF completo va adjunto.
 */
function textoDeRespuesta(respuesta: Respuesta): string {
  if (!respuesta.extractos?.length) return respuesta.texto;
  const cuerpo = respuesta.extractos
    .map((e) => (e.titulo ? `${e.titulo}\n${e.texto}` : e.texto))
    .join('\n\n');
  return `${cuerpo}\n\nPara más información te adjuntamos el PDF completo.`;
}

/** Elementos que se renderizan como botones en el menú. */

export interface Turno {
  id: string;
  autor: 'bot' | 'estudiante';
  texto: string;
  documentos?: DocumentosTurno;
  contactos?: ContactosTurno;
  variante?: 'normal' | 'error';
}

type DocumentosTurno = NonNullable<Extract<TurnoChat, { tipo: 'respuesta' }>['respuesta']['documentos']>;
type ContactosTurno = NonNullable<Extract<TurnoChat, { tipo: 'derivacion' }>['derivacion']['contactos']>;

export interface EstadoChat {
  cargando: boolean;
  error: string | null;
  turnos: Turno[];
  opciones: OpcionMenu[];
  nodoActual: string;
  puedeNavegarAtras: boolean;
  inicializar: () => Promise<void>;
  seleccionar: (clave: string) => Promise<void>;
  /** Envía una consulta escrita y aplica el turno que devuelva la API. */
  consultar: (texto: string) => Promise<void>;
  /** Vuelve al menú anterior, también desde una respuesta o derivación. */
  volver: () => Promise<void>;
  reiniciar: () => Promise<void>;
}

let secuencia = 0;
const nuevoId = (): string => `t${++secuencia}`;

export function useChat(): EstadoChat {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [opciones, setOpciones] = useState<OpcionMenu[]>([]);
  const [nodoActual, setNodoActual] = useState('RAIZ');
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  /** Pila de categorías visitadas, para el botón "volver" implícito. */
  const historial = useRef<string[]>([]);
  /**
   * true cuando el último turno no es un menú (respuesta, derivación, submenú).
   * En ese caso "volver" muestra la categoría de la que se llegó, sin sacarla de la pila.
   */
  const enHoja = useRef(false);

  const agregarTurno = useCallback((turno: Omit<Turno, 'id'>) => {
    setTurnos((prev) => [...prev, { ...turno, id: nuevoId() }]);
  }, []);

  const inicializar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const nodo = await obtenerMenu();
      setTurnos([{ id: nuevoId(), autor: 'bot', texto: nodo.mensaje }]);
      setOpciones(nodo.opciones);
      setNodoActual(nodo.categoria.clave);
      historial.current = [nodo.categoria.clave];
      enHoja.current = false;
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo iniciar la conversación. Probá de nuevo en un momento.',
      );
    } finally {
      setCargando(false);
    }
  }, []);

  const aplicarTurno = useCallback(
    (turno: TurnoChat) => {
      switch (turno.tipo) {
        case 'nodo':
          agregarTurno({ autor: 'bot', texto: turno.nodo.mensaje });
          setOpciones(turno.nodo.opciones);
          setNodoActual(turno.nodo.categoria.clave);
          historial.current.push(turno.nodo.categoria.clave);
          enHoja.current = false;
          break;

        case 'respuesta':
          agregarTurno({
            autor: 'bot',
            texto: textoDeRespuesta(turno.respuesta),
            documentos: turno.respuesta.documentos,
          });
          // Una respuesta cierra la hoja: no quedan opciones del menú debajo.
          // Para volver se usa el botón "Volver al menú" del pie.
          setOpciones([]);
          enHoja.current = true;
          break;

        case 'derivacion':
          agregarTurno({
            autor: 'bot',
            texto: turno.derivacion.texto,
            contactos: turno.derivacion.contactos,
          });
          if (!turno.meta) setOpciones([]);
          enHoja.current = true;
          break;

        case 'aclaracion':
          // Se muestran opciones reales del menú: el estudiante responde
          // tocando un botón y el flujo continúa como el de siempre.
          agregarTurno({ autor: 'bot', texto: turno.aclaracion.mensaje });
          setOpciones(turno.aclaracion.opciones);
          enHoja.current = true;
          break;

        case 'no_disponible':
          // Sin opciones debajo: la salida es el botón "Volver al menú" del pie,
          // que lleva a la categoría desde la que se escribió la consulta.
          agregarTurno({ autor: 'bot', texto: turno.mensaje });
          setOpciones([]);
          enHoja.current = true;
          break;

        case 'error':
          agregarTurno({ autor: 'bot', texto: turno.mensaje, variante: 'error' });
          break;
      }
    },
    [agregarTurno],
  );

  const seleccionar = useCallback(
    async (clave: string) => {
      if (cargando) return;

      const etiqueta = opciones.find((o) => o.clave === clave)?.etiqueta ?? '';

      setCargando(true);
      agregarTurno({ autor: 'estudiante', texto: etiqueta || '…' });

      try {
        aplicarTurno(await enviarSeleccion({ opcion: clave }));
        setError(null);
      } catch (err) {
        const mensaje =
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un problema al consultar la información. Probá de nuevo.';
        setError(mensaje);
        agregarTurno({ autor: 'bot', texto: mensaje, variante: 'error' });
      } finally {
        setCargando(false);
      }
    },
    [opciones, cargando, agregarTurno, aplicarTurno],
  );

  const consultar = useCallback(
    async (texto: string) => {
      const consulta = texto.trim();
      if (cargando || consulta.length === 0) return;

      setCargando(true);
      agregarTurno({ autor: 'estudiante', texto: consulta });

      try {
        aplicarTurno(await enviarMensaje(consulta));
        setError(null);
      } catch (err) {
        const mensaje =
          err instanceof ApiError
            ? err.message
            : 'Ocurrió un problema al consultar la información. Probá de nuevo.';
        setError(mensaje);
        agregarTurno({ autor: 'bot', texto: mensaje, variante: 'error' });
      } finally {
        setCargando(false);
      }
    },
    [cargando, agregarTurno, aplicarTurno],
  );

  /**
   * Vuelve al menú anterior. Desde un menú se sale de él (se saca de la pila);
   * desde una respuesta, derivación o submenú se vuelve a la categoría de origen.
   */
  const volver = useCallback(async () => {
    if (cargando) return;
    const pila = historial.current;
    if (!enHoja.current) pila.pop();
    const destino = pila[pila.length - 1];
    if (!destino) {
      await inicializar();
      return;
    }

    setCargando(true);
    agregarTurno({ autor: 'estudiante', texto: '< Volver al menú anterior' });
    try {
      const nodo = await obtenerMenu(destino);
      agregarTurno({ autor: 'bot', texto: nodo.mensaje });
      setOpciones(nodo.opciones);
      setNodoActual(nodo.categoria.clave);
      enHoja.current = false;
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'No se pudo volver al menú. Probá de nuevo en un momento.',
      );
    } finally {
      setCargando(false);
    }
  }, [cargando, agregarTurno, inicializar]);

  const reiniciar = useCallback(async () => {
    historial.current = [];
    await inicializar();
  }, [inicializar]);

  return {
    cargando,
    error,
    turnos,
    opciones,
    nodoActual,
    puedeNavegarAtras: enHoja.current ? historial.current.length > 0 : historial.current.length > 1,
    inicializar,
    seleccionar,
    consultar,
    volver,
    reiniciar,
  };
}

export type { OpcionMenu };
