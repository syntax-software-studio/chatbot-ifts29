/**
 * Carga del contenido de la fuente (planilla) a la base PostgreSQL.
 *
 * Dos pasos, separados a propósito:
 *  1. `convertirContenido`: convierte las filas de texto a tipos de base y
 *     valida referencias entre pestañas. Es una función pura: si hay errores,
 *     no se escribe nada.
 *  2. `aplicarContenido`: escribe todo en una sola transacción.
 *
 * Reglas de escritura. La planilla es la única fuente: lo que no está en ella
 * no se conserva en la base.
 *  - Base de conocimiento (`kb_*`, incluidos los alias), `respuesta_documento` y `opcion_contacto`:
 *    se vacían y se vuelven a cargar. No tienen historial propio.
 *  - Menú (`categoria`, `opcion_menu`, `respuesta`), contactos y documentos:
 *    upsert por clave, y se borra lo que ya no está en la planilla.
 *  - Documentos: la ficha se crea por nombre de archivo; la sincronización con
 *    Drive completa el resto (enlaces, IDs, MD5).
 *  - Las métricas (`metrica_opcion`, `sesion_contexto`) no se tocan.
 */

import type { PoolClient } from 'pg';
import { getPool } from '../db/pool.js';
import { normalizar, normalizarConsulta } from '../lib/normalizar.js';
import type { Fila, Pestana } from '../lib/planilla.js';

export interface Categoria {
  clave: string;
  nombre: string;
  mensaje: string | null;
  orden: number;
  esRaiz: boolean;
}

export interface Respuesta {
  clave: string;
  texto: string;
  orden: number;
}

export interface Opcion {
  clave: string;
  categoria: string;
  etiqueta: string;
  tipo: 'navegar' | 'responder' | 'derivar';
  destino: string | null;
  respuesta: string | null;
  orden: number;
  esVolver: boolean;
}

export interface Documento {
  /** Nombre del archivo sin extensión: identifica la ficha. */
  clave: string;
  /** Nombre completo del archivo en Drive. */
  nombreArchivo: string;
}

export interface RespuestaDocumento {
  respuesta: string;
  documento: string;
  orden: number;
}

export interface Intencion {
  clave: string;
  nombre: string;
  dominio: 'administrativo' | 'academico';
  opcion: string;
}

export interface Pregunta {
  intencion: string;
  pregunta: string;
  prioridad: number;
  umbral: number;
}

export interface Variante {
  intencion: string;
  pregunta: string;
  texto: string;
  normalizado: string;
  peso: number;
}

export interface Contacto {
  clave: string;
  nombre: string;
  area: string | null;
  comision: string | null;
  email: string | null;
  perfil: string | null;
  motivo: string | null;
  orden: number;
  /** Opción de tipo 'derivar' a la que pertenece el contacto. */
  opcion: string;
}

/** Sigla o abreviatura de la consulta y su expansión (ambas ya normalizadas). */
export interface Alias {
  alias: string;
  expansion: string;
}

/** Palabra de la consulta que se descarta al buscar (ya normalizada). */
export interface TerminoIgnorado {
  termino: string;
}

export interface DatosContenido {
  categorias: Categoria[];
  respuestas: Respuesta[];
  opciones: Opcion[];
  documentos: Documento[];
  respuestaDocumentos: RespuestaDocumento[];
  intenciones: Intencion[];
  preguntas: Pregunta[];
  variantes: Variante[];
  contactos: Contacto[];
  alias: Alias[];
  ignorados: TerminoIgnorado[];
}

interface ResultadoConversion {
  ok: boolean;
  datos?: DatosContenido;
  errores: string[];
}

export interface ResumenCarga {
  categorias: number;
  respuestas: number;
  opciones: number;
  documentos: number;
  respuestaDocumentos: number;
  intenciones: number;
  preguntas: number;
  variantes: number;
  contactos: number;
  opcionContacto: number;
}

type Hojas = Partial<Record<Pestana, Fila[]>>;

const TIPOS_OPCION = ['navegar', 'responder', 'derivar'] as const;
const DOMINIOS = ['administrativo', 'academico'] as const;

/** Texto vacío -> null; cualquier otro texto, sin espacios sobrantes. */
const opcional = (texto: string): string | null => (texto === '' ? null : texto);

/**
 * Convierte las filas de texto a tipos de base y valida el contenido.
 *
 * Reporta todos los errores juntos. Acepta decimales con coma (`0,7`) porque
 * Google Sheets los muestra así según la configuración regional.
 */
