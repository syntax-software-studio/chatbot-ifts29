/**
 * Contenido de prueba: un conjunto chico y explícito, con la misma forma que la
 * planilla de contenido. Lo carga `prepararBasePrueba()` en la base de prueba.
 *
 * No es el contenido real del IFTS: sirve para verificar el comportamiento del
 * sistema (menú, texto libre, aclaración, derivación) sin depender de Drive ni
 * de la planilla.
 */

import type { Fila, Pestana } from '../../src/services/fuente-contenido.service.js';

export const contenidoPrueba: Partial<Record<Pestana, Fila[]>> = {
  categorias: [
    { clave: 'RAIZ', nombre: 'Inicio', mensaje: '¡Hola! ¿En qué puedo ayudarte?', orden: '0', es_raiz: 'TRUE' },
    { clave: 'ACAD', nombre: 'Materias', mensaje: '¿Sobre qué materia necesitás información?', orden: '1', es_raiz: 'FALSE' },
    { clave: 'ABD', nombre: 'Administración de Bases de Datos', mensaje: '¿Qué información necesitás?', orden: '1', es_raiz: 'FALSE' },
    { clave: 'DERIVACION', nombre: 'No encontré lo que busco', mensaje: '¿Sobre qué necesitás ayuda?', orden: '2', es_raiz: 'FALSE' },
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
  ],
  respuestas: [
    { clave: 'ABD_programa', texto: 'Este es el programa de Administración de Bases de Datos.', orden: '1' },
    { clave: 'ABD_condiciones', texto: 'Estas son las condiciones de aprobación de Administración de Bases de Datos.', orden: '2' },
    { clave: 'DERIVACION_GENERAL', texto: 'Podés escribirle a esta persona o área:', orden: '3' },
  ],
  respuesta_documentos: [
    { respuesta: 'ABD_programa', documento: 'ABD_programa_2026_1C', orden: '1' },
    { respuesta: 'ABD_condiciones', documento: 'ABD_condiciones_2026_1C', orden: '1' },
  ],
  intenciones: [
    { clave: 'programa_ABD', nombre: 'Programa de ABD', dominio: 'academico', opcion: 'ABD_OP_PROG' },
    { clave: 'condiciones_ABD', nombre: 'Condiciones de ABD', dominio: 'academico', opcion: 'ABD_OP_COND' },
  ],
  preguntas: [
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', prioridad: '30', umbral: '0,7' },
    { intencion: 'programa_ABD', pregunta: 'Programa de ABD', prioridad: '10', umbral: '0,7' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', prioridad: '20', umbral: '0,7' },
  ],
  variantes: [
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', texto: 'programa de abd', peso: '1' },
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', texto: 'contenidos de abd', peso: '0,95' },
    { intencion: 'programa_ABD', pregunta: '¿Cuál es el programa de ABD?', texto: 'abd', peso: '0,9' },
    { intencion: 'programa_ABD', pregunta: 'Programa de ABD', texto: 'programa', peso: '0,9' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto: 'condiciones de aprobacion de abd', peso: '1' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto: 'como se aprueba abd', peso: '0,95' },
    { intencion: 'condiciones_ABD', pregunta: '¿Cuáles son las condiciones de aprobación de ABD?', texto: 'abd', peso: '0,9' },
  ],
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
