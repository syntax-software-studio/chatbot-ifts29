/**
 * ChatWidget - componente principal del Asistente Virtual IFTS N.29.
 *
 * Comportamiento:
 *  - Botón flotante colapsable en la esquina inferior derecha.
 *  - Panel emergente de 380 x 520 px.
 *  - Dos caminos: menú guiado por niveles y campo de texto libre. Ambos terminan
 *    en el mismo contenido institucional (RF05).
 *  - En modo embebido (dentro del iframe de Moodle) no muestra el botón
 *    flotante y ocupa todo el espacio del contenedor.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { useChat } from '../hooks/useChat';
import { ChatHeader } from './ChatHeader';
import { ChatLauncher } from './ChatLauncher';
import { MessageBubble, Escribiendo, formatearTexto } from './MessageBubble';
import { OptionList } from './OptionList';
import { DocumentList } from './DocumentCard';
import { ContactCard, AvisoDerivacionAsincronica } from './ContactCard';
import { IconoReiniciar, IconoEnviar } from './icons';
import type { Turno } from '../hooks/useChat';

export const ALTO_PANEL = 520;

/** Lee los parámetros de la URL del iframe. */
function leerParams(): { embebido: boolean; abiertoInicial: boolean; titulo: string } {
  if (typeof window === 'undefined') return { embebido: false, abiertoInicial: false, titulo: '' };
  const p = new URLSearchParams(window.location.search);
  return {
    embebido: p.get('embed') === '1' || p.get('embedded') === '1',
    abiertoInicial: p.get('open') === '1' || p.get('abierto') === '1',
    titulo: p.get('titulo') ?? '',
  };
}

export function ChatWidget() {
  const { embebido, abiertoInicial, titulo } = leerParams();
  const [abierto, setAbierto] = useState(abiertoInicial || embebido);

  const chat = useChat();
  const cuerpoRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Primera carga del menú raíz.
  useEffect(() => {
    void chat.inicializar();
    // Solo al montar: el hook ya gestiona sus propias dependencias.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Informa al contenedor padre el alto real del panel, para que el script
  // inyector ajuste el iframe sin barra de desplazamiento interna.
  useEffect(() => {
    if (!embebido) return;
    const medir = () => {
      const alto = panelRef.current?.offsetHeight ?? ALTO_PANEL;
      window.parent?.postMessage({ type: 'ifts29:alto', alto }, config.origenPadre);
    };
    medir();
    window.addEventListener('resize', medir);
    return () => window.removeEventListener('resize', medir);
  }, [embebido, abierto]);

  // Desplaza al último mensaje.
  useEffect(() => {
    const nodo = cuerpoRef.current;
    if (!nodo) return;
    nodo.scrollTop = nodo.scrollHeight;
  }, [chat.turnos, chat.cargando]);

  // Foco al abrir, para que el estudiante pueda navegar con teclado.
  useEffect(() => {
    if (!abierto) return;
    const t = setTimeout(() => {
      panelRef.current?.querySelector<HTMLElement>('.ifts-opcion, .ifts-header__cerrar')?.focus();
    }, 220);
    return () => clearTimeout(t);
  }, [abierto]);

  /* ----------------------------------------------------------------------
     API pública para el script inyector (widget.js)
     -------------------------------------------------------------------- */
  useEffect(() => {
    const api = {
      abrir: () => setAbierto(true),
      cerrar: () => setAbierto(false),
      alternar: () => setAbierto((v) => !v),
      reiniciar: () => void chat.reiniciar(),
      alto: ALTO_PANEL,
    };

    (window as unknown as Record<string, unknown>).IFTS29 = api;
    window.dispatchEvent(new CustomEvent('ifts29:ready', { detail: api }));

    return () => {
      delete (window as unknown as Record<string, unknown>).IFTS29;
    };
  }, [chat]);

  /* ----------------------------------------------------------------------
     Mensajes del contenedor padre (postMessage)
     -------------------------------------------------------------------- */
  useEffect(() => {
    function alRecibir(event: MessageEvent) {
      // Solo se aceptan mensajes del origen que aloja el iframe.
      const permitido =
        event.origin === window.location.origin ||
        config.allowedOrigins.includes(event.origin) ||
        event.source === window.parent;
      if (!permitido) return;

      switch (event.data?.type) {
        case 'ifts:abrir':
          setAbierto(true);
          break;
        case 'ifts:cerrar':
          setAbierto(false);
          break;
        case 'ifts:alternar':
          setAbierto((v) => !v);
          break;
        case 'ifts:reiniciar':
          void chat.reiniciar();
          break;
        default:
          break;
      }
    }

    window.addEventListener('message', alRecibir);
    return () => window.removeEventListener('message', alRecibir);
  }, [chat]);

  /* ----------------------------------------------------------------------
     Atajos de teclado dentro del widget
     -------------------------------------------------------------------- */
  const alTeclear = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') setAbierto(false);
  }, []);

  const alternar = useCallback(() => setAbierto((v) => !v), []);

  const clases = ['ifts-widget'];
  if (embebido) clases.push('ifts-widget--embedeado');

  /* ----------------------------------------------------------------------
     Vista embebida: siempre abierta
     -------------------------------------------------------------------- */
  if (embebido) {
    return (
      <div className={clases.join(' ')} onKeyDown={alTeclear}>
        <div
          className="ifts-panel"
          ref={panelRef}
          style={{ ['--ifts-alto' as string]: `${ALTO_PANEL}px` }}
        >
          <ChatHeader titulo={titulo || undefined} />
          <Cuerpo chat={chat} cuerpoRef={cuerpoRef} />
          <Entrada chat={chat} />
          <Pie
            onReiniciar={() => void chat.reiniciar()}
            onVolver={() => void chat.volver()}
            puedeVolver={chat.puedeNavegarAtras}
          />
        </div>
      </div>
    );
  }

  return (
    <div className={clases.join(' ')} onKeyDown={alTeclear}>
      <ChatLauncher abierto={abierto} onClick={alternar} />

      {abierto ? (
        <div className="ifts-panel" ref={panelRef} role="dialog" aria-label="Asistente virtual IFTS 29">
          <ChatHeader onCerrar={() => setAbierto(false)} />
          <Cuerpo chat={chat} cuerpoRef={cuerpoRef} />
          <Entrada chat={chat} />
          <Pie
            onReiniciar={() => void chat.reiniciar()}
            onVolver={() => void chat.volver()}
            puedeVolver={chat.puedeNavegarAtras}
          />
        </div>
      ) : null}
    </div>
  );
}

