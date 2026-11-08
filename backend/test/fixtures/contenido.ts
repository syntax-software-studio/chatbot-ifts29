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
    { clave: 'INICIO', nombre: 'Inicio', mensaje: '¡Hola! ¿En qué puedo ayudarte?', orden: '0', es_raiz: 'TRUE' },
    { clave: 'ACAD', nombre: 'Materias', mensaje: '¿Sobre qué materia necesitás información?', orden: '1', es_raiz: 'FALSE' },
    { clave: 'ABD', nombre: 'Administración de Bases de Datos', mensaje: '¿Qué información necesitás?', orden: '1', es_raiz: 'FALSE' },
    { clave: 'DERIVACION', nombre: 'No encontré lo que busco', mensaje: '¿Sobre qué necesitás ayuda?', orden: '2', es_raiz: 'FALSE' },
    { clave: 'SIUC', nombre: 'SIU y campus', mensaje: '¿Qué necesitás del SIU o del campus?', orden: '3', es_raiz: 'FALSE' },
    { clave: 'NORM', nombre: 'Normativa', mensaje: '¿Qué normativa buscás?', orden: '4', es_raiz: 'FALSE' },
    { clave: 'TRAM', nombre: 'Trámites', mensaje: '¿Qué trámite necesitás?', orden: '5', es_raiz: 'FALSE' },
  ],
  opciones: [
    { clave: 'INICIO_OP_ACAD', categoria: 'INICIO', etiqueta: 'Materias', tipo: 'navegar', destino: 'ACAD', respuesta: '', orden: '1', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'INICIO_OP_NOENCONTRE', categoria: 'INICIO', etiqueta: 'No encontré lo que busco', tipo: 'navegar', destino: 'DERIVACION', respuesta: '', orden: '2', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'ACAD_OP_ABD', categoria: 'ACAD', etiqueta: 'Administración de Bases de Datos', tipo: 'navegar', destino: 'ABD', respuesta: '', orden: '1', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'ABD_OP_PROG', categoria: 'ABD', etiqueta: 'Programa', tipo: 'responder', destino: '', respuesta: 'ABD_programa', orden: '1', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'ABD_OP_COND', categoria: 'ABD', etiqueta: 'Condiciones de aprobación', tipo: 'responder', destino: '', respuesta: 'ABD_condiciones', orden: '2', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'ABD_OP_VOLVER', categoria: 'ABD', etiqueta: '< Volver al menú anterior', tipo: 'navegar', destino: 'ACAD', respuesta: '', orden: '3', es_volver: 'TRUE', en_menu: 'TRUE' },
    { clave: 'DERIVACION_OP_TRAMITES', categoria: 'DERIVACION', etiqueta: 'Trámites, certificados, etc.', tipo: 'derivar', destino: '', respuesta: 'DERIVACION_GENERAL', orden: '1', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'DERIVACION_OP_VOLVER', categoria: 'DERIVACION', etiqueta: '< Volver al menú anterior', tipo: 'navegar', destino: 'INICIO', respuesta: '', orden: '2', es_volver: 'TRUE', en_menu: 'TRUE' },
    { clave: 'SIUC_OP_FOROS', categoria: 'SIUC', etiqueta: 'Foros y mensajería', tipo: 'responder', destino: '', respuesta: 'SIUC_foros', orden: '1', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'NORM_OP_REGL', categoria: 'NORM', etiqueta: 'Reglamento y protocolos', tipo: 'responder', destino: '', respuesta: 'NORM_reglamento', orden: '1', es_volver: 'FALSE', en_menu: 'TRUE' },
    { clave: 'TRAM_OP_ENTREGA', categoria: 'TRAM', etiqueta: 'Entrega de documentación', tipo: 'responder', destino: '', respuesta: 'TRAM_entrega', orden: '1', es_volver: 'FALSE', en_menu: 'TRUE' },
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
  preguntas: [
    { opcion: 'ABD_OP_PROG', pregunta: '¿Cuál es el programa de ABD?', prioridad: '30', umbral_minimo: '0,7' },
    { opcion: 'ABD_OP_PROG', pregunta: 'Programa de ABD', prioridad: '10', umbral_minimo: '0,7' },
    { opcion: 'ABD_OP_COND', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', prioridad: '20', umbral_minimo: '0,7' },
    { opcion: 'SIUC_OP_FOROS', pregunta: '¿Cómo participo en los foros?', prioridad: '10', umbral_minimo: '0,7' },
    { opcion: 'NORM_OP_REGL', pregunta: '¿Dónde encuentro el reglamento?', prioridad: '10', umbral_minimo: '0,7' },
    { opcion: 'TRAM_OP_ENTREGA', pregunta: '¿Cómo entrego la documentación?', prioridad: '10', umbral_minimo: '0,7' },
  ],
  variantes: [
    { opcion: 'ABD_OP_PROG', pregunta: '¿Cuál es el programa de ABD?', texto_original: 'programa de abd', peso: '1' },
    { opcion: 'ABD_OP_PROG', pregunta: '¿Cuál es el programa de ABD?', texto_original: 'contenidos de abd', peso: '0,95' },
    { opcion: 'ABD_OP_PROG', pregunta: '¿Cuál es el programa de ABD?', texto_original: 'abd', peso: '0,9' },
    { opcion: 'ABD_OP_PROG', pregunta: 'Programa de ABD', texto_original: 'programa', peso: '0,9' },
    { opcion: 'ABD_OP_COND', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto_original: 'condiciones de aprobacion de abd', peso: '1' },
    { opcion: 'ABD_OP_COND', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto_original: 'como se aprueba abd', peso: '0,95' },
    { opcion: 'ABD_OP_COND', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto_original: 'que hace falta para aprobar abd', peso: '0,95' },
    { opcion: 'ABD_OP_COND', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto_original: 'abd', peso: '0,9' },
    { opcion: 'SIUC_OP_FOROS', pregunta: '¿Cómo participo en los foros?', texto_original: 'foro', peso: '1' },
    { opcion: 'SIUC_OP_FOROS', pregunta: '¿Cómo participo en los foros?', texto_original: 'foros', peso: '1' },
    { opcion: 'SIUC_OP_FOROS', pregunta: '¿Cómo participo en los foros?', texto_original: 'como participo en un foro', peso: '1' },
    { opcion: 'NORM_OP_REGL', pregunta: '¿Dónde encuentro el reglamento?', texto_original: 'reglamento', peso: '1' },
    { opcion: 'NORM_OP_REGL', pregunta: '¿Dónde encuentro el reglamento?', texto_original: 'reglamento organico', peso: '1' },
    { opcion: 'TRAM_OP_ENTREGA', pregunta: '¿Cómo entrego la documentación?', texto_original: 'entrega de documentacion', peso: '1' },
    { opcion: 'TRAM_OP_ENTREGA', pregunta: '¿Cómo entrego la documentación?', texto_original: 'entregar documentacion', peso: '1' },
  ],
  ignorados: [
    'como', 'cuando', 'donde', 'cual', 'cuales', 'para', 'necesito', 'quiero',
    'puedo', 'hay', 'tiene', 'tengo', 'sobre', 'informacion', 'una', 'uno',
  ].map((termino) => ({ termino })),
  palabras_vacias: ['de', 'la', 'el', 'en', 'los', 'las', 'del', 'y', 'a', 'al'].map((termino) => ({ termino })),
  reconocimiento_fragmentos: [
    'fundamentacion', 'presentacion', 'bibliografia', 'promocion', 'final', 'cronograma',
  ].map((termino) => ({ termino })),
  contactos: [
    {
      clave: 'bedelia',
      nombre: 'Bedelía',
      area: 'Bedelía',
      comision: 'General',
      email: 'bedelia@ejemplo.edu.ar',
      url_perfil: '',
      motivo: 'Trámites, certificados, etc.',
      orden: '1',
      opcion: 'DERIVACION_OP_TRAMITES',
    },
  ],
};
