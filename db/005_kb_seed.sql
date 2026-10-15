-- ============================================================================
--  Asistente Virtual Institucional - IFTS N.29 (Syntax SRL)
--  005_kb_seed.sql - Contenido inicial de la base de conocimiento
--
--  ESPEJO de `backend/src/seed/conocimiento.ts`, igual que `002_seed.sql` es
--  espejo de `backend/src/seed/catalogo.ts`: sin `DATABASE_URL` la API resuelve
--  con el catalogo local y los umbrales se comportan igual que en Neon.
--
--  GENERADO con `npm run db:kb --workspace backend`. No editar a mano:
--  `backend/test/kb-seed.test.ts` falla si este archivo y el seed TS no
--  coinciden exactamente.
--
--  Idempotente: se puede volver a aplicar sin duplicar filas.
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. Intenciones (20)
--    Cada una reusa una opcion del menu ya cargada por 002_seed.sql: el texto
--    libre no agrega respuestas, localiza las existentes.
-- ---------------------------------------------------------------------------
INSERT INTO kb_intencion (clave, nombre, domain, opcion_clave, activo)
VALUES
    ('inscripcion_materias', 'Inscripción a materias', 'administrativo', 'ADM_OP_INSCRIPCION_MATERIAS', TRUE),
    ('inscripcion_examenes', 'Inscripción a exámenes y mesas', 'administrativo', 'ADM_OP_EXAMENES', TRUE),
    ('acceso_siu', 'Acceso al SIU Guaraní', 'administrativo', 'ADM_OP_SIU', TRUE),
    ('siu_o_campus', 'Diferencia entre SIU y Campus Virtual', 'administrativo', 'ADM_OP_SIU_CAMPUS', TRUE),
    ('programa_ABD', 'Programa de Administración de Bases de Datos', 'academico', 'ABD_OP_PROG', TRUE),
    ('programa_EAM', 'Programa de Elementos de Análisis Matemático', 'academico', 'EAM_OP_PROG', TRUE),
    ('programa_LC', 'Programa de Lógica Computacional', 'academico', 'LC_OP_PROG', TRUE),
    ('programa_TP', 'Programa de Técnicas de Programación', 'academico', 'TP_OP_PROG', TRUE),
    ('cronograma_ABD', 'Cronograma de Administración de Bases de Datos', 'academico', 'ABD_OP_CRONO', TRUE),
    ('cronograma_EAM', 'Cronograma de Elementos de Análisis Matemático', 'academico', 'EAM_OP_CRONO', TRUE),
    ('cronograma_LC', 'Cronograma de Lógica Computacional', 'academico', 'LC_OP_CRONO', TRUE),
    ('cronograma_TP', 'Cronograma de Técnicas de Programación', 'academico', 'TP_OP_CRONO', TRUE),
    ('dias_cursada_ABD', 'Días y horarios de Administración de Bases de Datos', 'academico', 'ABD_OP_DIAS', TRUE),
    ('dias_cursada_EAM', 'Días y horarios de Elementos de Análisis Matemático', 'academico', 'EAM_OP_DIAS', TRUE),
    ('dias_cursada_LC', 'Días y horarios de Lógica Computacional', 'academico', 'LC_OP_DIAS', TRUE),
    ('dias_cursada_TP', 'Días y horarios de Técnicas de Programación', 'academico', 'TP_OP_DIAS', TRUE),
    ('condiciones_ABD', 'Condiciones de aprobación de Administración de Bases de Datos', 'academico', 'ABD_OP_COND', TRUE),
    ('condiciones_EAM', 'Condiciones de aprobación de Elementos de Análisis Matemático', 'academico', 'EAM_OP_COND', TRUE),
    ('condiciones_LC', 'Condiciones de aprobación de Lógica Computacional', 'academico', 'LC_OP_COND', TRUE),
    ('condiciones_TP', 'Condiciones de aprobación de Técnicas de Programación', 'academico', 'TP_OP_COND', TRUE)