/* ==========================================================================
   Cuerpo: lista de turnos + opciones
   ======================================================================== */

function Cuerpo({
  chat,
  cuerpoRef,
}: {
  chat: ReturnType<typeof useChat>;
  cuerpoRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <div className="ifts-cuerpo" ref={cuerpoRef} role="log" aria-live="polite" aria-atomic="false">
      {chat.turnos.map((turno) => (
        <Turno key={turno.id} turno={turno} />
      ))}

      {chat.cargando ? <Escribiendo /> : null}

      {chat.error && chat.turnos.length === 0 ? (
        <div className="ifts-doc ifts-doc--sin-enlace" style={{ marginTop: 8 }}>
          <span className="ifts-doc__icono" aria-hidden="true">
            ⚠️
          </span>
          <span className="ifts-doc__cuerpo">
            <span className="ifts-doc__nombre">No pudimos iniciar la consulta</span>
            <span className="ifts-doc__aviso">{chat.error}</span>
            <span className="ifts-doc__accion" style={{ cursor: 'pointer' }} onClick={() => void chat.reiniciar()}>
              Volver a intentar
            </span>
          </span>
        </div>
      ) : null}

      <OptionList opciones={chat.opciones} deshabilitado={chat.cargando} onSeleccionar={chat.seleccionar} />
    </div>
  );
}

function Turno({ turno }: { turno: Turno }) {
  return (
    <>
      <MessageBubble autor={turno.autor} variante={turno.variante}>
        {formatearTexto(turno.texto)}
      </MessageBubble>

      {turno.documentos && turno.documentos.length > 0 ? (
        <div style={{ margin: '0 0 14px 37px' }}>
          <DocumentList documentos={turno.documentos} />
        </div>
      ) : null}

      {turno.contactos && turno.contactos.length > 0 ? (
        <div style={{ margin: '0 0 14px 37px' }}>
          {turno.contactos.map((c) => (
            <ContactCard key={c.clave} contacto={c} />
          ))}
          <AvisoDerivacionAsincronica />
        </div>
      ) : null}
    </>
  );
}

/* ==========================================================================
   Campo de consulta escrita
   --------------------------------------------------------------------------
   Complementa al menu, no lo reemplaza: la API interpreta el texto y devuelve
   la MISMA respuesta autorizada que daria la opcion equivalente. Si la consulta
   es ambigua, la respuesta llega con opciones del menu.
   ======================================================================== */

function Entrada({ chat }: { chat: ReturnType<typeof useChat> }) {
  const [texto, setTexto] = useState('');
  const campoRef = useRef<HTMLTextAreaElement>(null);

  const vacio = texto.trim().length < config.minMensaje;
  const deshabilitado = chat.cargando || vacio;

  const enviar = useCallback(() => {
    if (chat.cargando || texto.trim().length < config.minMensaje) return;
    const consulta = texto;
    setTexto('');
    // Se recupera el foco para poder encadenar consultas sin usar el mouse.
    campoRef.current?.focus();
    void chat.consultar(consulta);
  }, [chat, texto]);

  const alPulsarEnter = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  };

  return (
    <form
      className="ifts-entrada"
      onSubmit={(e) => {
        e.preventDefault();
        enviar();
      }}
    >
      <label className="ifts-entrada__etiqueta" htmlFor="ifts-consulta">
        También podés escribir tu consulta
      </label>

      <div className="ifts-entrada__fila">
        <textarea
          id="ifts-consulta"
          ref={campoRef}
          className="ifts-entrada__campo"
          rows={1}
          value={texto}
          maxLength={config.maxMensaje}
          placeholder="Ej: ¿cuándo empiezan las clases de Técnicas de Programación?"
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={alPulsarEnter}
          disabled={chat.cargando}
        />
        <button
          type="submit"
          className="ifts-entrada__enviar"
          disabled={deshabilitado}
          aria-label="Enviar consulta"
          title="Enviar consulta"
        >
          <IconoEnviar />
        </button>
      </div>
    </form>
  );
}

/* ==========================================================================
   Pie
   ======================================================================== */

function Pie({
  onReiniciar,
  onVolver,
  puedeVolver,
}: {
  onReiniciar: () => void;
  onVolver: () => void;
  puedeVolver: boolean;
}) {
  return (
    <footer className="ifts-pie">
      {puedeVolver ? (
        <button type="button" className="ifts-reiniciar" onClick={onVolver}>
          ‹ Volver al menú
        </button>
      ) : (
        <span />
      )}
      <button type="button" className="ifts-reiniciar" onClick={onReiniciar}>
        <IconoReiniciar />
        Reiniciar
      </button>
    </footer>
  );
}
