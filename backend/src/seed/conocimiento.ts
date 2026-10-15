/**
 * Base de conocimiento conversacional en memoria (modo demo).
 *
 * Espejo de `db/005_kb_seed.sql`, igual que `catalogo.ts` espeja
 * `db/002_seed.sql`: si no hay `DATABASE_URL`, la API resuelve igual en Neon
 * que en el catálogo local, con los mismos umbrales.
 *
 * REGLAS DE CONTENIDO
 *   * Cada intencion apunta a una opcion del menu y a una respuesta YA
 *     existente en `respuesta` (nunca texto nuevo: ver §40 del prompt maestro).
 *   * `normalized_text` se calcula con el MISMO normalizador que usa el motor,
 *     para que demo y produccion comparen exactamente lo mismo.
 *   * La pregunta principal se guarda tambien como variante (peso 1.0): asi la
 *     busqueda exacta y la similitud trigram consultan un unico campo indexado.
 *   * Las variantes deliberadamente genericas ("programa", "dias de cursada")
 *     se repiten en las cuatro materias a proposito: son las que permiten que
 *     una consulta sin materia detalle una ACLARACION en vez de adivinar.
 */

import { normalizar } from '../utils/normalizar.js';

export type DominioKb = 'administrativo' | 'academico';

export interface SeedKbIntencion {
  id: number;
  key: string;
  name: string;
  domain: DominioKb;
  /** Opcion del menu equivalente (`opcion_menu.clave`). */
  opcion_clave: string;
  /** Respuesta autorizada equivalente (`respuesta.clave`). */
  respuesta_clave: string;
  activo: boolean;
}

export interface SeedKbPregunta {
  id: number;
  intencion_id: number;
  question: string;
  respuesta_clave: string;
  priority: number;
  minimum_threshold: number;
  activo: boolean;
}

export interface SeedKbVariante {
  id: number;
  pregunta_id: number;
  original_text: string;
  normalized_text: string;
  weight: number;
  activo: boolean;
}

export interface SeedKb {
  intenciones: SeedKbIntencion[];
  preguntas: SeedKbPregunta[];
  variantes: SeedKbVariante[];
}

/* ==========================================================================
 * 1. Rama administrativa (respuestas ya existentes del menu)
 * ======================================================================== */

interface AdminDef {
  key: string;
  name: string;
  opcion: string;
  respuesta: string;
  question: string;
  variantes: Array<[string, number]>;
}

const ADMINISTRATIVAS: AdminDef[] = [
  {
    key: 'inscripcion_materias',
    name: 'Inscripción a materias',
    opcion: 'ADM_OP_INSCRIPCION_MATERIAS',
    respuesta: 'ADM_INSCRIPCION_MATERIAS',
    question: '¿Cómo me inscribo a las materias?',
    variantes: [
      ['inscripción a materias', 0.95],
      ['cómo hago la inscripción a una materia', 0.95],
      ['cuándo se abren las inscripciones', 0.9],
      ['inscripción por el SIU Guaraní', 0.9],
    ],
  },
  {
    key: 'inscripcion_examenes',
    name: 'Inscripción a exámenes y mesas',
    opcion: 'ADM_OP_EXAMENES',
    respuesta: 'ADM_EXAMENES_MESAS',
    question: '¿Cómo me inscribo a los exámenes?',
    variantes: [
      ['mesas de examen', 0.95],
      ['inscripción a exámenes', 0.95],
      ['inscribirme a un examen', 0.9],
      ['cuándo son las mesas de examen', 0.9],
    ],
  },
  {
    key: 'acceso_siu',
    name: 'Acceso al SIU Guaraní',
    opcion: 'ADM_OP_SIU',
    respuesta: 'ADM_ACCESO_SIU',
    question: '¿Cómo accedo al SIU Guaraní?',
    variantes: [
      ['acceso al SIU', 0.95],
      ['cómo entro al SIU Guaraní', 0.95],
      ['usuario y contraseña del SIU', 0.9],
      ['no puedo entrar al SIU', 0.9],
    ],
  },
  {
    key: 'siu_o_campus',
    name: 'Diferencia entre SIU y Campus Virtual',
    opcion: 'ADM_OP_SIU_CAMPUS',
    respuesta: 'ADM_SIU_VS_CAMPUS',
    question: '¿Cuál es la diferencia entre el SIU y el campus virtual?',
    variantes: [
      ['diferencia entre SIU y campus', 0.95],
      ['SIU o campus', 0.9],
      ['para qué sirve el campus virtual', 0.9],
      ['qué es el campus virtual', 0.9],
    ],
  },
];

/* ==========================================================================
 * 2. Rama academica: una intencion por materia y por tipo de informacion
 *    (las 16 respuestas `*_dias_cursada`, `*_programa`, `*_cronograma` y
 *    `*_condiciones` que ya existen en el menu).
 * ======================================================================== */

interface MateriaKb {
  codigo: string;
  nombre: string;
}

const MATERIAS: MateriaKb[] = [
  { codigo: 'ABD', nombre: 'Administración de Bases de Datos' },
  { codigo: 'EAM', nombre: 'Elementos de Análisis Matemático' },
  { codigo: 'LC', nombre: 'Lógica Computacional' },
  { codigo: 'TP', nombre: 'Técnicas de Programación' },
];

