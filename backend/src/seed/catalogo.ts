/**
 * Catalogo semilla en memoria.
 *
 * Espejo exacto de `db/002_seed.sql`. Se usa como fallback cuando no hay
 * `DATABASE_URL` configurado, para que el proyecto se pueda levantar y
 * demostrar (incluido el widget de Moodle) sin depender de Neon ni de Drive.
 *
 * En produccion la API lee siempre de PostgreSQL; este archivo solo cubre el
 * modo demo y las pruebas de interfaz.
 */

export type TipoOpcionDb = 'navegar' | 'responder' | 'derivar';
export type EstadoDocumento = 'borrador' | 'revision' | 'vigente' | 'reemplazado' | 'archivado';

export interface SeedCategoria {
  id: number;
  clave: string;
  nombre: string;
  mensaje: string | null;
  orden: number;
  es_raiz: boolean;
  activo: boolean;
}

export interface SeedOpcion {
  id: number;
  clave: string;
  categoria_id: number;
  etiqueta: string;
  descripcion: string | null;
  tipo: TipoOpcionDb;
  categoria_destino_id: number | null;
  respuesta_id: number | null;
  es_volver: boolean;
  icono: string | null;
  orden: number;
  activo: boolean;
}

export interface SeedRespuesta {
  id: number;
  clave: string;
  texto: string;
  orden: number;
  activo: boolean;
}

export interface SeedDocumento {
  id: number;
  clave: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  mime_type: string;
  drive_file_id: string | null;
  drive_nombre_archivo: string | null;
  drive_view_url: string | null;
  vigente: boolean;
  estado: EstadoDocumento;
  vigencia_desde: string | null;
  actualizado_en: string | null;
  sincronizado_en: string | null;
}

export interface SeedContacto {
  id: number;
  clave: string;
  nombre: string;
  area: string | null;
  email: string | null;
  url_perfil: string | null;
  motivo: string | null;
  orden: number;
  activo: boolean;
}

export interface SeedRespuestaDocumento {
  respuesta_id: number;
  documento_id: number;
  orden: number;
}

export interface SeedOpcionContacto {
  opcion_id: number;
  contacto_id: number;
  orden: number;
}

export interface SeedOpcionContexto {
  opcion_id: number;
  contexto_id: number;
  orden: number;
}

export interface SeedContexto {
  id: number;
  clave: string;
  nombre: string;
  valor: string | null;
  ambito_tipo: string | null;
  ambito_clave: string | null;
  grupo: string | null;
  orden: number;
  activo: boolean;
}

export interface SeedData {
  categorias: SeedCategoria[];
  opciones: SeedOpcion[];
  respuestas: SeedRespuesta[];
  documentos: SeedDocumento[];
  respuestaDocumento: SeedRespuestaDocumento[];
  contactos: SeedContacto[];
  opcionContacto: SeedOpcionContacto[];
  contextos: SeedContexto[];
  /** Submenús contextuales (comisión, cuatrimestre). Vacío en el MVP. */
  opcionContexto: SeedOpcionContexto[];
}

/* ==========================================================================
 * 1. Contactos (derivación asincrónica - RF04)
 * ======================================================================== */
const contactos: SeedContacto[] = [
  {
    id: 2,
    clave: 'bedelia',
    nombre: 'Bedelía IFTS N.29',
    area: 'Bedelía',
    email: 'bedelia.ifts29@bue.edu.ar',
    url_perfil: null,
    motivo: 'Inscripciones, mesas de examen, constancias, certificados y trámites administrativos.',
    orden: 2,
    activo: true,
  },
  {
    id: 3,
    clave: 'advisory_pedagogica',
    nombre: 'Asesoría Pedagógica',
    area: 'Tutorías',
    email: 'tutoria.ifts29@bue.edu.ar',
    url_perfil: null,
    motivo: 'Dudas sobre cursada en ambiente virtual y uso del campus, con el equipo docente.',
    orden: 3,
    activo: true,
  },
];

/* ==========================================================================
 * 2. Categorías (nodos del árbol)
 * ======================================================================== */
