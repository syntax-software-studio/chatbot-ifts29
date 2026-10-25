import { IconoFlecha } from './icons';
import type { OpcionMenu } from '../types';

interface PropsOpciones {
  opciones: OpcionMenu[];
  deshabilitado: boolean;
  onSeleccionar: (clave: string) => void;
}

/**
 * Lista de botones del menú. Es uno de los dos caminos de interacción: el otro
 * es el compositor de consulta escrita, que termina en la misma opción (RF05).
 */
export function OptionList({ opciones, deshabilitado, onSeleccionar }: PropsOpciones) {
  // "Volver" no se muestra en la lista: tiene un único lugar, el pie del widget.
  const visibles = opciones.filter((o) => !o.esVolver);
  if (visibles.length === 0) return null;

  return (
    <div className="ifts-opciones" role="group" aria-label="Opciones del menú">
      {visibles.map((opcion) => (
        <button
          key={opcion.clave}
          type="button"
          className="ifts-opcion"
          disabled={deshabilitado}
          onClick={() => onSeleccionar(opcion.clave)}
        >
          <span>
            {opcion.etiqueta}
            {opcion.descripcion ? (
              <>
                <br />
                <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}>{opcion.descripcion}</span>
              </>
            ) : null}
          </span>
          <IconoFlecha className="ifts-opcion__flecha" />
        </button>
      ))}
    </div>
  );
}
