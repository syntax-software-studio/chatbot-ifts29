/**
 * Gestión de consulta de omisiones, según documentos
 *
 * La convención de nombres (ver docs/desarrollo-e-integracion/07) es:
 * <CódigoMateria>_<Tipo>[_<Comisión>]_<Año>[_<CuatrimestreDeCursada>]
 *
 * La comisión es opcional y es una sola letra. Se lee de la clave del documento
 * (el nombre sin .pdf), así que no hace falta una columna extra en la planilla.
 *
 * Una opción con documentos de varias comisiones del mismo tipo no los muestra
 * todos: pregunta la comisión. La opción elegida viaja como `CLAVE@COMISION`.
 */

const NOMBRE_DOCUMENTO = /^([A-Z]+)_([a-z][a-z-]*)(?:_([A-Z]))?_(\d{4})(?:_([12]C))?$/;

const SEPARADOR_COMISION = '@';

export interface ComisionDeDocumento {
  /** Materia, tipo, año y cuatrimestre: documentos con el mismo grupo son versiones por comisión. */
  grupo: string;
  comision: string | null;
}

/** Lee la comisión y el grupo de un documento a partir de su clave. Null si el nombre no sigue la convención. */
export function comisionDeDocumento(clave: string): ComisionDeDocumento | null {
  const m = NOMBRE_DOCUMENTO.exec(clave);
  if (!m) return null;
  const [, materia, tipo, comision = null, anio, cuatrimestre = ''] = m;
  return { grupo: [materia, tipo, anio, cuatrimestre].filter(Boolean).join('_'), comision };
}

/** Separa la clave de una opción de la comisión elegida: `ABD_OP_COND@B` -> { base, comision: 'B' }. */
export function separarComision(opcion: string): { base: string; comision: string | null } {
  const i = opcion.indexOf(SEPARADOR_COMISION);
  if (i === -1) return { base: opcion, comision: null };
  return { base: opcion.slice(0, i), comision: opcion.slice(i + 1) };
}

/** Clave de la opción que representa una comisión concreta. */
export function claveConComision(opcionClave: string, comision: string): string {
  return `${opcionClave}${SEPARADOR_COMISION}${comision}`;
}

/**
 * Comisiones que hay que preguntar: las de los grupos que tienen más de una.
 * Vacío si la respuesta no depende de la comisión.
 */
export function comisionesAPreguntar(documentos: { clave: string }[]): string[] {
  const porGrupo = new Map<string, Set<string>>();
  for (const d of documentos) {
    const c = comisionDeDocumento(d.clave);
    if (!c || c.comision === null) continue;
    const set = porGrupo.get(c.grupo) ?? new Set<string>();
    set.add(c.comision);
    porGrupo.set(c.grupo, set);
  }
  const comisiones = new Set<string>();
  for (const set of porGrupo.values()) {
    if (set.size > 1) set.forEach((c) => comisiones.add(c));
  }
  return [...comisiones].sort();
}

/** Deja los documentos de la comisión elegida y los que no dependen de la comisión. */
export function filtrarPorComision<T extends { clave: string }>(documentos: T[], comision: string): T[] {
  return documentos.filter((d) => {
    const c = comisionDeDocumento(d.clave);
    if (!c || c.comision === null) return true;
    return c.comision === comision;
  });
}