const categorias: SeedCategoria[] = [
  {
    id: 1,
    clave: 'RAIZ',
    nombre: 'Inicio',
    mensaje: '¡Hola! Soy el asistente virtual del IFTS Nº29. ¿En qué puedo ayudarte hoy?',
    orden: 0,
    es_raiz: true,
    activo: true,
  },
  {
    id: 2,
    clave: 'TRAMITES',
    nombre: 'Trámites',
    mensaje: 'Sobre qué trámite necesitás ayuda?',
    orden: 1,
    es_raiz: false,
    activo: true,
  },
  {
    id: 3,
    clave: 'ACADEMICAS',
    nombre: 'Materias',
    mensaje: '¿Sobre qué materia necesitás información?',
    orden: 4,
    es_raiz: false,
    activo: true,
  },
  {
    id: 30,
    clave: 'NORMATIVA',
    nombre: 'Normativa',
    mensaje: '¿Qué documento necesitás?',
    orden: 2,
    es_raiz: false,
    activo: true,
  },
  {
    id: 31,
    clave: 'SIUCAMPUS',
    nombre: 'SIU y campus',
    mensaje: '¿Sobre qué necesitás información?',
    orden: 3,
    es_raiz: false,
    activo: true,
  },
  {
    id: 4,
    clave: 'M_ADMIN_BASE_DATOS',
    nombre: 'Administración de Bases de Datos',
    mensaje: '¿Qué información necesitás sobre Administración de Bases de Datos?',
    orden: 10,
    es_raiz: false,
    activo: true,
  },
  {
    id: 5,
    clave: 'M_ANALISIS_MATEMATICO',
    nombre: 'Elementos de Análisis Matemático',
    mensaje: '¿Qué información necesitás sobre Elementos de Análisis Matemático?',
    orden: 11,
    es_raiz: false,
    activo: true,
  },
  {
    id: 6,
    clave: 'M_LOGICA_COMPUTACIONAL',
    nombre: 'Lógica Computacional',
    mensaje: '¿Qué información necesitás sobre Lógica Computacional?',
    orden: 12,
    es_raiz: false,
    activo: true,
  },
  {
    id: 7,
    clave: 'M_TECNICAS_PROGRAMACION',
    nombre: 'Técnicas de Programación',
    mensaje: '¿Qué información necesitás sobre Técnicas de Programación?',
    orden: 13,
    es_raiz: false,
    activo: true,
  },
];

/* ==========================================================================
 * 3. Documentos (fichas; el fileId lo completa la sincronización con Drive)
 * ======================================================================== */
interface MateriaSeed {
  codigo: string;
  /** Clave de la categoría en `categoria.clave`. */
  catClave: string;
  /** Prefijo usado en los nombres de archivo alojados en Drive. */
  prefijoArchivo: string;
  /** Nombre completo visible para el estudiante. */
  nombre: string;
}

const materias: MateriaSeed[] = [
  {
    codigo: 'ABD',
    catClave: 'M_ADMIN_BASE_DATOS',
    prefijoArchivo: 'Administracion de Base de Datos',
    nombre: 'Administración de Bases de Datos',
  },
  {
    codigo: 'EAM',
    catClave: 'M_ANALISIS_MATEMATICO',
    prefijoArchivo: 'Elementos de Analisis Matematico',
    nombre: 'Elementos de Análisis Matemático',
  },
  {
    codigo: 'LC',
    catClave: 'M_LOGICA_COMPUTACIONAL',
    prefijoArchivo: 'Logica Computacional',
    nombre: 'Lógica Computacional',
  },
  {
    codigo: 'TP',
    catClave: 'M_TECNICAS_PROGRAMACION',
    prefijoArchivo: 'Tecnicas de Programacion',
    nombre: 'Técnicas de Programación',
  },
];

const DIAS_CURSADA =
  'Comisión A: Lunes y Miércoles de 18:00 a 21:00 hs — modalidad virtual sincrónica.\n' +
  'Comisión B: Martes y Jueves de 8:00 a 11:00 hs — modalidad virtual sincrónica.\n' +
  'Comisión C: Viernes de 14:00 a 20:00 hs — modalidad virtual sincrónica.';

