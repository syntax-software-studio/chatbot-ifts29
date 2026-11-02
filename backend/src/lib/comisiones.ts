/**
 * Gestión de consulta de comisiones, según documentos
 *
 * La convención de nombres (ver docs/desarrollo-e-integracion/07) es:
 * <CódigoMateria>_<Tipo>[_<Comisión>]_<Año>[_<CuatrimestreDeCursada>]
 *
 * La sincronización lee el nombre una sola vez (`parsearDocumento`) y guarda los
 * campos en la base. Las funciones de consulta trabajan sobre esos campos.
 *
 * Una opción con documentos de varias comisiones del mismo tipo no los muestra
 * todos: pregunta la comisión. La opción elegida viaja como `CLAVE@COMISION`.
 */

const NOMBRE_DOCUMENTO = /^([A-Z]+)_([a-z][a-z-]*)(?:_([A-Z]))?_(\d{4})(?:_([12]C))?$/;

const SEPARADOR_COMISION = '@';

/** Campos de la convención de nombres, tal como se guardan en la base. */
export interface DatosDeDocumento {
  materia: string;
  tipo: string;
  comision: string | null;
  anio: number;
  cuatrimestre: string | null;
}

/** Campos de un documento que intervienen en la pregunta de comisión. Vienen de la base. */
export interface DocumentoConComision {
  materia: string | null;
  tipo: string | null;
  comision: string | null;
  anio: number | null;
  cuatrimestre: string | null;
}

/** Lee los campos de un documento a partir de su clave. Null si el nombre no sigue la convención. */
export function parsearDocumento(clave: string): DatosDeDocumento | null {
  const m = NOMBRE_DOCUMENTO.exec(clave);
  if (!m) return null;
  const [, materia, tipo, comision = null, anio, cuatrimestre = null] = m;
  return { materia: materia!, tipo: tipo!, comision, anio: Number(anio), cuatrimestre };
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

/** Materia, tipo, año y cuatrimestre: documentos con el mismo grupo son versiones por comisión. */
const grupoDe = (d: DocumentoConComision): string =>
  [d.materia, d.tipo, d.anio, d.cuatrimestre].filter((x) => x !== null).join('_');

/**
 * Comisiones que hay que preguntar: las de los grupos que tienen más de una.
 * Vacío si la respuesta no depende de la comisión.
 */
export function comisionesAPreguntar(documentos: DocumentoConComision[]): string[] {
  const porGrupo = new Map<string, Set<string>>();
  for (const d of documentos) {
    if (d.comision === null) continue;
    const grupo = grupoDe(d);
    const set = porGrupo.get(grupo) ?? new Set<string>();
    set.add(d.comision);
    porGrupo.set(grupo, set);
  }
  const comisiones = new Set<string>();
  for (const set of porGrupo.values()) {
    if (set.size > 1) set.forEach((c) => comisiones.add(c));
  }
  return [...comisiones].sort();
}

/** Deja los documentos de la comisión elegida y los que no dependen de la comisión. */
export function filtrarPorComision<T extends DocumentoConComision>(documentos: T[], comision: string): T[] {
  return documentos.filter((d) => d.comision === null || d.comision === comision);
}
