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
 *  - Base de conocimiento (`kb_*`), `respuesta_documento` y `opcion_contacto`:
 *    se vacían y se vuelven a cargar. No tienen historial propio.
 *  - Menú (`categoria`, `opcion_menu`, `respuesta`), contactos y documentos:
 *    upsert por clave, y se borra lo que ya no está en la planilla.
 *  - Documentos: la ficha se crea por nombre de archivo; la sincronización con
 *    Drive completa el resto (enlaces, IDs, MD5).
 *  - Las métricas (`metrica_opcion`, `sesion_contexto`) no se tocan.
 */

import type { PoolClient } from 'pg';
import { getPool } from '../db/pool.js';
import { normalizar } from '../utils/normalizar.js';
import type { Fila, Pestana } from './fuente-contenido.service.js';

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
}

export interface ResultadoConversion {
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
      normalizado: normalizar(f.texto!),
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
    },
  };
}

/** Escribe el contenido en una sola transacción. Si algo falla, no queda nada a medias. */
export async function aplicarContenido(datos: DatosContenido): Promise<ResumenCarga> {
  const pool = getPool();
  if (!pool) throw new Error('DATABASE_URL no configurada: no hay base donde cargar el contenido.');

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const resumen = await escribir(client, datos);
    await client.query('COMMIT');
    return resumen;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function escribir(client: PoolClient, datos: DatosContenido): Promise<ResumenCarga> {
  const ids = async (tabla: string): Promise<Map<string, number>> => {
    const r = await client.query<{ id: number; clave: string }>(`SELECT id, clave FROM ${tabla}`);
    return new Map(r.rows.map((row) => [row.clave, row.id]));
  };
  const claves = (xs: { clave: string }[]) => xs.map((x) => x.clave);

  // Primero se vacían las tablas que dependen de otras, para que no bloqueen
  // los borrados de menú, respuestas y documentos que vienen después.
  await client.query('DELETE FROM kb_pregunta_variante');
  await client.query('DELETE FROM kb_pregunta');
  await client.query('DELETE FROM kb_intencion');
  await client.query('DELETE FROM respuesta_documento');
  await client.query('DELETE FROM opcion_contacto');

  // Menú: upsert por clave; lo que ya no está en la planilla se borra.
  for (const c of datos.categorias) {
    await client.query(
      `INSERT INTO categoria (clave, nombre, mensaje, orden, es_raiz, activo)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       ON CONFLICT (clave) DO UPDATE SET
         nombre = EXCLUDED.nombre, mensaje = EXCLUDED.mensaje,
         orden = EXCLUDED.orden, es_raiz = EXCLUDED.es_raiz, activo = TRUE`,
      [c.clave, c.nombre, c.mensaje, c.orden, c.esRaiz],
    );
  }
  for (const r of datos.respuestas) {
    await client.query(
      `INSERT INTO respuesta (clave, texto, orden, activo)
       VALUES ($1, $2, $3, TRUE)
       ON CONFLICT (clave) DO UPDATE SET texto = EXCLUDED.texto, orden = EXCLUDED.orden, activo = TRUE`,
      [r.clave, r.texto, r.orden],
    );
  }

  // Opciones: necesitan los ids de categoría y respuesta.
  await client.query('DELETE FROM opcion_menu WHERE NOT (clave = ANY($1::text[]))', [claves(datos.opciones)]);
  const categoriaId = await ids('categoria');
  const respuestaId = await ids('respuesta');
  for (const o of datos.opciones) {
    await client.query(
      `INSERT INTO opcion_menu (clave, categoria_id, etiqueta, tipo, categoria_destino_id, respuesta_id, es_volver, orden, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       ON CONFLICT (clave) DO UPDATE SET
         categoria_id = EXCLUDED.categoria_id, etiqueta = EXCLUDED.etiqueta, tipo = EXCLUDED.tipo,
         categoria_destino_id = EXCLUDED.categoria_destino_id, respuesta_id = EXCLUDED.respuesta_id,
         es_volver = EXCLUDED.es_volver, orden = EXCLUDED.orden, activo = TRUE`,
      [
        o.clave,
        categoriaId.get(o.categoria),
        o.etiqueta,
        o.tipo,
        o.destino ? categoriaId.get(o.destino) : null,
        o.respuesta ? respuestaId.get(o.respuesta) : null,
        o.esVolver,
        o.orden,
      ],
    );
  }
  await client.query('DELETE FROM categoria WHERE NOT (clave = ANY($1::text[]))', [claves(datos.categorias)]);
  await client.query('DELETE FROM respuesta WHERE NOT (clave = ANY($1::text[]))', [claves(datos.respuestas)]);

  // Documentos: fichas por nombre de archivo. Drive completa el resto.
  for (const d of datos.documentos) {
    await client.query(
      `INSERT INTO documento (clave, nombre, tipo, drive_nombre_archivo, vigente, estado)
       VALUES ($1, $2, 'documento', $2, TRUE, 'vigente')
       ON CONFLICT (clave) DO UPDATE SET drive_nombre_archivo = EXCLUDED.drive_nombre_archivo, vigente = TRUE, estado = 'vigente'`,
      [d.clave, d.nombreArchivo],
    );
  }
  // Fichas que la planilla ya no referencia se borran: el historial vive en la planilla.
  await client.query('DELETE FROM documento WHERE NOT (clave = ANY($1::text[]))', [claves(datos.documentos)]);
  const documentoId = await ids('documento');

  // Adjuntos: ya se borraron al inicio; se insertan de nuevo.
  for (const rd of datos.respuestaDocumentos) {
    await client.query(
      'INSERT INTO respuesta_documento (respuesta_id, documento_id, orden) VALUES ($1, $2, $3)',
      [respuestaId.get(rd.respuesta), documentoId.get(rd.documento), rd.orden],
    );
  }

  // Contactos: upsert; la asociación con derivación se reemplaza completa.
  for (const c of datos.contactos) {
    await client.query(
      `INSERT INTO contacto (clave, nombre, area, comision, email, url_perfil, motivo, orden, activo)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE)
       ON CONFLICT (clave) DO UPDATE SET
         nombre = EXCLUDED.nombre, area = EXCLUDED.area, comision = EXCLUDED.comision,
         email = EXCLUDED.email, url_perfil = EXCLUDED.url_perfil, motivo = EXCLUDED.motivo,
         orden = EXCLUDED.orden, activo = TRUE`,
      [c.clave, c.nombre, c.area, c.comision, c.email, c.perfil, c.motivo, c.orden],
    );
  }
  await client.query('DELETE FROM contacto WHERE NOT (clave = ANY($1::text[]))', [claves(datos.contactos)]);

  // Derivación: cada contacto pertenece a una sola opción de tipo 'derivar'.
  const contactoId = await ids('contacto');
  const opcionMenuId = await ids('opcion_menu');
  for (const c of datos.contactos) {
    await client.query(
      'INSERT INTO opcion_contacto (opcion_id, contacto_id, orden) VALUES ($1, $2, $3)',
      [opcionMenuId.get(c.opcion), contactoId.get(c.clave), c.orden],
    );
  }
  const opcionContacto = datos.contactos.length;

  // Base de conocimiento: ya se borró al inicio; se inserta de nuevo.
  for (const i of datos.intenciones) {
    await client.query(
      'INSERT INTO kb_intencion (clave, nombre, domain, opcion_clave, activo) VALUES ($1, $2, $3, $4, TRUE)',
      [i.clave, i.nombre, i.dominio, i.opcion],
    );
  }
  const intencionId = await ids('kb_intencion');

  const preguntaIdPorClave = new Map<string, number>();
  for (const p of datos.preguntas) {
    const r = await client.query<{ id: number }>(
      `INSERT INTO kb_pregunta (intencion_id, pregunta, priority, minimum_threshold, activo)
       VALUES ($1, $2, $3, $4, TRUE) RETURNING id`,
      [intencionId.get(p.intencion), p.pregunta, p.prioridad, p.umbral],
    );
    preguntaIdPorClave.set(`${p.intencion}\u0000${p.pregunta}`, r.rows[0]!.id);
  }

  for (const v of datos.variantes) {
    await client.query(
      `INSERT INTO kb_pregunta_variante (pregunta_id, original_text, normalized_text, weight, activo)
       VALUES ($1, $2, $3, $4, TRUE)`,
      [preguntaIdPorClave.get(`${v.intencion}\u0000${v.pregunta}`), v.texto, v.normalizado, v.peso],
    );
  }

  return {
    categorias: datos.categorias.length,
    respuestas: datos.respuestas.length,
    opciones: datos.opciones.length,
    documentos: datos.documentos.length,
    respuestaDocumentos: datos.respuestaDocumentos.length,
    intenciones: datos.intenciones.length,
    preguntas: datos.preguntas.length,
    variantes: datos.variantes.length,
    contactos: datos.contactos.length,
    opcionContacto,
  };
}
