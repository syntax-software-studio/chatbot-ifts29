import { IconoFlecha } from './icons';
import type { OpcionMenu, OpcionContexto } from '../types';

interface PropsOpciones {
  opciones: Array<OpcionMenu | OpcionContexto>;
  deshabilitado: boolean;
  onSeleccionar: (clave: string, contexto?: number) => void;
}

/** Clave de contexto: se antepone `ctx:` para distinguirla de una opción. */
export const prefijoContexto = 'ctx:';

/**
 * Lista de botones del menú. Es uno de los dos caminos de interacción: el otro
 * es el compositor de consulta escrita, que termina en la misma opción (RF05).
 */
export function OptionList({ opciones, deshabilitado, onSeleccionar }: PropsOpciones) {
  // "Volver" no se muestra en la lista: tiene un único lugar, el pie del widget.
  const visibles = opciones.filter((o) => !('esVolver' in o && o.esVolver));
  if (visibles.length === 0) return null;

  return (
    <div className="ifts-opciones" role="group" aria-label="Opciones del menú">
      {visibles.map((opcion) => {
        const esContexto = 'contextoId' in opcion;
        const clave = esContexto ? `${prefijoContexto}${opcion.contextoId}` : opcion.clave;
        const etiqueta = esContexto ? opcion.etiqueta : opcion.etiqueta;
        const descripcion = esContexto ? null : (opcion as OpcionMenu).descripcion;

        return (
          <button
            key={clave}
            type="button"
            className="ifts-opcion"
            disabled={deshabilitado}
            onClick={() =>
              onSeleccionar(clave, esContexto ? (opcion as OpcionContexto).contextoId : undefined)
            }
          >
            <span>
              {etiqueta}
              {descripcion ? (
                <>
                  <br />
                  <span style={{ fontWeight: 400, fontSize: 12, opacity: 0.75 }}>{descripcion}</span>
                </>
              ) : null}
            </span>
            <IconoFlecha className="ifts-opcion__flecha" />
          </button>
        );
      })}
    </div>
  );
}