ON CONFLICT (clave) DO UPDATE
   SET nombre       = EXCLUDED.nombre,
       domain       = EXCLUDED.domain,
       opcion_clave = EXCLUDED.opcion_clave,
       activo       = TRUE;

-- ---------------------------------------------------------------------------
-- 2. Preguntas (20)
-- ---------------------------------------------------------------------------
INSERT INTO kb_pregunta (intencion_id, pregunta, respuesta_id, priority, minimum_threshold, activo)
SELECT i.id, d.pregunta, r.id, d.priority, d.minimum_threshold, TRUE
  FROM (VALUES
    ('inscripcion_materias'::text, '¿Cómo me inscribo a las materias?'::text, 'ADM_INSCRIPCION_MATERIAS'::text, 0::integer, 0.700::numeric(4,3)),
    ('inscripcion_examenes'::text, '¿Cómo me inscribo a los exámenes?'::text, 'ADM_EXAMENES_MESAS'::text, 0::integer, 0.700::numeric(4,3)),
    ('acceso_siu'::text, '¿Cómo accedo al SIU Guaraní?'::text, 'ADM_ACCESO_SIU'::text, 0::integer, 0.700::numeric(4,3)),
    ('siu_o_campus'::text, '¿Cuál es la diferencia entre el SIU y el campus virtual?'::text, 'ADM_SIU_VS_CAMPUS'::text, 0::integer, 0.700::numeric(4,3)),
    ('programa_ABD'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, 'ABD_programa'::text, 30::integer, 0.700::numeric(4,3)),
    ('programa_EAM'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, 'EAM_programa'::text, 30::integer, 0.700::numeric(4,3)),
    ('programa_LC'::text, '¿Cuál es el programa de Lógica Computacional?'::text, 'LC_programa'::text, 30::integer, 0.700::numeric(4,3)),
    ('programa_TP'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, 'TP_programa'::text, 30::integer, 0.700::numeric(4,3)),
    ('cronograma_ABD'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, 'ABD_cronograma'::text, 20::integer, 0.700::numeric(4,3)),
    ('cronograma_EAM'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, 'EAM_cronograma'::text, 20::integer, 0.700::numeric(4,3)),
    ('cronograma_LC'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, 'LC_cronograma'::text, 20::integer, 0.700::numeric(4,3)),
    ('cronograma_TP'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, 'TP_cronograma'::text, 20::integer, 0.700::numeric(4,3)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, 'ABD_dias_cursada'::text, 10::integer, 0.700::numeric(4,3)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, 'EAM_dias_cursada'::text, 10::integer, 0.700::numeric(4,3)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, 'LC_dias_cursada'::text, 10::integer, 0.700::numeric(4,3)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, 'TP_dias_cursada'::text, 10::integer, 0.700::numeric(4,3)),
    ('condiciones_ABD'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, 'ABD_condiciones'::text, 0::integer, 0.700::numeric(4,3)),
    ('condiciones_EAM'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, 'EAM_condiciones'::text, 0::integer, 0.700::numeric(4,3)),
    ('condiciones_LC'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, 'LC_condiciones'::text, 0::integer, 0.700::numeric(4,3)),
    ('condiciones_TP'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, 'TP_condiciones'::text, 0::integer, 0.700::numeric(4,3))
  ) AS d(intencion_clave, pregunta, respuesta_clave, priority, minimum_threshold)
  JOIN kb_intencion i    ON i.clave = d.intencion_clave
  LEFT JOIN respuesta r ON r.clave = d.respuesta_clave AND r.activo
ON CONFLICT (intencion_id, pregunta) DO UPDATE
   SET respuesta_id      = EXCLUDED.respuesta_id,
       priority          = EXCLUDED.priority,
       minimum_threshold = EXCLUDED.minimum_threshold,
       activo            = TRUE;