/** Slug de cada materia en el nombre del archivo del Drive (convención de la checklist). */
const SLUG_MATERIA: Record<string, string> = {
  ABD: 'administracion-bases-datos',
  EAM: 'elementos-analisis-matematico',
  LC: 'logica-computacional',
  TP: 'tecnicas-programacion',
};

/** Tipo de archivo en el Drive, por tipo de documento de materia. */
const ARCHIVO_TIPO: Record<string, string> = {
  PROGRAMA: 'programa',
  CRONOGRAMA: 'cronograma',
  CONDICIONES: 'condiciones',
};

const TIPOS_DOC: Array<{
  sufijo: string;
  /** Sufijo de la clave del documento. Debe coincidir con db/002_seed.sql. */
  claveDoc: string;
  /** Sufijo de la clave de la respuesta asociada. */
  claveRespuesta: string;
  tipo: SeedDocumento['tipo'];
  descripcion: string;
}> = [
  {
    sufijo: 'Programa',
    claveDoc: 'PROGRAMA',
    claveRespuesta: 'programa',
    tipo: 'programa',
    descripcion: 'Programa vigente de la materia.',
  },
  {
    sufijo: 'Cronograma',
    claveDoc: 'CRONOGRAMA',
    claveRespuesta: 'cronograma',
    tipo: 'cronograma',
    descripcion: 'Cronograma vigente del cuatrimestre.',
  },
  {
    sufijo: 'Condiciones de aprobación',
    claveDoc: 'CONDICIONES',
    claveRespuesta: 'condiciones',
    tipo: 'condiciones_aprobacion',
    descripcion: 'Condiciones oficiales de aprobación.',
  },
];

const documentos: SeedDocumento[] = [];
for (const m of materias) {
  for (const t of TIPOS_DOC) {
    const archivo = `${ARCHIVO_TIPO[t.claveDoc]}__${SLUG_MATERIA[m.codigo]}.pdf`;
    documentos.push({
      id: documentos.length + 1,
      clave: `DOC_${m.codigo}_${t.claveDoc}`,
      nombre: `${t.sufijo} – ${m.nombre}`,
      descripcion: t.descripcion,
      tipo: t.tipo,
      mime_type: 'application/pdf',
      drive_file_id: null,
      drive_nombre_archivo: archivo,
      drive_view_url: null,
      vigente: true,
      estado: 'vigente',
      vigencia_desde: null,
      actualizado_en: null,
      sincronizado_en: null,
    });
  }
}

/** Documentos generales (normativa, trámites, campus). Espejo de db/002_seed.sql. */
const docGeneral = (
  clave: string,
  nombre: string,
  descripcion: string,
  tipo: string,
  archivo: string,
): SeedDocumento => ({
  id: documentos.length + 1,
  clave,
  nombre,
  descripcion,
  tipo,
  mime_type: 'application/pdf',
  drive_file_id: null,
  drive_nombre_archivo: archivo,
  drive_view_url: null,
  vigente: true,
  estado: 'vigente',
  vigencia_desde: null,
  actualizado_en: null,
  sincronizado_en: null,
});

documentos.push(
  docGeneral('DOC_GEN_PLAN_ESTUDIOS', 'Plan de estudios', 'Plan de estudios de la carrera.', 'documento', 'plan-estudios__general.pdf'),
  docGeneral('DOC_GEN_CORRELATIVIDADES', 'Correlatividades', 'Régimen de correlatividades de la carrera.', 'documento', 'correlatividades__general.pdf'),
  docGeneral('DOC_GEN_CARGA_HORARIA', 'Carga horaria', 'Carga horaria de la carrera.', 'documento', 'carga-horaria__general.pdf'),
  docGeneral('DOC_GEN_HORARIOS', 'Horarios por comisión', 'Grilla de horarios y comisiones del cuatrimestre.', 'documento', 'horarios__general.pdf'),
  docGeneral('DOC_GEN_ENTREGA_DOCUMENTACION', 'Entrega de documentación', 'Cómo y dónde entregar la documentación.', 'documento', 'entrega-documentacion__general.pdf'),
  docGeneral('DOC_GEN_EQUIVALENCIAS', 'Equivalencias', 'Normativa de equivalencias del IFTS N.º 29.', 'documento', 'equivalencias__general.pdf'),
  docGeneral('DOC_GEN_GUIA_FOROS', 'Guía para la participación en foros', 'Guía para participar en los foros del campus.', 'documento', 'guia-foros__general.pdf'),
  docGeneral('DOC_GEN_INSTRUCTIVO_MENSAJERIA', 'Uso de mensajería interna', 'Instructivo de la mensajería interna del campus.', 'instructivo', 'instructivo-mensajeria__general.pdf'),
  docGeneral('DOC_GEN_PROTOCOLO_EXAMENES', 'Protocolo de seguridad en exámenes', 'Protocolo de seguridad para los exámenes del IFTS N.º 29.', 'documento', 'protocolo-examenes__general.pdf'),
  docGeneral('DOC_GEN_REGLAMENTO', 'Síntesis del reglamento orgánico', 'Síntesis del reglamento orgánico del IFTS N.º 29.', 'documento', 'reglamento__general.pdf'),
);

