/**
 * Contrato de datos compartido entre la API y el frontend.
 * El frontend replica estas formas en `src/types.ts`.
 */

export type TipoOpcion = 'navegar' | 'responder' | 'derivar';

/** Categoria = nodo del arbol conversacional. */
export interface Categoria {
  id: number;
  clave: string;
  nombre: string;
  mensaje: string | null;
  orden: number;
  esRaiz: boolean;
}

/** Documento institucional referenciado desde Google Drive. */
export interface Documento {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  mimeType: string;
  url: string | null;
  vigente: boolean;
  estado: 'borrador' | 'revision' | 'vigente' | 'reemplazado' | 'archivado';
  fechaActualizacion: string | null;
  sincronizado: boolean;
}

/** Contacto de derivacion asincronica (RF04). */
export interface Contacto {
  id: number;
  clave: string;
  nombre: string;
  area: string | null;
  email: string | null;
  urlPerfil: string | null;
  motivo: string | null;
}

/** Opcion seleccionable del menu: es la respuesta autorizada a la que también
 *  mapea una consulta escrita, asi que no lleva texto propio (RF05). */
export interface OpcionMenu {
  clave: string;
  etiqueta: string;
  descripcion: string | null;
  tipo: TipoOpcion;
  esVolver: boolean;
  icono: string | null;
}

/** Nodo devuelto por /api/menu: mensaje del bot + opciones. */
export interface NodoMenu {
  categoria: Categoria;
  mensaje: string;
  opciones: OpcionMenu[];
  esRaiz: boolean;
}

/** Sección del documento que responde la consulta (texto literal del PDF). */
export interface Extracto {
  titulo: string;
  texto: string;
}

/** Respuesta completa de una opcion de tipo `responder`. */
export interface Respuesta {
  texto: string;
  documentos: Documento[];
  /** Solo en consultas escritas: pasajes del documento que responden la pregunta. */
  extractos?: Extracto[];
}

/** Respuesta completa de una opcion de tipo `derivar`. */
export interface Derivacion {
  texto: string;
  contactos: Contacto[];
}

/** Origen del turno: menu guiado o motor de lenguaje natural. */
export type FuenteTurno = 'menu' | 'kb_question' | 'kb_variant' | 'rule' | 'none';

/** Como se resolvio la interpretacion de la consulta (trazabilidad, D18). */
export type TipoMatch = 'exacto' | 'fts' | 'similar' | 'regla' | 'ninguno';

/**
 * Metadatos internos de la interpretacion.
 *
 * No se muestran al estudiante, pero viajan en la respuesta de la API para
 * auditoria, depuracion y mejora de la base de conocimiento.
 */
export interface MetaInterpretacion {
  intent: string | null;
  confidence: number;
  source: FuenteTurno;
  matchType: TipoMatch;
}

/**
 * Aclaracion: la consulta es valida pero demasiado general.
 *
 * Las opciones son opciones reales del menu (`OpcionMenu`), de modo que el
 * estudiante responde con un boton y el flujo sigue siendo el de siempre.
 */
export interface Aclaracion {
  mensaje: string;
  opciones: OpcionMenu[];
}

export type TurnoChat =
  | { tipo: 'nodo'; nodo: NodoMenu; meta?: MetaInterpretacion }
  | { tipo: 'respuesta'; claveOpcion: string; respuesta: Respuesta; nodoActual: string; meta?: MetaInterpretacion }
  | { tipo: 'derivacion'; claveOpcion: string; derivacion: Derivacion; meta?: MetaInterpretacion }
  | { tipo: 'aclaracion'; aclaracion: Aclaracion; meta?: MetaInterpretacion }
  | { tipo: 'no_disponible'; mensaje: string; meta?: MetaInterpretacion }
  | { tipo: 'error'; mensaje: string };