export function convertirContenido(hojas: Hojas): ResultadoConversion {
  const errores: string[] = [];
  const filas = (p: Pestana): Fila[] => hojas[p] ?? [];

  const entero = (texto: string, donde: string): number => {
    if (!/^-?\d+$/.test(texto)) {
      errores.push(`${donde}: "${texto}" no es un número entero.`);
      return 0;
    }
    return Number(texto);
  };

  const decimal = (texto: string, donde: string): number => {
    const normal = texto.replace(',', '.');
    if (!/^\d+(\.\d+)?$/.test(normal)) {
      errores.push(`${donde}: "${texto}" no es un número.`);
      return 0;
    }
    return Number(normal);
  };

  const booleano = (texto: string, donde: string): boolean => {
    const t = texto.toUpperCase();
    if (t === '' || t === 'FALSE') return false;
    if (t === 'TRUE') return true;
    errores.push(`${donde}: "${texto}" debe ser TRUE o FALSE.`);
    return false;
  };

  // --- Categorías y respuestas (sin referencias salientes) ---
  const categorias: Categoria[] = filas('categorias').map((f) => ({
    clave: f.clave!,
    nombre: f.nombre!,
    mensaje: opcional(f.mensaje!),
    orden: entero(f.orden!, `categorias "${f.clave}" orden`),
    esRaiz: booleano(f.es_raiz!, `categorias "${f.clave}" es_raiz`),
  }));
  const respuestas: Respuesta[] = filas('respuestas').map((f) => ({
    clave: f.clave!,
    texto: f.texto!,
    orden: entero(f.orden!, `respuestas "${f.clave}" orden`),
  }));

  const claves = (xs: { clave: string }[]) => new Set(xs.map((x) => x.clave));
  const categoriaClaves = claves(categorias);
  const respuestaClaves = claves(respuestas);

  // --- Opciones del menú ---
  const opciones: Opcion[] = filas('opciones').map((f) => {
    const donde = `opciones "${f.clave}"`;
    const tipo = f.tipo as Opcion['tipo'];
    if (!TIPOS_OPCION.includes(tipo)) errores.push(`${donde}: tipo "${f.tipo}" no válido.`);
    if (!categoriaClaves.has(f.categoria!)) errores.push(`${donde}: categoria "${f.categoria}" no existe.`);
    const destino = opcional(f.destino!);
    const respuesta = opcional(f.respuesta!);
    if (destino && !categoriaClaves.has(destino)) errores.push(`${donde}: destino "${destino}" no existe.`);
    if (respuesta && !respuestaClaves.has(respuesta)) errores.push(`${donde}: respuesta "${respuesta}" no existe.`);
    if (tipo === 'navegar' && !destino) errores.push(`${donde}: tipo navegar requiere destino.`);
    if (tipo === 'responder' && !respuesta) errores.push(`${donde}: tipo responder requiere respuesta.`);
    return {
      clave: f.clave!,
      categoria: f.categoria!,
      etiqueta: f.etiqueta!,
      tipo,
      destino,
      respuesta,
      orden: entero(f.orden!, `${donde} orden`),
      esVolver: booleano(f.es_volver!, `${donde} es_volver`),
    };
  });
  const opcionClaves = claves(opciones);

  // --- Documentos adjuntos a respuestas ---
  const respuestaDocumentos: RespuestaDocumento[] = filas('respuesta_documentos').map((f) => {
    const donde = `respuesta_documentos "${f.respuesta}" → "${f.documento}"`;
    if (!respuestaClaves.has(f.respuesta!)) errores.push(`${donde}: respuesta no existe.`);
    if (!f.documento) errores.push(`${donde}: falta el nombre del documento.`);
    return {
      respuesta: f.respuesta!,
      documento: f.documento!.replace(/\.pdf$/i, ''),
      orden: entero(f.orden!, `${donde} orden`),
    };
  });
  const documentos: Documento[] = [...new Map(
    respuestaDocumentos.map((rd) => [rd.documento, { clave: rd.documento, nombreArchivo: `${rd.documento}.pdf` }]),
  ).values()];

  // --- Alias (siglas) ---
  const alias: Alias[] = filas('alias').map((f) => ({
    alias: normalizar(f.alias!),
    expansion: normalizar(f.expansion!),
  }));
  const aliasVistos = new Set<string>();
  for (const a of alias) {
    if (!a.alias || !a.expansion) errores.push('alias: hay una fila sin sigla o sin expansión.');
    if (aliasVistos.has(a.alias)) errores.push(`alias "${a.alias}" está repetido.`);
    aliasVistos.add(a.alias);
  }
  const mapaAlias = new Map(alias.map((a) => [a.alias, a.expansion] as const));

  // --- Términos ignorados (ruido de la consulta) ---
  const ignorados: TerminoIgnorado[] = filas('ignorados').map((f) => ({
    termino: normalizar(f.termino!),
  }));
  const ignoradosVistos = new Set<string>();
  for (const t of ignorados) {
    if (!t.termino) errores.push('ignorados: hay una fila vacía.');
    if (ignoradosVistos.has(t.termino)) errores.push(`ignorados "${t.termino}" está repetido.`);
    ignoradosVistos.add(t.termino);
  }

  // --- Base de conocimiento ---
  const intenciones: Intencion[] = filas('intenciones').map((f) => {
    const donde = `intenciones "${f.clave}"`;
    if (!(DOMINIOS as readonly string[]).includes(f.dominio!)) {
      errores.push(`${donde}: dominio "${f.dominio}" no válido.`);
    }
    if (!opcionClaves.has(f.opcion!)) errores.push(`${donde}: opcion "${f.opcion}" no existe.`);
    return {
      clave: f.clave!,
      nombre: f.nombre!,
      dominio: f.dominio as Intencion['dominio'],
      opcion: f.opcion!,
    };
  });
  const intencionClaves = claves(intenciones);

  const preguntas: Pregunta[] = filas('preguntas').map((f) => {
    const donde = `preguntas "${f.intencion}" / "${f.pregunta}"`;
    if (!intencionClaves.has(f.intencion!)) errores.push(`${donde}: intencion no existe.`);
    return {
      intencion: f.intencion!,
      pregunta: f.pregunta!,
      prioridad: entero(f.prioridad!, `${donde} prioridad`),
      umbral: decimal(f.umbral!, `${donde} umbral`),
    };
  });
  const preguntaClave = (intencion: string, pregunta: string) => `${intencion}\u0000${pregunta}`;
  const preguntasSet = new Set(preguntas.map((p) => preguntaClave(p.intencion, p.pregunta)));
  if (preguntasSet.size !== preguntas.length) errores.push('preguntas: hay preguntas repetidas dentro de una intención.');

  const variantes: Variante[] = filas('variantes').map((f) => {
    const donde = `variantes "${f.intencion}" / "${f.pregunta}" → "${f.texto}"`;
    if (!preguntasSet.has(preguntaClave(f.intencion!, f.pregunta!))) {
      errores.push(`${donde}: la pregunta no existe en preguntas.`);
    }
    return {
      intencion: f.intencion!,
      pregunta: f.pregunta!,
      texto: f.texto!,
      normalizado: normalizarConsulta(f.texto!, mapaAlias),
      peso: decimal(f.peso!, `${donde} peso`),
    };
  });
  const variantesVistas = new Set<string>();
  for (const v of variantes) {
    const clave = `${preguntaClave(v.intencion, v.pregunta)}\u0000${v.normalizado}`;
    if (variantesVistas.has(clave)) {
      errores.push(`variantes "${v.intencion}" / "${v.pregunta}": "${v.texto}" está repetida.`);
    }
    variantesVistas.add(clave);
  }

  // --- Contactos ---
  const tipoPorOpcion = new Map(opciones.map((o) => [o.clave, o.tipo]));
  const contactos: Contacto[] = filas('contactos').map((f) => {
    const donde = `contactos "${f.clave}"`;
    if (tipoPorOpcion.get(f.opcion!) !== 'derivar') {
      errores.push(`${donde}: opcion "${f.opcion}" no existe o no es de tipo derivar.`);
    }
    return {
      clave: f.clave!,
      nombre: f.nombre!,
      area: opcional(f.area!),
      comision: opcional(f.comision!),
      email: opcional(f.email!),
      perfil: opcional(f.perfil!),
      motivo: opcional(f.motivo!),
      orden: entero(f.orden!, `${donde} orden`),
      opcion: f.opcion!,
    };
  });

  if (errores.length > 0) return { ok: false, errores };
  return {
    ok: true,
    errores,
    datos: {
      categorias,
      respuestas,
      opciones,
      documentos,
      respuestaDocumentos,
      intenciones,
      preguntas,
      variantes,
      contactos,
      alias,
      ignorados,
    },
  };
}