/* ==========================================================================
 * 4. Respuestas
 * ======================================================================== */
const respuestas: SeedRespuesta[] = [
  {
    id: 1,
    clave: 'ADM_INSCRIPCION_MATERIAS',
    texto:
      'Podés inscribirte a materias desde el SIU Guaraní: https://guarani-autogestionagencia.bue.edu.ar/cursada. Ingresá con tu usuario y contraseña y elegí las comisiones disponibles. Si tenés dudas, escribí a bedelia.ifts29@bue.edu.ar.',
    orden: 1,
    activo: true,
  },
  {
    id: 2,
    clave: 'ADM_EXAMENES_MESAS',
    texto:
      'Podés inscribirte a mesas de examen desde el SIU Guaraní: https://guarani-autogestionagencia.bue.edu.ar/examen. Ingresá con tu usuario y contraseña y elegí la materia y la mesa. Si tenés dudas, escribí a bedelia.ifts29@bue.edu.ar.',
    orden: 2,
    activo: true,
  },
  {
    id: 3,
    clave: 'ADM_ACCESO_SIU',
    texto:
      'Para acceder al SIU Guaraní visitá https://guarani-autogestionagencia.bue.edu.ar/acceso. Tu usuario es tu número de legajo y la contraseña inicial es tu DNI. Si tenés problemas de acceso, contactá a Bedelía a través de bedelia.ifts29@bue.edu.ar.',
    orden: 3,
    activo: true,
  },
  {
    id: 4,
    clave: 'ADM_SIU_VS_CAMPUS',
    texto:
      'El Campus Virtual (https://aulasvirtuales.bue.edu.ar/) es el entorno de cursada: ahí encontrás los materiales, los foros y las entregas de trabajos prácticos. El SIU Guaraní (https://guarani-autogestionagencia.bue.edu.ar/acceso) es el sistema administrativo: ahí te inscribís a materias y exámenes y consultás tu historial académico. Usá el campus para estudiar y el SIU para tus trámites académicos.',
    orden: 4,
    activo: true,
  },
  {
    id: 6,
    clave: 'ADM_CERTIFICADO_EXAMEN',
    texto:
      'Para solicitar un certificado de examen, completá este formulario: https://docs.google.com/forms/d/e/1FAIpQLSecd-D9-fBf5j_dSMIV_qOWBKmhnSQAiES6dfQLBauPca4pfA/viewform. Si tenés dudas, escribí a bedelia.ifts29@bue.edu.ar.',
    orden: 5,
    activo: true,
  },
  {
    id: 7,
    clave: 'TRAM_ENTREGA_DOCUMENTACION',
    texto: 'Te dejamos el documento con la entrega de documentación. Si tenés dudas, escribí a bedelia.ifts29@bue.edu.ar.',
    orden: 6,
    activo: true,
  },
  {
    id: 8,
    clave: 'TRAM_EQUIVALENCIAS',
    texto: 'Te dejamos la normativa de equivalencias del IFTS N.º 29. Si tenés dudas, escribí a bedelia.ifts29@bue.edu.ar.',
    orden: 7,
    activo: true,
  },
  {
    id: 9,
    clave: 'NORM_PLAN_ESTUDIOS',
    texto: 'Te dejamos el plan de estudios de la carrera.',
    orden: 8,
    activo: true,
  },
  {
    id: 10,
    clave: 'NORM_CORRELATIVIDADES',
    texto: 'Te dejamos el régimen de correlatividades de la carrera.',
    orden: 9,
    activo: true,
  },
  {
    id: 11,
    clave: 'NORM_CARGA_HORARIA',
    texto: 'Te dejamos la carga horaria de la carrera.',
    orden: 10,
    activo: true,
  },
  {
    id: 12,
    clave: 'NORM_REGLAMENTO',
    texto: 'Te dejamos la síntesis del reglamento orgánico y el protocolo de seguridad en exámenes.',
    orden: 11,
    activo: true,
  },
  {
    id: 13,
    clave: 'SIUC_ACCESO_CAMPUS',
    texto: 'Para ingresar al campus virtual, entrá a https://aulasvirtuales.bue.edu.ar/. Si tenés problemas para acceder, escribí a Asesoría Pedagógica: tutoria.ifts29@bue.edu.ar.',
    orden: 12,
    activo: true,
  },
  {
    id: 14,
    clave: 'SIUC_FOROS_MENSAJERIA',
    texto: 'Te dejamos la guía para participar en los foros y el instructivo de mensajería interna del campus.',
    orden: 13,
    activo: true,
  },
  {
    id: 5,
    clave: 'DERIVACION_GENERAL',
    texto:
      'Si no encontraste lo que buscabas, podés escribir a alguna de estas personas o áreas:',
    orden: 90,
    activo: true,
  },
];

