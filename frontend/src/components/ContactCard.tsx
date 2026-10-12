import { IconoCorreo, IconoInfo, IconoUsuario } from './icons';
import type { Contacto } from '../types';

function iniciales(nombre: string): string {
  const partes = nombre
    .replace(/^(MG|Lic|Prof|Ing|Dr|Sr|Sra)\.?\s+/i, '')
    .split(/\s+/)
    .filter(Boolean);
  const primera = partes[0]?.[0] ?? '?';
  const segunda = partes[1]?.[0] ?? '';
  return (primera + segunda).toUpperCase();
}

interface PropsContacto {
  contacto: Contacto;
}

/**
 * Ficha de derivación (RF04).
 *
 * Muestra nombre, área, correo y enlace de perfil junto con el motivo. La
 * derivación es asincrónica: el asistente no inicia conversaciones, no envía
 * mensajes y no gestiona trámites en nombre del estudiante.
 */
export function ContactCard({ contacto }: PropsContacto) {
  const perfil = contacto.urlPerfil;

  return (
    <div className="ifts-contacto">
      <div className="ifts-contacto__avatar" aria-hidden="true">
        {iniciales(contacto.nombre)}
      </div>

      <div className="ifts-contacto__cuerpo">
        <p className="ifts-contacto__nombre">{contacto.nombre}</p>

        {contacto.motivo ? <p className="ifts-contacto__motivo">{contacto.motivo}</p> : null}

        <div className="ifts-contacto__links">
          {contacto.email ? (
            <a className="ifts-contacto__link" href={`mailto:${contacto.email}`}>
              <IconoCorreo />
              {contacto.email}
            </a>
          ) : null}

          {perfil ? (
            <a
              className="ifts-contacto__link ifts-contacto__link--secundario"
              href={perfil}
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconoUsuario />
              Ver perfil
            </a>
          ) : null}
        </div>      </div>
    </div>
  );
}

/** Aviso permanente de que la derivación es asincrónica. */
export function AvisoDerivacionAsincronica() {
  return (
    <p className="ifts-aviso-async">
      <IconoInfo />
      <span>
        El asistente no envía mensajes por vos.
        Escribile directamente a la persona del área indicada.
      </span>
    </p>
  );
}