-- ---------------------------------------------------------------------------
-- 3. Variantes (120)
--    `normalized_text` es el resultado del normalizador de la API
--    (`backend/src/utils/normalizar.ts`): sin acentos, sin puntuacion, con
--    espacios colapsados. Es el campo que indexan el b-tree (exacto) y el GIN
--    trigram (similar).
--
--    Las variantes genericas estan repetidas en varias preguntas a proposito:
--    son las que hacen que el motor pida ACLARACION en vez de adivinar (D06).
-- ---------------------------------------------------------------------------
INSERT INTO kb_pregunta_variante (pregunta_id, original_text, normalized_text, weight, activo)
SELECT p.id, d.original_text, d.normalized_text, d.weight, TRUE
  FROM (VALUES
    ('inscripcion_materias'::text, '¿Cómo me inscribo a las materias?'::text, '¿Cómo me inscribo a las materias?'::text, 'como me inscribo a las materias'::text, 1.00::numeric(3,2)),
    ('inscripcion_materias'::text, '¿Cómo me inscribo a las materias?'::text, 'inscripción a materias'::text, 'inscripcion a materias'::text, 0.95::numeric(3,2)),
    ('inscripcion_materias'::text, '¿Cómo me inscribo a las materias?'::text, 'cómo hago la inscripción a una materia'::text, 'como hago la inscripcion a una materia'::text, 0.95::numeric(3,2)),
    ('inscripcion_materias'::text, '¿Cómo me inscribo a las materias?'::text, 'cuándo se abren las inscripciones'::text, 'cuando se abren las inscripciones'::text, 0.90::numeric(3,2)),
    ('inscripcion_materias'::text, '¿Cómo me inscribo a las materias?'::text, 'inscripción por el SIU Guaraní'::text, 'inscripcion por el siu guarani'::text, 0.90::numeric(3,2)),
    ('inscripcion_examenes'::text, '¿Cómo me inscribo a los exámenes?'::text, '¿Cómo me inscribo a los exámenes?'::text, 'como me inscribo a los examenes'::text, 1.00::numeric(3,2)),
    ('inscripcion_examenes'::text, '¿Cómo me inscribo a los exámenes?'::text, 'mesas de examen'::text, 'mesas de examen'::text, 0.95::numeric(3,2)),
    ('inscripcion_examenes'::text, '¿Cómo me inscribo a los exámenes?'::text, 'inscripción a exámenes'::text, 'inscripcion a examenes'::text, 0.95::numeric(3,2)),
    ('inscripcion_examenes'::text, '¿Cómo me inscribo a los exámenes?'::text, 'inscribirme a un examen'::text, 'inscribirme a un examen'::text, 0.90::numeric(3,2)),
    ('inscripcion_examenes'::text, '¿Cómo me inscribo a los exámenes?'::text, 'cuándo son las mesas de examen'::text, 'cuando son las mesas de examen'::text, 0.90::numeric(3,2)),
    ('acceso_siu'::text, '¿Cómo accedo al SIU Guaraní?'::text, '¿Cómo accedo al SIU Guaraní?'::text, 'como accedo al siu guarani'::text, 1.00::numeric(3,2)),
    ('acceso_siu'::text, '¿Cómo accedo al SIU Guaraní?'::text, 'acceso al SIU'::text, 'acceso al siu'::text, 0.95::numeric(3,2)),
    ('acceso_siu'::text, '¿Cómo accedo al SIU Guaraní?'::text, 'cómo entro al SIU Guaraní'::text, 'como entro al siu guarani'::text, 0.95::numeric(3,2)),
    ('acceso_siu'::text, '¿Cómo accedo al SIU Guaraní?'::text, 'usuario y contraseña del SIU'::text, 'usuario y contrasena del siu'::text, 0.90::numeric(3,2)),
    ('acceso_siu'::text, '¿Cómo accedo al SIU Guaraní?'::text, 'no puedo entrar al SIU'::text, 'no puedo entrar al siu'::text, 0.90::numeric(3,2)),
    ('siu_o_campus'::text, '¿Cuál es la diferencia entre el SIU y el campus virtual?'::text, '¿Cuál es la diferencia entre el SIU y el campus virtual?'::text, 'cual es la diferencia entre el siu y el campus virtual'::text, 1.00::numeric(3,2)),
    ('siu_o_campus'::text, '¿Cuál es la diferencia entre el SIU y el campus virtual?'::text, 'diferencia entre SIU y campus'::text, 'diferencia entre siu y campus'::text, 0.95::numeric(3,2)),
    ('siu_o_campus'::text, '¿Cuál es la diferencia entre el SIU y el campus virtual?'::text, 'SIU o campus'::text, 'siu o campus'::text, 0.90::numeric(3,2)),
    ('siu_o_campus'::text, '¿Cuál es la diferencia entre el SIU y el campus virtual?'::text, 'para qué sirve el campus virtual'::text, 'para que sirve el campus virtual'::text, 0.90::numeric(3,2)),
    ('siu_o_campus'::text, '¿Cuál es la diferencia entre el SIU y el campus virtual?'::text, 'qué es el campus virtual'::text, 'que es el campus virtual'::text, 0.90::numeric(3,2)),
    ('programa_ABD'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, 'cual es el programa de administracion de bases de datos'::text, 1.00::numeric(3,2)),
    ('programa_ABD'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, 'contenidos de Administración de Bases de Datos'::text, 'contenidos de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('programa_ABD'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, 'programa de Administración de Bases de Datos'::text, 'programa de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('programa_ABD'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, 'qué incluye la materia Administración de Bases de Datos'::text, 'que incluye la materia administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('programa_ABD'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, 'Administración de Bases de Datos'::text, 'administracion de bases de datos'::text, 0.90::numeric(3,2)),
    ('programa_ABD'::text, '¿Cuál es el programa de Administración de Bases de Datos?'::text, 'programa'::text, 'programa'::text, 0.90::numeric(3,2)),
    ('programa_EAM'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, 'cual es el programa de elementos de analisis matematico'::text, 1.00::numeric(3,2)),
    ('programa_EAM'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, 'contenidos de Elementos de Análisis Matemático'::text, 'contenidos de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('programa_EAM'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, 'programa de Elementos de Análisis Matemático'::text, 'programa de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('programa_EAM'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, 'qué incluye la materia Elementos de Análisis Matemático'::text, 'que incluye la materia elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('programa_EAM'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, 'Elementos de Análisis Matemático'::text, 'elementos de analisis matematico'::text, 0.90::numeric(3,2)),
    ('programa_EAM'::text, '¿Cuál es el programa de Elementos de Análisis Matemático?'::text, 'programa'::text, 'programa'::text, 0.90::numeric(3,2)),
    ('programa_LC'::text, '¿Cuál es el programa de Lógica Computacional?'::text, '¿Cuál es el programa de Lógica Computacional?'::text, 'cual es el programa de logica computacional'::text, 1.00::numeric(3,2)),
    ('programa_LC'::text, '¿Cuál es el programa de Lógica Computacional?'::text, 'contenidos de Lógica Computacional'::text, 'contenidos de logica computacional'::text, 0.95::numeric(3,2)),
    ('programa_LC'::text, '¿Cuál es el programa de Lógica Computacional?'::text, 'programa de Lógica Computacional'::text, 'programa de logica computacional'::text, 0.95::numeric(3,2)),
    ('programa_LC'::text, '¿Cuál es el programa de Lógica Computacional?'::text, 'qué incluye la materia Lógica Computacional'::text, 'que incluye la materia logica computacional'::text, 0.95::numeric(3,2)),
    ('programa_LC'::text, '¿Cuál es el programa de Lógica Computacional?'::text, 'Lógica Computacional'::text, 'logica computacional'::text, 0.90::numeric(3,2)),
    ('programa_LC'::text, '¿Cuál es el programa de Lógica Computacional?'::text, 'programa'::text, 'programa'::text, 0.90::numeric(3,2)),
    ('programa_TP'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, 'cual es el programa de tecnicas de programacion'::text, 1.00::numeric(3,2)),
    ('programa_TP'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, 'contenidos de Técnicas de Programación'::text, 'contenidos de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('programa_TP'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, 'programa de Técnicas de Programación'::text, 'programa de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('programa_TP'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, 'qué incluye la materia Técnicas de Programación'::text, 'que incluye la materia tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('programa_TP'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, 'Técnicas de Programación'::text, 'tecnicas de programacion'::text, 0.90::numeric(3,2)),
    ('programa_TP'::text, '¿Cuál es el programa de Técnicas de Programación?'::text, 'programa'::text, 'programa'::text, 0.90::numeric(3,2)),
    ('cronograma_ABD'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, 'cual es el cronograma de administracion de bases de datos'::text, 1.00::numeric(3,2)),
    ('cronograma_ABD'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, 'fechas de entrega de Administración de Bases de Datos'::text, 'fechas de entrega de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('cronograma_ABD'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, 'cronograma de Administración de Bases de Datos'::text, 'cronograma de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('cronograma_ABD'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, 'calendario de Administración de Bases de Datos'::text, 'calendario de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('cronograma_ABD'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, 'Administración de Bases de Datos'::text, 'administracion de bases de datos'::text, 0.90::numeric(3,2)),
    ('cronograma_ABD'::text, '¿Cuál es el cronograma de Administración de Bases de Datos?'::text, 'cronograma'::text, 'cronograma'::text, 0.90::numeric(3,2)),
    ('cronograma_EAM'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, 'cual es el cronograma de elementos de analisis matematico'::text, 1.00::numeric(3,2)),
    ('cronograma_EAM'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, 'fechas de entrega de Elementos de Análisis Matemático'::text, 'fechas de entrega de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('cronograma_EAM'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, 'cronograma de Elementos de Análisis Matemático'::text, 'cronograma de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('cronograma_EAM'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, 'calendario de Elementos de Análisis Matemático'::text, 'calendario de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('cronograma_EAM'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, 'Elementos de Análisis Matemático'::text, 'elementos de analisis matematico'::text, 0.90::numeric(3,2)),
    ('cronograma_EAM'::text, '¿Cuál es el cronograma de Elementos de Análisis Matemático?'::text, 'cronograma'::text, 'cronograma'::text, 0.90::numeric(3,2)),
    ('cronograma_LC'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, 'cual es el cronograma de logica computacional'::text, 1.00::numeric(3,2)),
    ('cronograma_LC'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, 'fechas de entrega de Lógica Computacional'::text, 'fechas de entrega de logica computacional'::text, 0.95::numeric(3,2)),
    ('cronograma_LC'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, 'cronograma de Lógica Computacional'::text, 'cronograma de logica computacional'::text, 0.95::numeric(3,2)),
    ('cronograma_LC'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, 'calendario de Lógica Computacional'::text, 'calendario de logica computacional'::text, 0.95::numeric(3,2)),
    ('cronograma_LC'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, 'Lógica Computacional'::text, 'logica computacional'::text, 0.90::numeric(3,2)),
    ('cronograma_LC'::text, '¿Cuál es el cronograma de Lógica Computacional?'::text, 'cronograma'::text, 'cronograma'::text, 0.90::numeric(3,2)),
    ('cronograma_TP'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, 'cual es el cronograma de tecnicas de programacion'::text, 1.00::numeric(3,2)),
    ('cronograma_TP'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, 'fechas de entrega de Técnicas de Programación'::text, 'fechas de entrega de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('cronograma_TP'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, 'cronograma de Técnicas de Programación'::text, 'cronograma de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('cronograma_TP'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, 'calendario de Técnicas de Programación'::text, 'calendario de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('cronograma_TP'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, 'Técnicas de Programación'::text, 'tecnicas de programacion'::text, 0.90::numeric(3,2)),
    ('cronograma_TP'::text, '¿Cuál es el cronograma de Técnicas de Programación?'::text, 'cronograma'::text, 'cronograma'::text, 0.90::numeric(3,2)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, 'que dias y horarios tiene administracion de bases de datos'::text, 1.00::numeric(3,2)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, '¿Cuándo se cursa Administración de Bases de Datos?'::text, 'cuando se cursa administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, '¿cuándo empiezan las clases de Administración de Bases de Datos?'::text, 'cuando empiezan las clases de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, 'horarios de Administración de Bases de Datos'::text, 'horarios de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, 'Administración de Bases de Datos'::text, 'administracion de bases de datos'::text, 0.90::numeric(3,2)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, 'días de cursada'::text, 'dias de cursada'::text, 0.90::numeric(3,2)),
    ('dias_cursada_ABD'::text, '¿Qué días y horarios tiene Administración de Bases de Datos?'::text, '¿cuándo empiezan las clases?'::text, 'cuando empiezan las clases'::text, 0.90::numeric(3,2)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, 'que dias y horarios tiene elementos de analisis matematico'::text, 1.00::numeric(3,2)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, '¿Cuándo se cursa Elementos de Análisis Matemático?'::text, 'cuando se cursa elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, '¿cuándo empiezan las clases de Elementos de Análisis Matemático?'::text, 'cuando empiezan las clases de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, 'horarios de Elementos de Análisis Matemático'::text, 'horarios de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, 'Elementos de Análisis Matemático'::text, 'elementos de analisis matematico'::text, 0.90::numeric(3,2)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, 'días de cursada'::text, 'dias de cursada'::text, 0.90::numeric(3,2)),
    ('dias_cursada_EAM'::text, '¿Qué días y horarios tiene Elementos de Análisis Matemático?'::text, '¿cuándo empiezan las clases?'::text, 'cuando empiezan las clases'::text, 0.90::numeric(3,2)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, 'que dias y horarios tiene logica computacional'::text, 1.00::numeric(3,2)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, '¿Cuándo se cursa Lógica Computacional?'::text, 'cuando se cursa logica computacional'::text, 0.95::numeric(3,2)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, '¿cuándo empiezan las clases de Lógica Computacional?'::text, 'cuando empiezan las clases de logica computacional'::text, 0.95::numeric(3,2)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, 'horarios de Lógica Computacional'::text, 'horarios de logica computacional'::text, 0.95::numeric(3,2)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, 'Lógica Computacional'::text, 'logica computacional'::text, 0.90::numeric(3,2)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, 'días de cursada'::text, 'dias de cursada'::text, 0.90::numeric(3,2)),
    ('dias_cursada_LC'::text, '¿Qué días y horarios tiene Lógica Computacional?'::text, '¿cuándo empiezan las clases?'::text, 'cuando empiezan las clases'::text, 0.90::numeric(3,2)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, 'que dias y horarios tiene tecnicas de programacion'::text, 1.00::numeric(3,2)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, '¿Cuándo se cursa Técnicas de Programación?'::text, 'cuando se cursa tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, '¿cuándo empiezan las clases de Técnicas de Programación?'::text, 'cuando empiezan las clases de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, 'horarios de Técnicas de Programación'::text, 'horarios de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, 'Técnicas de Programación'::text, 'tecnicas de programacion'::text, 0.90::numeric(3,2)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, 'días de cursada'::text, 'dias de cursada'::text, 0.90::numeric(3,2)),
    ('dias_cursada_TP'::text, '¿Qué días y horarios tiene Técnicas de Programación?'::text, '¿cuándo empiezan las clases?'::text, 'cuando empiezan las clases'::text, 0.90::numeric(3,2)),
    ('condiciones_ABD'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, 'cuales son las condiciones de aprobacion de administracion de bases de datos'::text, 1.00::numeric(3,2)),
    ('condiciones_ABD'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, 'cómo se aprueba Administración de Bases de Datos'::text, 'como se aprueba administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('condiciones_ABD'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, 'condiciones de aprobación de Administración de Bases de Datos'::text, 'condiciones de aprobacion de administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('condiciones_ABD'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, 'qué hace falta para aprobar Administración de Bases de Datos'::text, 'que hace falta para aprobar administracion de bases de datos'::text, 0.95::numeric(3,2)),
    ('condiciones_ABD'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, 'Administración de Bases de Datos'::text, 'administracion de bases de datos'::text, 0.90::numeric(3,2)),
    ('condiciones_ABD'::text, '¿Cuáles son las condiciones de aprobación de Administración de Bases de Datos?'::text, 'condiciones de aprobación'::text, 'condiciones de aprobacion'::text, 0.90::numeric(3,2)),
    ('condiciones_EAM'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, 'cuales son las condiciones de aprobacion de elementos de analisis matematico'::text, 1.00::numeric(3,2)),
    ('condiciones_EAM'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, 'cómo se aprueba Elementos de Análisis Matemático'::text, 'como se aprueba elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('condiciones_EAM'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, 'condiciones de aprobación de Elementos de Análisis Matemático'::text, 'condiciones de aprobacion de elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('condiciones_EAM'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, 'qué hace falta para aprobar Elementos de Análisis Matemático'::text, 'que hace falta para aprobar elementos de analisis matematico'::text, 0.95::numeric(3,2)),
    ('condiciones_EAM'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, 'Elementos de Análisis Matemático'::text, 'elementos de analisis matematico'::text, 0.90::numeric(3,2)),
    ('condiciones_EAM'::text, '¿Cuáles son las condiciones de aprobación de Elementos de Análisis Matemático?'::text, 'condiciones de aprobación'::text, 'condiciones de aprobacion'::text, 0.90::numeric(3,2)),
    ('condiciones_LC'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, 'cuales son las condiciones de aprobacion de logica computacional'::text, 1.00::numeric(3,2)),
    ('condiciones_LC'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, 'cómo se aprueba Lógica Computacional'::text, 'como se aprueba logica computacional'::text, 0.95::numeric(3,2)),
    ('condiciones_LC'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, 'condiciones de aprobación de Lógica Computacional'::text, 'condiciones de aprobacion de logica computacional'::text, 0.95::numeric(3,2)),
    ('condiciones_LC'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, 'qué hace falta para aprobar Lógica Computacional'::text, 'que hace falta para aprobar logica computacional'::text, 0.95::numeric(3,2)),
    ('condiciones_LC'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, 'Lógica Computacional'::text, 'logica computacional'::text, 0.90::numeric(3,2)),
    ('condiciones_LC'::text, '¿Cuáles son las condiciones de aprobación de Lógica Computacional?'::text, 'condiciones de aprobación'::text, 'condiciones de aprobacion'::text, 0.90::numeric(3,2)),
    ('condiciones_TP'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, 'cuales son las condiciones de aprobacion de tecnicas de programacion'::text, 1.00::numeric(3,2)),
    ('condiciones_TP'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, 'cómo se aprueba Técnicas de Programación'::text, 'como se aprueba tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('condiciones_TP'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, 'condiciones de aprobación de Técnicas de Programación'::text, 'condiciones de aprobacion de tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('condiciones_TP'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, 'qué hace falta para aprobar Técnicas de Programación'::text, 'que hace falta para aprobar tecnicas de programacion'::text, 0.95::numeric(3,2)),
    ('condiciones_TP'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, 'Técnicas de Programación'::text, 'tecnicas de programacion'::text, 0.90::numeric(3,2)),
    ('condiciones_TP'::text, '¿Cuáles son las condiciones de aprobación de Técnicas de Programación?'::text, 'condiciones de aprobación'::text, 'condiciones de aprobacion'::text, 0.90::numeric(3,2))
  ) AS d(intencion_clave, pregunta, original_text, normalized_text, weight)
  JOIN kb_intencion i ON i.clave    = d.intencion_clave
  JOIN kb_pregunta  p ON p.pregunta = d.pregunta AND p.intencion_id = i.id
ON CONFLICT (pregunta_id, normalized_text) DO UPDATE
   SET original_text = EXCLUDED.original_text,
       weight        = EXCLUDED.weight,
       activo        = TRUE;

COMMIT;