// Respuestas por materia (una por materia, para que el mantenimiento sea granular).
let respuestaSeq = respuestas.length;
const claveRespuesta = (m: MateriaSeed, sufijo: string): string => `${m.codigo}_${sufijo}`;

for (const m of materias) {
  respuestas.push({
    id: ++respuestaSeq,
    clave: claveRespuesta(m, 'dias_cursada'),
    texto: DIAS_CURSADA,
    orden: 1,
    activo: true,
  });
  respuestas.push({
    id: ++respuestaSeq,
    clave: claveRespuesta(m, 'condiciones'),
    texto: `Estas son las condiciones oficiales de aprobación de ${m.nombre}. Leé el documento vigente y, si tenés una duda puntual, escribí a tu tutora académica.`,
    orden: 2,
    activo: true,
  });
  respuestas.push({
    id: ++respuestaSeq,
    clave: claveRespuesta(m, 'programa'),
    texto: `Este es el programa vigente de ${m.nombre}, con contenidos, bibliografía y criterios de evaluación.`,
    orden: 3,
    activo: true,
  });
  respuestas.push({
    id: ++respuestaSeq,
    clave: claveRespuesta(m, 'cronograma'),
    texto: `Este es el cronograma vigente de ${m.nombre}, con las fechas de entrega de los trabajos prácticos.`,
    orden: 4,
    activo: true,
  });
}

/* ==========================================================================
 * 5. Respuesta <-> Documento
 * ======================================================================== */
const respuestaDocumento: SeedRespuestaDocumento[] = [];
for (const m of materias) {
  TIPOS_DOC.forEach((t, i) => {
    const claveDoc = `DOC_${m.codigo}_${t.claveDoc}`;
    const claveRsp = claveRespuesta(m, t.claveRespuesta);
    const doc = documentos.find((d) => d.clave === claveDoc);
    const resp = respuestas.find((r) => r.clave === claveRsp);
    if (!doc || !resp) {
      throw new Error(`Seed inconsistente: falta documento o respuesta para ${claveDoc} / ${claveRsp}`);
    }
    respuestaDocumento.push({ respuesta_id: resp.id, documento_id: doc.id, orden: i + 1 });
  });
}

