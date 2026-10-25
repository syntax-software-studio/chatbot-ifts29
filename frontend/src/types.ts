/** Contrato de datos con la API. Espejo de `backend/src/db/types.ts`. */

export type TipoOpcion = 'navegar' | 'responder' | 'derivar';

export interface Categoria {
  id: number;
  clave: string;
  nombre: string;
  mensaje: string | null;
  orden: number;
  esRaiz: boolean;
}

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

export interface Contacto {
  id: number;
  clave: string;
  nombre: string;
  area: string | null;
  email: string | null;
  urlPerfil: string | null;
  motivo: string | null;
}

export interface OpcionMenu {
  clave: string;
  etiqueta: string;
  descripcion: string | null;
  tipo: TipoOpcion;
  esVolver: boolean;
  icono: string | null;
}

export interface NodoMenu {
  origen: FuenteDatos;
  categoria: Categoria;
  mensaje: string;
  opciones: OpcionMenu[];
  esRaiz: boolean;
}

export interface Respuesta {
  texto: string;
  documentos: Documento[];
}

export interface Derivacion {
  texto: string;
  contactos: Contacto[];
}

/**
 * Metadatos de interpretación de una consulta escrita.
 *
 * No se muestran al estudiante: sirven para trazabilidad y para medir en qué
 * casos hay que ampliar la base de conocimiento (D18).
 */
export interface MetaInterpretacion {
  /** Intención resuelta, o `null` si hubo que preguntar. */
  intent: string | null;
  confidence: number;
  source: 'menu' | 'kb_question' | 'kb_variant' | 'rule' | 'none';
  matchType: 'exacto' | 'similar' | 'regla' | 'ninguno';
}

/**
 * La consulta es válida pero demasiado general: se pide precisar.
 *
 * Las opciones son opciones reales del menú, así que el estudiante responde
 * con un botón y el flujo sigue siendo el de siempre.
 */
export interface Aclaracion {
  mensaje: string;
  opciones: OpcionMenu[];
}

export type TurnoChat =
  | { origen: FuenteDatos; tipo: 'nodo'; nodo: NodoMenu; meta?: MetaInterpretacion }
  | { origen: FuenteDatos; tipo: 'respuesta'; claveOpcion: string; respuesta: Respuesta; nodoActual: string; meta?: MetaInterpretacion }
  | { origen: FuenteDatos; tipo: 'derivacion'; claveOpcion: string; derivacion: Derivacion; meta?: MetaInterpretacion }
  | { origen: FuenteDatos; tipo: 'aclaracion'; aclaracion: Aclaracion; meta?: MetaInterpretacion }
  | { origen: FuenteDatos; tipo: 'no_disponible'; mensaje: string; meta?: MetaInterpretacion }
  | { origen: FuenteDatos; tipo: 'error'; mensaje: string };

export type FuenteDatos = 'base' | 'seed';
