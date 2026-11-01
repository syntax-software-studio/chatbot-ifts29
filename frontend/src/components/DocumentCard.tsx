import { ETIQUETA_MIME } from '../config';
import { IconoEnlaceExterno } from './icons';
import { registrarApertura } from '../api/client';
import type { Documento } from '../types';

/** Emoji del tipo de archivo, para identificarlo rápido sin ícono externo. */
const EMOJI_POR_TIPO: Record<string, string> = {
  programa: '📘',
  cronograma: '🗓️',
  condiciones_aprobacion: '✅',
  instructivo: '📋',
  presentacion: '📊',
  planilla: '📗',
  documento: '📄',
};

function etiquetaTipo(doc: Documento): string {
  return ETIQUETA_MIME[doc.mimeType] ?? 'Documento';
}

function fechaLegible(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface PropsDocumento {
  doc: Documento;
}

/**
 * Tarjeta de un documento institucional.
 *
 * Si el documento todavía no fue sincronizado con Drive, se muestra la ficha
 * sin enlace y con un aviso. No se genera una URL inventada: el estudiante no
 * debe recibir un enlace roto (RF07 - trazabilidad real del contenido vigente).
 */
export function DocumentCard({ doc }: PropsDocumento) {
  const emoji = EMOJI_POR_TIPO[doc.tipo] ?? '📄';
  const actualizado = fechaLegible(doc.fechaActualizacion);
  const tieneEnlace = Boolean(doc.url);

  const contenido = (
    <>
      <span className="ifts-doc__icono" aria-hidden="true">
        {emoji}
      </span>
      <span className="ifts-doc__cuerpo">
        <span className="ifts-doc__nombre">📄 {doc.nombre}</span>
        <span className="ifts-doc__meta">
          <span className="ifts-doc__tipo">{etiquetaTipo(doc)}</span>
          {actualizado ? <span>· Actualizado {actualizado}</span> : null}
        </span>

        {tieneEnlace ? (
          <span className="ifts-doc__accion">
            Ver documento
            <IconoEnlaceExterno />
          </span>
        ) : (
          <span className="ifts-doc__aviso">
            Documento en preparación. Consultá a tu tutora o a Bedelía por la versión vigente.
          </span>
        )}
      </span>
    </>
  );

  if (!tieneEnlace) {
    return <div className="ifts-doc ifts-doc--sin-enlace">{contenido}</div>;
  }

  return (
    <a
      className="ifts-doc"
      href={doc.url!}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => {
        void registrarApertura(doc.clave);
      }}
    >
      {contenido}
    </a>
  );
}

interface PropsListaDocumentos {
  documentos: Documento[];
}

export function DocumentList({ documentos }: PropsListaDocumentos) {
  if (documentos.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
      {documentos.map((doc) => (
        <DocumentCard key={doc.clave} doc={doc} />
      ))}
    </div>
  );
}