const vinculosGenerales: Array<[string, string, number]> = [
  ['TRAM_ENTREGA_DOCUMENTACION', 'DOC_GEN_ENTREGA_DOCUMENTACION', 1],
  ['TRAM_EQUIVALENCIAS', 'DOC_GEN_EQUIVALENCIAS', 1],
  ['NORM_PLAN_ESTUDIOS', 'DOC_GEN_PLAN_ESTUDIOS', 1],
  ['NORM_CORRELATIVIDADES', 'DOC_GEN_CORRELATIVIDADES', 1],
  ['NORM_CARGA_HORARIA', 'DOC_GEN_CARGA_HORARIA', 1],
  ['NORM_REGLAMENTO', 'DOC_GEN_REGLAMENTO', 1],
  ['NORM_REGLAMENTO', 'DOC_GEN_PROTOCOLO_EXAMENES', 2],
  ['SIUC_FOROS_MENSAJERIA', 'DOC_GEN_GUIA_FOROS', 1],
  ['SIUC_FOROS_MENSAJERIA', 'DOC_GEN_INSTRUCTIVO_MENSAJERIA', 2],
];
for (const [respClave, docClave, orden] of vinculosGenerales) {
  const resp = respuestas.find((r) => r.clave === respClave);
  const doc = documentos.find((d) => d.clave === docClave);
  if (!resp || !doc) {
    throw new Error(`Seed inconsistente: falta documento o respuesta para ${docClave} / ${respClave}`);
  }
  respuestaDocumento.push({ respuesta_id: resp.id, documento_id: doc.id, orden });
}

/* ==========================================================================
 * 6. Opciones del menú
 * ======================================================================== */
interface OpcionSeedDef {
  clave: string;
  cat: string;
  etiqueta: string;
  tipo: TipoOpcionDb;
  destino?: string;
  resp?: string;
  volver?: boolean;
  orden: number;
}

