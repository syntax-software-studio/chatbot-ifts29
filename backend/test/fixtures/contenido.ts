/**
 * Contenido de prueba: un conjunto chico y explícito, con la misma forma que la
 * planilla de contenido. Lo carga `prepararBasePrueba()` en la base de prueba.
 *
 * No es el contenido real del IFTS: sirve para verificar el comportamiento del
 * sistema (menú, texto libre, aclaración, derivación) sin depender de Drive ni
 * de la planilla.
 */

import type { Fila, Pestana } from '../../src/lib/planilla.js';

export const contenidoPrueba: Partial<Record<Pestana, Fila[]>> = {
  categorias: [
    { clave: 'RAIZ', nombre: 'Inicio', mensaje: '¡Hola! ¿En qué puedo ayudarte?', orden: '0', es_raiz: 'TRUE' },
    { clave: 'ACAD', nombre: 'Materias', mensaje: '¿Sobre qué materia necesitás información?', orden: '1', es_raiz: 'FALSE' },
    { clave: 'ABD', nombre: 'Administración de Bases de Datos', mensaje: '¿Qué información necesitás?', orden: '1', es_raiz: 'FALSE' },
    { clave: 'DERIVACION', nombre: 'No encontré lo que busco', mensaje: '¿Sobre qué necesitás ayuda?', orden: '2', es_raiz: 'FALSE' },
    { clave: 'SIUC', nombre: 'SIU y campus', mensaje: '¿Qué necesitás del SIU o del campus?', orden: '3', es_raiz: 'FALSE' },
    { clave: 'NORM', nombre: 'Normativa', mensaje: '¿Qué normativa buscás?', orden: '4', es_raiz: 'FALSE' },
    { clave: 'TRAM', nombre: 'Trámites', mensaje: '¿Qué trámite necesitás?', orden: '5', es_raiz: 'FALSE' },
  ],
  opciones: [
    { clave: 'RAIZ_OP_ACAD', categoria: 'RAIZ', etiqueta: 'Materias', tipo: 'navegar', destino: 'ACAD', respuesta: '', orden: '1', es_volver: 'FALSE' },
    { clave: 'RAIZ_OP_NOENCONTRE', categoria: 'RAIZ', etiqueta: 'No encontré lo que busco', tipo: 'navegar', destino: 'DERIVACION', respuesta: '', orden: '2', es_volver: 'FALSE' },
    { clave: 'ACAD_OP_ABD', categoria: 'ACAD', etiqueta: 'Administración de Bases de Datos', tipo: 'navegar', destino: 'ABD', respuesta: '', orden: '1', es_volver: 'FALSE' },
    { clave: 'ABD_OP_PROG', categoria: 'ABD', etiqueta: 'Programa', tipo: 'responder', destino: '', respuesta: 'ABD_programa', orden: '1', es_volver: 'FALSE' },
    { clave: 'ABD_OP_COND', categoria: 'ABD', etiqueta: 'Condiciones de aprobación', tipo: 'responder', destino: '', respuesta: 'ABD_condiciones', orden: '2', es_volver: 'FALSE' },
    { clave: 'ABD_OP_VOLVER', categoria: 'ABD', etiqueta: '< Volver al menú anterior', tipo: 'navegar', destino: 'ACAD', respuesta: '', orden: '3', es_volver: 'TRUE' },
    { clave: 'DERIVACION_OP_TRAMITES', categoria: 'DERIVACION', etiqueta: 'Trámites, certificados, etc.', tipo: 'derivar', destino: '', respuesta: 'DERIVACION_GENERAL', orden: '1', es_volver: 'FALSE' },
    { clave: 'DERIVACION_OP_VOLVER', categoria: 'DERIVACION', etiqueta: '< Volver al menú anterior', tipo: 'navegar', destino: 'RAIZ', respuesta: '', orden: '2', es_volver: 'TRUE' },
    { clave: 'SIUC_OP_FOROS', categoria: 'SIUC', etiqueta: 'Foros y mensajería', tipo: 'responder', destino: '', respuesta: 'SIUC_foros', orden: '1', es_volver: 'FALSE' },
    { clave: 'NORM_OP_REGL', categoria: 'NORM', etiqueta: 'Reglamento y protocolos', tipo: 'responder', destino: '', respuesta: 'NORM_reglamento', orden: '1', es_volver: 'FALSE' },
    { clave: 'TRAM_OP_ENTREGA', categoria: 'TRAM', etiqueta: 'Entrega de documentación', tipo: 'responder', destino: '', respuesta: 'TRAM_entrega', orden: '1', es_volver: 'FALSE' },
  ],
  respuestas: [
    { clave: 'ABD_programa', texto: 'Este es el programa de Administración de Bases de Datos.', orden: '1' },
    { clave: 'ABD_condiciones', texto: 'Estas son las condiciones de aprobación de Administración de Bases de Datos.', orden: '2' },
    { clave: 'DERIVACION_GENERAL', texto: 'Podés escribirle a esta persona o área:', orden: '3' },
    { clave: 'SIUC_foros', texto: 'Te dejamos la guía para participar en los foros.', orden: '4' },
    { clave: 'NORM_reglamento', texto: 'Te dejamos la síntesis del reglamento orgánico.', orden: '5' },
    { clave: 'TRAM_entrega', texto: 'Te dejamos el documento con la entrega de documentación.', orden: '6' },
  ],
  respuesta_documentos: [
    { respuesta: 'ABD_programa', documento: 'ABD_programa_2026_1C', orden: '1' },
    { respuesta: 'ABD_condiciones', documento: 'ABD_condiciones_A_2026_1C', orden: '1' },
    { respuesta: 'ABD_condiciones', documento: 'ABD_condiciones_B_2026_1C', orden: '2' },
  ],
  intenciones: [
    { clave: 'programa_ABD', nombre: 'Programa de ABD', dominio: 'academico', opcion: 'ABD_OP_PROG' },
    { clave: 'condiciones_ABD', nombre: 'Condiciones de ABD', dominio: 'academico', opcion: 'ABD_OP_COND' },
    { clave: 'foros_mensajeria', nombre: 'Foros y mensajería', dominio: 'administrativo', opcion: 'SIUC_OP_FOROS' },
    { clave: 'reglamento_institucional', nombre: 'Reglamento y protocolos', dominio: 'administrativo', opcion: 'NORM_OP_REGL' },
    { clave: 'entrega_documentacion', nombre: 'Entrega de documentación', dominio: 'administrativo', opcion: 'TRAM_OP_ENTREGA' },
  ],
  preguntas: [
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', prioridad: '30', umbral: '0,7' },
    { intencion: 'programa_ABD', pregunta: 'Programa de ABD', prioridad: '10', umbral: '0,7' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', prioridad: '20', umbral: '0,7' },
    { intencion: 'foros_mensajeria', pregunta: '¿Cómo participo en los foros?', prioridad: '10', umbral: '0,7' },
    { intencion: 'reglamento_institucional', pregunta: '¿Dónde encuentro el reglamento?', prioridad: '10', umbral: '0,7' },
    { intencion: 'entrega_documentacion', pregunta: '¿Cómo entrego la documentación?', prioridad: '10', umbral: '0,7' },
  ],
  variantes: [
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', texto: 'programa de abd', peso: '1' },
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', texto: 'contenidos de abd', peso: '0,95' },
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', texto: 'abd', peso: '0,9' },
    { intencion: 'programa_ABD', pregunta: 'Programa de ABD', texto: 'programa', peso: '0,9' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto: 'condiciones de aprobacion de abd', peso: '1' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto: 'como se aprueba abd', peso: '0,95' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto: 'que hace falta para aprobar abd', peso: '0,95' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto: 'abd', peso: '0,9' },
    { intencion: 'foros_mensajeria', pregunta: '¿Cómo participo en los foros?', texto: 'foro', peso: '1' },
    { intencion: 'foros_mensajeria', pregunta: '¿Cómo participo en los foros?', texto: 'foros', peso: '1' },
    { intencion: 'foros_mensajeria', pregunta: '¿Cómo participo en los foros?', texto: 'como participo en un foro', peso: '1' },
    { intencion: 'reglamento_institucional', pregunta: '¿Dónde encuentro el reglamento?', texto: 'reglamento', peso: '1' },
    { intencion: 'reglamento_institucional', pregunta: '¿Dónde encuentro el reglamento?', texto: 'reglamento organico', peso: '1' },
    { intencion: 'entrega_documentacion', pregunta: '¿Cómo entrego la documentación?', texto: 'entrega de documentacion', peso: '1' },
    { intencion: 'entrega_documentacion', pregunta: '¿Cómo entrego la documentación?', texto: 'entregar documentacion', peso: '1' },
  ],
  ignorados: [
    'como', 'cuando', 'donde', 'cual', 'cuales', 'para', 'necesito', 'quiero',
    'puedo', 'hay', 'tiene', 'tengo', 'sobre', 'informacion', 'una', 'uno',
  ].map((termino) => ({ termino })),
  contactos: [
    {
      clave: 'bedelia',
      nombre: 'Bedelía',
      area: 'Bedelía',
      comision: 'General',
      email: 'bedelia@ejemplo.edu.ar',
      perfil: '',
      motivo: 'Trámites, certificados, etc.',
      orden: '1',
      opcion: 'DERIVACION_OP_TRAMITES',
    },
  ],
};