interface TopicoDef {
  /** Sufijo de la clave de intencion: `programa_ABD`. */
  sufijo: string;
  /** Sufijo de la opcion del menu: `ABD_OP_PROG`. */
  opcion: string;
  /** Sufijo de la clave de respuesta: `ABD_programa`. */
  respuesta: string;
  name: string;
  question: string;
  /**
   * Plantillas que ya traen el nombre de la materia.
   *
   * Son las que DESAMBIGUAN la consulta larga ("cuando empiezan las clases de
   * Tecnicas de Programacion"): sin ellas, lo unico que casa es la variante
   * generica y el motor no puede distinguir el tema, asi que "cuando empiezan
   * las clases de <materia>" quedaria sin respuesta util.
   */
  conMateria: string[];
  /** Etiqueta generica compartida por las 4 materias (dispara aclaracion). */
  generica: string;
  /** Generica adicional, solo para los dias de cursada. */
  genericaExtra?: string;
  /**
   * Orden de presentacion cuando hay que pedir aclaracion entre los cuatro
   * tipos de informacion de una misma materia (programa, cronograma, dias...).
   */
  priority: number;
}

const TOPICOS: TopicoDef[] = [
  {
    sufijo: 'programa',
    opcion: 'PROG',
    respuesta: 'programa',
    name: 'Programa de {materia}',
    question: '¿Cuál es el programa de {materia}?',
    conMateria: [
      'contenidos de {materia}',
      'programa de {materia}',
      'qué incluye la materia {materia}',
    ],
    generica: 'programa',
    priority: 30,
  },
  {
    sufijo: 'cronograma',
    opcion: 'CRONO',
    respuesta: 'cronograma',
    name: 'Cronograma de {materia}',
    question: '¿Cuál es el cronograma de {materia}?',
    conMateria: [
      'fechas de entrega de {materia}',
      'cronograma de {materia}',
      'calendario de {materia}',
    ],
    generica: 'cronograma',
    priority: 20,
  },
  {
    sufijo: 'dias_cursada',
    opcion: 'DIAS',
    respuesta: 'dias_cursada',
    name: 'Días y horarios de {materia}',
    question: '¿Qué días y horarios tiene {materia}?',
    conMateria: [
      '¿Cuándo se cursa {materia}?',
      '¿cuándo empiezan las clases de {materia}?',
      'horarios de {materia}',
    ],
    generica: 'días de cursada',
    genericaExtra: '¿cuándo empiezan las clases?',
    priority: 10,
  },
  {
    sufijo: 'condiciones',
    opcion: 'COND',
    respuesta: 'condiciones',
    name: 'Condiciones de aprobación de {materia}',
    question: '¿Cuáles son las condiciones de aprobación de {materia}?',
    conMateria: [
      'cómo se aprueba {materia}',
      'condiciones de aprobación de {materia}',
      'qué hace falta para aprobar {materia}',
    ],
    generica: 'condiciones de aprobación',
    priority: 0,
  },
];

/** Umbral minimo por pregunta: por debajo, la pregunta no se considera. */
const UMBRAL_PREGUNTA = 0.7;

/* ==========================================================================
 * 3. Construccion del KB
 * ======================================================================== */

const intenciones: SeedKbIntencion[] = [];
const preguntas: SeedKbPregunta[] = [];
const variantes: SeedKbVariante[] = [];

const completar = (plantilla: string, materia: string): string =>
  plantilla.replace('{materia}', materia);

for (const a of ADMINISTRATIVAS) {
  const id = intenciones.length + 1;
  intenciones.push({
    id,
    key: a.key,
    name: a.name,
    domain: 'administrativo',
    opcion_clave: a.opcion,
    respuesta_clave: a.respuesta,
    activo: true,
  });

  const preguntaId = preguntas.length + 1;
  preguntas.push({
    id: preguntaId,
    intencion_id: id,
    question: a.question,
    respuesta_clave: a.respuesta,
    priority: 0,
    minimum_threshold: UMBRAL_PREGUNTA,
    activo: true,
  });

  // La pregunta principal es la primera variante (peso 1.0).
  const textos: Array<[string, number]> = [[a.question, 1], ...a.variantes];
  for (const [texto, peso] of textos) {
    variantes.push({
      id: variantes.length + 1,
      pregunta_id: preguntaId,
      original_text: texto,
      normalized_text: normalizar(texto),
      weight: peso,
      activo: true,
    });
  }
}

for (const t of TOPICOS) {
  for (const m of MATERIAS) {
    const id = intenciones.length + 1;
    intenciones.push({
      id,
      key: `${t.sufijo}_${m.codigo}`,
      name: completar(t.name, m.nombre),
      domain: 'academico',
      opcion_clave: `${m.codigo}_OP_${t.opcion}`,
      respuesta_clave: `${m.codigo}_${t.respuesta}`,
      activo: true,
    });

    const preguntaId = preguntas.length + 1;
    const respuestaClave = `${m.codigo}_${t.respuesta}`;
    const question = completar(t.question, m.nombre);
    preguntas.push({
      id: preguntaId,
      intencion_id: id,
      question,
      respuesta_clave: respuestaClave,
      priority: t.priority,
      minimum_threshold: UMBRAL_PREGUNTA,
      activo: true,
    });

    const textos: Array<[string, number]> = [
      [question, 1],
      ...t.conMateria.map((plantilla) => [completar(plantilla, m.nombre), 0.95] as [string, number]),
      // Solo el nombre de la materia: dispara la aclaracion entre los cuatro
      // tipos de informacion disponibles.
      [m.nombre, 0.9],
      [t.generica, 0.9],
    ];
    if (t.genericaExtra) textos.push([t.genericaExtra, 0.9]);

    for (const [texto, peso] of textos) {
      variantes.push({
        id: variantes.length + 1,
        pregunta_id: preguntaId,
        original_text: texto,
        normalized_text: normalizar(texto),
        weight: peso,
        activo: true,
      });
    }
  }
}

export const seedKb: SeedKb = { intenciones, preguntas, variantes };

/** Total de variantes indexables, util para diagnostico. */
export const TOTAL_VARIANTES_KB = variantes.length;