const definiciones: OpcionSeedDef[] = [
  // --- RAIZ
  { clave: 'RAIZ_OP_ACAD', cat: 'RAIZ', etiqueta: 'Materias', tipo: 'navegar', destino: 'ACADEMICAS', orden: 1 },
  { clave: 'RAIZ_OP_SIUC', cat: 'RAIZ', etiqueta: 'SIU y campus', tipo: 'navegar', destino: 'SIUCAMPUS', orden: 2 },
  { clave: 'RAIZ_OP_TRAM', cat: 'RAIZ', etiqueta: 'Trámites', tipo: 'navegar', destino: 'TRAMITES', orden: 3 },
  { clave: 'RAIZ_OP_NORM', cat: 'RAIZ', etiqueta: 'Normativa', tipo: 'navegar', destino: 'NORMATIVA', orden: 4 },
  { clave: 'RAIZ_OP_NOENCONTRE', cat: 'RAIZ', etiqueta: 'No encontre lo que busco', tipo: 'derivar', resp: 'DERIVACION_GENERAL', orden: 5 },

  // --- TRAMITES
  { clave: 'ADM_OP_VOLVER', cat: 'TRAMITES', etiqueta: '< Volver al menu anterior', tipo: 'navegar', destino: 'RAIZ', volver: true, orden: 1 },
  { clave: 'ADM_OP_INSCRIPCION_MATERIAS', cat: 'TRAMITES', etiqueta: 'Inscripción a materias', tipo: 'responder', resp: 'ADM_INSCRIPCION_MATERIAS', orden: 2 },
  { clave: 'ADM_OP_EXAMENES', cat: 'TRAMITES', etiqueta: 'Inscripción a exámenes', tipo: 'responder', resp: 'ADM_EXAMENES_MESAS', orden: 3 },
  { clave: 'ADM_OP_CERTIFICADO_EXAMEN', cat: 'TRAMITES', etiqueta: 'Certificado de examen', tipo: 'responder', resp: 'ADM_CERTIFICADO_EXAMEN', orden: 4 },
  { clave: 'TRAM_OP_ENTREGA', cat: 'TRAMITES', etiqueta: 'Entrega de documentación', tipo: 'responder', resp: 'TRAM_ENTREGA_DOCUMENTACION', orden: 5 },
  { clave: 'TRAM_OP_EQUIV', cat: 'TRAMITES', etiqueta: 'Equivalencias', tipo: 'responder', resp: 'TRAM_EQUIVALENCIAS', orden: 6 },

  // --- NORMATIVA
  { clave: 'NORM_OP_VOLVER', cat: 'NORMATIVA', etiqueta: '< Volver al menu anterior', tipo: 'navegar', destino: 'RAIZ', volver: true, orden: 1 },
  { clave: 'NORM_OP_PLAN', cat: 'NORMATIVA', etiqueta: 'Plan de estudios', tipo: 'responder', resp: 'NORM_PLAN_ESTUDIOS', orden: 2 },
  { clave: 'NORM_OP_CORR', cat: 'NORMATIVA', etiqueta: 'Correlatividades', tipo: 'responder', resp: 'NORM_CORRELATIVIDADES', orden: 3 },
  { clave: 'NORM_OP_CARGA', cat: 'NORMATIVA', etiqueta: 'Carga horaria', tipo: 'responder', resp: 'NORM_CARGA_HORARIA', orden: 4 },
  { clave: 'NORM_OP_REGL', cat: 'NORMATIVA', etiqueta: 'Reglamento y protocolos', tipo: 'responder', resp: 'NORM_REGLAMENTO', orden: 5 },

  // --- SIU Y CAMPUS
  { clave: 'SIUC_OP_VOLVER', cat: 'SIUCAMPUS', etiqueta: '< Volver al menu anterior', tipo: 'navegar', destino: 'RAIZ', volver: true, orden: 1 },
  { clave: 'ADM_OP_SIU', cat: 'SIUCAMPUS', etiqueta: 'Acceso al SIU', tipo: 'responder', resp: 'ADM_ACCESO_SIU', orden: 2 },
  { clave: 'ADM_OP_SIU_CAMPUS', cat: 'SIUCAMPUS', etiqueta: 'Diferencias entre campus virtual y SIU', tipo: 'responder', resp: 'ADM_SIU_VS_CAMPUS', orden: 3 },
  { clave: 'SIUC_OP_CAMPUS', cat: 'SIUCAMPUS', etiqueta: 'Acceso al campus virtual', tipo: 'responder', resp: 'SIUC_ACCESO_CAMPUS', orden: 4 },
  { clave: 'SIUC_OP_FOROS', cat: 'SIUCAMPUS', etiqueta: 'Foros y mensajería', tipo: 'responder', resp: 'SIUC_FOROS_MENSAJERIA', orden: 5 },

  // --- ACADEMICAS
  { clave: 'ACA_OP_VOLVER', cat: 'ACADEMICAS', etiqueta: '< Volver al menu anterior', tipo: 'navegar', destino: 'RAIZ', volver: true, orden: 1 },
  { clave: 'ACA_OP_ABD', cat: 'ACADEMICAS', etiqueta: 'Administracion de Base de Datos', tipo: 'navegar', destino: 'M_ADMIN_BASE_DATOS', orden: 2 },
  { clave: 'ACA_OP_EAM', cat: 'ACADEMICAS', etiqueta: 'Analisis Matematico', tipo: 'navegar', destino: 'M_ANALISIS_MATEMATICO', orden: 3 },
  { clave: 'ACA_OP_LC', cat: 'ACADEMICAS', etiqueta: 'Logica Computacional', tipo: 'navegar', destino: 'M_LOGICA_COMPUTACIONAL', orden: 4 },
  { clave: 'ACA_OP_TP', cat: 'ACADEMICAS', etiqueta: 'Tecnicas de Programacion', tipo: 'navegar', destino: 'M_TECNICAS_PROGRAMACION', orden: 5 },
];

// Submenú idéntico para las 4 materias (misma lógica, RF02).
for (const m of materias) {
  definiciones.push(
    { clave: `${m.codigo}_OP_VOLVER`, cat: m.catClave, etiqueta: '< Volver al menu anterior', tipo: 'navegar', destino: 'ACADEMICAS', volver: true, orden: 1 },
    { clave: `${m.codigo}_OP_DIAS`, cat: m.catClave, etiqueta: 'Dias de cursada por comision', tipo: 'responder', resp: claveRespuesta(m, 'dias_cursada'), orden: 2 },
    { clave: `${m.codigo}_OP_COND`, cat: m.catClave, etiqueta: 'Condiciones de aprobacion', tipo: 'responder', resp: claveRespuesta(m, 'condiciones'), orden: 3 },
    { clave: `${m.codigo}_OP_PROG`, cat: m.catClave, etiqueta: 'Programa', tipo: 'responder', resp: claveRespuesta(m, 'programa'), orden: 4 },
    { clave: `${m.codigo}_OP_CRONO`, cat: m.catClave, etiqueta: 'Cronograma', tipo: 'responder', resp: claveRespuesta(m, 'cronograma'), orden: 5 },
  );
}

const opciones: SeedOpcion[] = definiciones.map((d, i) => ({
  id: i + 1,
  clave: d.clave,
  categoria_id: categorias.find((c) => c.clave === d.cat)!.id,
  etiqueta: d.etiqueta,
  descripcion: null,
  tipo: d.tipo,
  categoria_destino_id: d.destino ? categorias.find((c) => c.clave === d.destino)!.id : null,
  respuesta_id: d.resp ? respuestas.find((r) => r.clave === d.resp)!.id : null,
  es_volver: d.volver ?? false,
  icono: null,
  orden: d.orden,
  activo: true,
}));

/* ==========================================================================
 * 7. Contactos por opción (derivación)
 * ======================================================================== */
const noEncontradoOpcion = opciones.find((o) => o.clave === 'RAIZ_OP_NOENCONTRE')!;
const opcionContacto: SeedOpcionContacto[] = contactos.map((c, i) => ({
  opcion_id: noEncontradoOpcion.id,
  contacto_id: c.id,
  orden: c.orden ?? i + 1,
}));

/* ==========================================================================
 * 8. Contextos (datos institucionales y por comisión - RF06)
 * ======================================================================== */
const contextos: SeedContexto[] = [
  { id: 1, clave: 'url_campus_virtual', nombre: 'Campus Virtual', valor: 'https://aulasvirtuales.bue.edu.ar/', ambito_tipo: null, ambito_clave: null, grupo: 'institucional', orden: 1, activo: true },
  { id: 2, clave: 'url_siu', nombre: 'SIU Guaraní', valor: 'https://guarani-autogestionagencia.bue.edu.ar/acceso', ambito_tipo: null, ambito_clave: null, grupo: 'institucional', orden: 2, activo: true },
  { id: 3, clave: 'email_bedelia', nombre: 'Bedelía', valor: 'bedelia.ifts29@bue.edu.ar', ambito_tipo: null, ambito_clave: null, grupo: 'institucional', orden: 3, activo: true },
  { id: 4, clave: 'periodo_academico_vigente', nombre: 'Período vigente', valor: '2C 2026', ambito_tipo: null, ambito_clave: null, grupo: 'institucional', orden: 4, activo: true },
  { id: 5, clave: 'modalidad', nombre: 'Modalidad', valor: 'Virtual sincrónica', ambito_tipo: null, ambito_clave: null, grupo: 'institucional', orden: 5, activo: true },
  { id: 6, clave: 'dias_cursada', nombre: 'Comisión A', valor: 'Lunes y Miércoles de 18:00 a 21:00 hs', ambito_tipo: 'comision', ambito_clave: 'comision_a', grupo: 'dias_cursada', orden: 1, activo: true },
  { id: 7, clave: 'dias_cursada', nombre: 'Comisión B', valor: 'Martes y Jueves de 8:00 a 11:00 hs', ambito_tipo: 'comision', ambito_clave: 'comision_b', grupo: 'dias_cursada', orden: 2, activo: true },
  { id: 8, clave: 'dias_cursada', nombre: 'Comisión C', valor: 'Viernes de 14:00 a 20:00 hs', ambito_tipo: 'comision', ambito_clave: 'comision_c', grupo: 'dias_cursada', orden: 3, activo: true },
];

export const seedData: SeedData = {
  categorias,
  opciones,
  respuestas,
  documentos,
  respuestaDocumento,
  contactos,
  opcionContacto,
  contextos,
  opcionContexto: [],
};

/** Categoría raíz del árbol de menú. */
export const SEED_CATEGORIA_RAIZ = 'RAIZ';
