-- ============================================================================
--  002_seed.sql - Contenido inicial validado por el IFTS N.29
--
--  Carga idempotente: se puede ejecutar varias veces (ON CONFLICT DO UPDATE).
--  Corresponde al arbol de menu validado en el prototipo (RE04) y a los
--  RF01-RF09 de la linea base del MVP.
--
--  Decisiones de modelado relevantes para el mantenimiento no tecnico (RF09):
--   * Cada materia tiene SUS PROPIAS respuestas y SUS PROPIOS documentos.
--     Asi bedelia/tutorias editan una materia sin tocar las otras tres.
--   * Los DOC_* quedan sin drive_file_id a proposito. La rutina de
--     sincronizacion (POST /api/sync) los completa leyendo la carpeta de Drive
--     institucional. Si Drive no esta configurado, la API responde el nombre
--     del documento y marca la trazabilidad como pendiente, sin inventar un
--     enlace (RF07 exige trazabilidad real, no un link roto).
-- ============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- CONTACTO  (derivacion asincronica - RF04)
-- El sistema solo MUESTRA estos datos: no envia mails ni gestiona tramites.
-- ---------------------------------------------------------------------------
INSERT INTO contacto (clave, nombre, rol, area, comision, email, url_perfil, motivo, horario, orden, activo) VALUES
('tutoria_comision_a', 'Alexis Eletto', 'Tutoría de comisión', 'Tutorías', 'A',
 'alexis.eletto@bue.edu.ar', 'https://aulasvirtuales.bue.edu.ar/user/view.php?id=250272&course=28479',
 'Orientación para organizar tu cursada, entender correlatividades y reglamento, preparar finales o materias libres, usar el Campus Virtual, y conocer prácticas profesionalizantes, becas y talleres.',
 NULL, 1, TRUE),
('tutoria_comision_b', 'Fiamma Gramajo', 'Tutoría de comisión', 'Tutorías', 'B',
 'fiamma.gramajo@bue.edu.ar', 'https://aulasvirtuales.bue.edu.ar/user/view.php?id=216461&course=28479',
 'Orientación para organizar tu cursada, entender correlatividades y reglamento, preparar finales o materias libres, usar el Campus Virtual, y conocer prácticas profesionalizantes, becas y talleres.',
 NULL, 2, TRUE),
('bedelia', 'Bedelía IFTS N.29', 'Secretaría académica', 'Bedelía', 'General',
 'bedelia.ifts29@bue.edu.ar', NULL,
 'Certificados y constancias, libretas, control de asistencia, actualización de datos, inscripciones a materias y trámites de equivalencias.',
 'Lunes a viernes de 8:30 a 17:30 hs', 3, TRUE),
('advisory_pedagogica', 'Asesoría Pedagógica', 'Tutoría pedagógica', 'Asesoría Pedagógica', 'General',
 'tutoria.ifts29@bue.edu.ar', NULL,
 'Dificultades pedagógicas, seguimiento de tu trayectoria y dudas normativas sobre el cursado y la equivalencia de materias.',
 'Lunes a viernes de 9:00 a 18:00 hs', 4, TRUE),
-- Desactivada, no borrada: ya no es la tutora general confirmada. Las filas
-- que la referencian (opcion_contacto) la omiten porque el SQL filtra c.activo.
('tutoria_academica', 'MG María González', 'Tutora académica', 'Tutorías', 'General',
 'mgonzalez@bue.edu.ar', 'https://aulasvirtuales.bue.edu.ar/',
 'Dudas sobre cursada, pertenencia a comisiones, presentación de trabajos prácticos o elección de materia.',
 'Lunes a viernes de 9:00 a 18:00 hs', 5, FALSE)
ON CONFLICT (clave) DO UPDATE SET
    nombre     = EXCLUDED.nombre,
    rol        = EXCLUDED.rol,
    area       = EXCLUDED.area,
    comision   = EXCLUDED.comision,
    email      = EXCLUDED.email,
    url_perfil = EXCLUDED.url_perfil,
    motivo     = EXCLUDED.motivo,
    horario    = EXCLUDED.horario,
    orden      = EXCLUDED.orden,
    activo     = EXCLUDED.activo;

-- ---------------------------------------------------------------------------
-- CATEGORIA  (nodos del arbol)
-- ---------------------------------------------------------------------------
INSERT INTO categoria (clave, nombre, mensaje, orden, es_raiz) VALUES
('RAIZ', 'Inicio',
 '¡Hola! Soy el asistente virtual del IFTS Nº29. ¿En qué puedo ayudarte hoy?', 0, TRUE),
('ADMINISTRATIVAS', 'Consultas administrativas',
 'Sobre qué tema administrativo puedo ayudarte?', 1, FALSE),
('ACADEMICAS', 'Consultas academicas',
 '¿Sobre qué materia necesitás información?', 2, FALSE),
('M_ADMIN_BASE_DATOS', 'Administración de Bases de Datos',
 '¿Qué información necesitás sobre Administración de Bases de Datos?', 10, FALSE),
('M_ANALISIS_MATEMATICO', 'Elementos de Análisis Matemático',
 '¿Qué información necesitás sobre Elementos de Análisis Matemático?', 11, FALSE),
('M_LOGICA_COMPUTACIONAL', 'Lógica Computacional',
 '¿Qué información necesitás sobre Lógica Computacional?', 12, FALSE),
('M_TECNICAS_PROGRAMACION', 'Técnicas de Programación',
 '¿Qué información necesitás sobre Técnicas de Programación?', 13, FALSE)
ON CONFLICT (clave) DO UPDATE SET
    nombre  = EXCLUDED.nombre,
    mensaje = EXCLUDED.mensaje,
    orden   = EXCLUDED.orden,
    activo  = TRUE;

-- ---------------------------------------------------------------------------
-- DOCUMENTO  (fichas; los fileId se completan con la sincronizacion de Drive)
-- ---------------------------------------------------------------------------
INSERT INTO documento (clave, nombre, descripcion, tipo, mime_type, drive_nombre_archivo, vigente, estado) VALUES
('DOC_ABD_PROGRAMA',    'Administracion de Base de Datos_Programa.pdf',             'Programa vigente de la materia.',            'programa',              'application/pdf', 'programa__administracion-bases-datos.pdf',                 TRUE, 'vigente'),
('DOC_ABD_CRONOGRAMA',  'Administracion de Base de Datos_Cronograma.pdf',           'Cronograma vigente del cuatrimestre.',      'cronograma',            'application/pdf', 'cronograma__administracion-bases-datos.pdf',             TRUE, 'vigente'),
('DOC_ABD_CONDICIONES', 'Administracion de Base de Datos_Condiciones_de_Aprobacion.pdf', 'Condiciones oficiales de aprobación.',  'condiciones_aprobacion', 'application/pdf', 'condiciones__administracion-bases-datos.pdf',         TRUE, 'vigente'),
('DOC_EAM_PROGRAMA',    'Elementos de Analisis Matematico_Programa.pdf',            'Programa vigente de la materia.',            'programa',              'application/pdf', 'programa__elementos-analisis-matematico.pdf',            TRUE, 'vigente'),
('DOC_EAM_CRONOGRAMA',  'Elementos de Analisis Matematico_Cronograma.pdf',          'Cronograma vigente del cuatrimestre.',      'cronograma',            'application/pdf', 'cronograma__elementos-analisis-matematico.pdf',          TRUE, 'vigente'),
('DOC_EAM_CONDICIONES', 'Elementos de Analisis Matematico_Condiciones_de_Aprobacion.pdf', 'Condiciones oficiales de aprobación.',  'condiciones_aprobacion', 'application/pdf', 'condiciones__elementos-analisis-matematico.pdf',      TRUE, 'vigente'),
('DOC_LC_PROGRAMA',     'Logica Computacional_Programa.pdf',                        'Programa vigente de la materia.',            'programa',              'application/pdf', 'programa__logica-computacional.pdf',                     TRUE, 'vigente'),
('DOC_LC_CRONOGRAMA',   'Logica Computacional_Cronograma.pdf',                      'Cronograma vigente del cuatrimestre.',      'cronograma',            'application/pdf', 'cronograma__logica-computacional.pdf',                   TRUE, 'vigente'),
('DOC_LC_CONDICIONES',  'Logica Computacional_Condiciones_de_Aprobacion.pdf',       'Condiciones oficiales de aprobación.',      'condiciones_aprobacion', 'application/pdf', 'condiciones__logica-computacional.pdf',                  TRUE, 'vigente'),
('DOC_TP_PROGRAMA',     'Tecnicas de Programacion_Programa.pdf',                    'Programa vigente de la materia.',            'programa',              'application/pdf', 'programa__tecnicas-programacion.pdf',                    TRUE, 'vigente'),
('DOC_TP_CRONOGRAMA',   'Tecnicas de Programacion_Cronograma.pdf',                  'Cronograma vigente del cuatrimestre.',      'cronograma',            'application/pdf', 'cronograma__tecnicas-programacion.pdf',                  TRUE, 'vigente'),
('DOC_TP_CONDICIONES',  'Tecnicas de Programacion_Condiciones_de_Aprobacion.pdf',   'Condiciones oficiales de aprobación.',      'condiciones_aprobacion', 'application/pdf', 'condiciones__tecnicas-programacion.pdf',                  TRUE, 'vigente')
ON CONFLICT (clave) DO UPDATE SET
    nombre               = EXCLUDED.nombre,
    descripcion          = EXCLUDED.descripcion,
    tipo                 = EXCLUDED.tipo,
    mime_type            = EXCLUDED.mime_type,
    drive_nombre_archivo = EXCLUDED.drive_nombre_archivo;

-- ---------------------------------------------------------------------------
-- RESPUESTA  (textos institucionales validados, uno por rama)
-- ---------------------------------------------------------------------------
INSERT INTO respuesta (clave, texto, orden) VALUES
-- Rama: Consultas administrativas
('ADM_INSCRIPCIONES',
 'Las inscripciones a materias se realizan a través del SIU Guaraní, en el período habilitado por Bedelía. Ingresá con tu usuario y contraseña, seleccioná "Inscripción a materias" y elegí las comisiones disponibles. Si tenés dudas sobre el calendario de inscripciones, escribí a bedelia.ifts29@bue.edu.ar.',
 1),
('ADM_EXAMENES_MESAS',
 'Las mesas de examen se publican en el SIU Guaraní con 7 días de anticipación. Para inscribirte, ingresá al sistema, seleccioná "Inscripción a exámenes" y elegí la materia y mesa.',
 2),
('ADM_ACCESO_SIU',
 'Para acceder al SIU Guaraní visitá https://guarani-autogestionagencia.bue.edu.ar/acceso. Tu usuario es tu número de legajo y la contraseña inicial es tu DNI. Si tenés problemas de acceso, contactá a Bedelía a través de bedelia.ifts29@bue.edu.ar.',
 3),
('ADM_SIU_VS_CAMPUS',
 'El Campus Virtual (https://aulasvirtuales.bue.edu.ar/) es el entorno educativo donde encontrás materiales de estudio, foros y entregas de trabajos prácticos. El SIU Guaraní es el sistema administrativo para gestionar inscripciones, historial académico y trámites. Usás el campus para estudiar y el SIU para gestionar tu situación académica.',
 4),
-- Derivación (texto introductorio; los datos de contacto salen de CONTACTO)
('DERIVACION_GENERAL',
 'Si no encontraste lo que buscabas, tu **tutora académica de este cuatrimestre** es MG María González (Tutora académica - mgonzalez@bue.edu.ar). Escribile y te va a orientar.
Si tu consulta es administrativa o sobre el uso del campus, también podés escribir a Bedelía o a Asesoría Pedagógica:',
 90)
ON CONFLICT (clave) DO UPDATE SET
    texto  = EXCLUDED.texto,
    orden  = EXCLUDED.orden,
    activo = TRUE;

-- ---- Respuestas por materia: días de cursada (misma grilla, texto propio) --
INSERT INTO respuesta (clave, texto, orden) VALUES
('ABD_dias_cursada',
 'Comisión A: Lunes y Miércoles de 18:00 a 21:00 hs — modalidad virtual sincrónica.
Comisión B: Martes y Jueves de 8:00 a 11:00 hs — modalidad virtual sincrónica.
Comisión C: Viernes de 14:00 a 20:00 hs — modalidad virtual sincrónica.', 1),
('EAM_dias_cursada',
 'Comisión A: Lunes y Miércoles de 18:00 a 21:00 hs — modalidad virtual sincrónica.
Comisión B: Martes y Jueves de 8:00 a 11:00 hs — modalidad virtual sincrónica.
Comisión C: Viernes de 14:00 a 20:00 hs — modalidad virtual sincrónica.', 1),
('LC_dias_cursada',
 'Comisión A: Lunes y Miércoles de 18:00 a 21:00 hs — modalidad virtual sincrónica.
Comisión B: Martes y Jueves de 8:00 a 11:00 hs — modalidad virtual sincrónica.
Comisión C: Viernes de 14:00 a 20:00 hs — modalidad virtual sincrónica.', 1),
('TP_dias_cursada',
 'Comisión A: Lunes y Miércoles de 18:00 a 21:00 hs — modalidad virtual sincrónica.
Comisión B: Martes y Jueves de 8:00 a 11:00 hs — modalidad virtual sincrónica.
Comisión C: Viernes de 14:00 a 20:00 hs — modalidad virtual sincrónica.', 1),

-- ---- Administración de Bases de Datos ----
('ABD_condiciones', 'Estas son las condiciones oficiales de aprobación de Administración de Bases de Datos. Leé el documento vigente y, si tenés una duda puntual, escribí a tu tutora académica.', 2),
('ABD_programa',    'Este es el programa vigente de Administración de Bases de Datos, con contenidos, bibliografía y criterios de evaluación.', 3),
('ABD_cronograma',  'Este es el cronograma vigente de Administración de Bases de Datos, con las fechas de entrega de los trabajos prácticos.', 4),

-- ---- Elementos de Análisis Matemático ----
('EAM_condiciones', 'Estas son las condiciones oficiales de aprobación de Elementos de Análisis Matemático. Leé el documento vigente y, si tenés una duda puntual, escribí a tu tutora académica.', 2),
('EAM_programa',    'Este es el programa vigente de Elementos de Análisis Matemático, con contenidos, bibliografía y criterios de evaluación.', 3),
('EAM_cronograma',  'Este es el cronograma vigente de Elementos de Análisis Matemático, con las fechas de entrega de los trabajos prácticos.', 4),

-- ---- Lógica Computacional ----
('LC_condiciones', 'Estas son las condiciones oficiales de aprobación de Lógica Computacional. Leé el documento vigente y, si tenés una duda puntual, escribí a tu tutora académica.', 2),
('LC_programa',    'Este es el programa vigente de Lógica Computacional, con contenidos, bibliografía y criterios de evaluación.', 3),
('LC_cronograma',  'Este es el cronograma vigente de Lógica Computacional, con las fechas de entrega de los trabajos prácticos.', 4),

-- ---- Técnicas de Programación ----
('TP_condiciones', 'Estas son las condiciones oficiales de aprobación de Técnicas de Programación. Leé el documento vigente y, si tenés una duda puntual, escribí a tu tutora académica.', 2),
('TP_programa',    'Este es el programa vigente de Técnicas de Programación, con contenidos, bibliografía y criterios de evaluación.', 3),
('TP_cronograma',  'Este es el cronograma vigente de Técnicas de Programación, con las fechas de entrega de los trabajos prácticos.', 4)
ON CONFLICT (clave) DO UPDATE SET
    texto  = EXCLUDED.texto,
    orden  = EXCLUDED.orden,
    activo = TRUE;

-- ---------------------------------------------------------------------------
-- RESPUEESTA_DOCUMENTO  (adjuntos - una respuesta por materia, un doc por respuesta)
-- ---------------------------------------------------------------------------
INSERT INTO respuesta_documento (respuesta_id, documento_id, orden)
SELECT r.id, d.id, 1
FROM (VALUES
    ('ABD_programa',    'DOC_ABD_PROGRAMA'),
    ('ABD_cronograma',  'DOC_ABD_CRONOGRAMA'),
    ('ABD_condiciones', 'DOC_ABD_CONDICIONES'),
    ('EAM_programa',    'DOC_EAM_PROGRAMA'),
    ('EAM_cronograma',  'DOC_EAM_CRONOGRAMA'),
    ('EAM_condiciones', 'DOC_EAM_CONDICIONES'),
    ('LC_programa',     'DOC_LC_PROGRAMA'),
    ('LC_cronograma',   'DOC_LC_CRONOGRAMA'),
    ('LC_condiciones',  'DOC_LC_CONDICIONES'),
    ('TP_programa',     'DOC_TP_PROGRAMA'),
    ('TP_cronograma',   'DOC_TP_CRONOGRAMA'),
    ('TP_condiciones',  'DOC_TP_CONDICIONES')
) AS x(respuesta_clave, documento_clave)
JOIN respuesta r ON r.clave = x.respuesta_clave
JOIN documento d ON d.clave = x.documento_clave
ON CONFLICT (respuesta_id, documento_id) DO UPDATE SET orden = EXCLUDED.orden;

-- ---------------------------------------------------------------------------
-- OPCION_MENU  (arbol completo)
-- ---------------------------------------------------------------------------
INSERT INTO opcion_menu (clave, categoria_id, etiqueta, tipo, categoria_destino_id, respuesta_id, es_volver, orden) VALUES
-- --- RAIZ
('RAIZ_OP_ADMIN', (SELECT id FROM categoria WHERE clave='RAIZ'), 'Consultas administrativas', 'navegar',
 (SELECT id FROM categoria WHERE clave='ADMINISTRATIVAS'), NULL, FALSE, 1),
('RAIZ_OP_ACAD',  (SELECT id FROM categoria WHERE clave='RAIZ'), 'Consultas academicas', 'navegar',
 (SELECT id FROM categoria WHERE clave='ACADEMICAS'), NULL, FALSE, 2),
('RAIZ_OP_NOFUE', (SELECT id FROM categoria WHERE clave='RAIZ'), 'No encontre lo que busco', 'derivar',
 NULL, NULL, FALSE, 3),

-- --- ADMINISTRATIVAS
('ADM_OP_VOLVER',      (SELECT id FROM categoria WHERE clave='ADMINISTRATIVAS'), '< Volver al menu anterior', 'navegar',
 (SELECT id FROM categoria WHERE clave='RAIZ'), NULL, TRUE, 1),
('ADM_OP_INSCRIPCIONES', (SELECT id FROM categoria WHERE clave='ADMINISTRATIVAS'), 'Inscripciones', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ADM_INSCRIPCIONES'), FALSE, 2),
('ADM_OP_EXAMENES',    (SELECT id FROM categoria WHERE clave='ADMINISTRATIVAS'), 'Examenes/Mesas', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ADM_EXAMENES_MESAS'), FALSE, 3),
('ADM_OP_SIU',         (SELECT id FROM categoria WHERE clave='ADMINISTRATIVAS'), 'Acceso al SIU', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ADM_ACCESO_SIU'), FALSE, 4),
('ADM_OP_SIU_CAMPUS',  (SELECT id FROM categoria WHERE clave='ADMINISTRATIVAS'), 'Diferencias entre campus virtual y SIU', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ADM_SIU_VS_CAMPUS'), FALSE, 5),

-- --- ACADEMICAS
('ACA_OP_VOLVER', (SELECT id FROM categoria WHERE clave='ACADEMICAS'), '< Volver al menu anterior', 'navegar',
 (SELECT id FROM categoria WHERE clave='RAIZ'), NULL, TRUE, 1),
('ACA_OP_ABD',    (SELECT id FROM categoria WHERE clave='ACADEMICAS'), 'Administracion de Base de Datos', 'navegar',
 (SELECT id FROM categoria WHERE clave='M_ADMIN_BASE_DATOS'), NULL, FALSE, 2),
('ACA_OP_EAM',    (SELECT id FROM categoria WHERE clave='ACADEMICAS'), 'Analisis Matematico', 'navegar',
 (SELECT id FROM categoria WHERE clave='M_ANALISIS_MATEMATICO'), NULL, FALSE, 3),
('ACA_OP_LC',     (SELECT id FROM categoria WHERE clave='ACADEMICAS'), 'Logica Computacional', 'navegar',
 (SELECT id FROM categoria WHERE clave='M_LOGICA_COMPUTACIONAL'), NULL, FALSE, 4),
('ACA_OP_TP',     (SELECT id FROM categoria WHERE clave='ACADEMICAS'), 'Tecnicas de Programacion', 'navegar',
 (SELECT id FROM categoria WHERE clave='M_TECNICAS_PROGRAMACION'), NULL, FALSE, 5),

-- --- M_ADMIN_BASE_DATOS
('ABD_OP_VOLVER', (SELECT id FROM categoria WHERE clave='M_ADMIN_BASE_DATOS'), '< Volver al menu anterior', 'navegar',
 (SELECT id FROM categoria WHERE clave='ACADEMICAS'), NULL, TRUE, 1),
('ABD_OP_DIAS',   (SELECT id FROM categoria WHERE clave='M_ADMIN_BASE_DATOS'), 'Dias de cursada por comision', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ABD_dias_cursada'), FALSE, 2),
('ABD_OP_COND',   (SELECT id FROM categoria WHERE clave='M_ADMIN_BASE_DATOS'), 'Condiciones de aprobacion', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ABD_condiciones'), FALSE, 3),
('ABD_OP_PROG',   (SELECT id FROM categoria WHERE clave='M_ADMIN_BASE_DATOS'), 'Programa', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ABD_programa'), FALSE, 4),
('ABD_OP_CRONO',  (SELECT id FROM categoria WHERE clave='M_ADMIN_BASE_DATOS'), 'Cronograma', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='ABD_cronograma'), FALSE, 5),

-- --- M_ANALISIS_MATEMATICO
('EAM_OP_VOLVER', (SELECT id FROM categoria WHERE clave='M_ANALISIS_MATEMATICO'), '< Volver al menu anterior', 'navegar',
 (SELECT id FROM categoria WHERE clave='ACADEMICAS'), NULL, TRUE, 1),
('EAM_OP_DIAS',   (SELECT id FROM categoria WHERE clave='M_ANALISIS_MATEMATICO'), 'Dias de cursada por comision', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='EAM_dias_cursada'), FALSE, 2),
('EAM_OP_COND',   (SELECT id FROM categoria WHERE clave='M_ANALISIS_MATEMATICO'), 'Condiciones de aprobacion', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='EAM_condiciones'), FALSE, 3),
('EAM_OP_PROG',   (SELECT id FROM categoria WHERE clave='M_ANALISIS_MATEMATICO'), 'Programa', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='EAM_programa'), FALSE, 4),
('EAM_OP_CRONO',  (SELECT id FROM categoria WHERE clave='M_ANALISIS_MATEMATICO'), 'Cronograma', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='EAM_cronograma'), FALSE, 5),

-- --- M_LOGICA_COMPUTACIONAL
('LC_OP_VOLVER',  (SELECT id FROM categoria WHERE clave='M_LOGICA_COMPUTACIONAL'), '< Volver al menu anterior', 'navegar',
 (SELECT id FROM categoria WHERE clave='ACADEMICAS'), NULL, TRUE, 1),
('LC_OP_DIAS',    (SELECT id FROM categoria WHERE clave='M_LOGICA_COMPUTACIONAL'), 'Dias de cursada por comision', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='LC_dias_cursada'), FALSE, 2),
('LC_OP_COND',    (SELECT id FROM categoria WHERE clave='M_LOGICA_COMPUTACIONAL'), 'Condiciones de aprobacion', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='LC_condiciones'), FALSE, 3),
('LC_OP_PROG',    (SELECT id FROM categoria WHERE clave='M_LOGICA_COMPUTACIONAL'), 'Programa', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='LC_programa'), FALSE, 4),
('LC_OP_CRONO',   (SELECT id FROM categoria WHERE clave='M_LOGICA_COMPUTACIONAL'), 'Cronograma', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='LC_cronograma'), FALSE, 5),

-- --- M_TECNICAS_PROGRAMACION
('TP_OP_VOLVER',  (SELECT id FROM categoria WHERE clave='M_TECNICAS_PROGRAMACION'), '< Volver al menu anterior', 'navegar',
 (SELECT id FROM categoria WHERE clave='ACADEMICAS'), NULL, TRUE, 1),
('TP_OP_DIAS',    (SELECT id FROM categoria WHERE clave='M_TECNICAS_PROGRAMACION'), 'Dias de cursada por comision', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='TP_dias_cursada'), FALSE, 2),
('TP_OP_COND',    (SELECT id FROM categoria WHERE clave='M_TECNICAS_PROGRAMACION'), 'Condiciones de aprobacion', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='TP_condiciones'), FALSE, 3),
('TP_OP_PROG',    (SELECT id FROM categoria WHERE clave='M_TECNICAS_PROGRAMACION'), 'Programa', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='TP_programa'), FALSE, 4),
('TP_OP_CRONO',   (SELECT id FROM categoria WHERE clave='M_TECNICAS_PROGRAMACION'), 'Cronograma', 'responder',
 NULL, (SELECT id FROM respuesta WHERE clave='TP_cronograma'), FALSE, 5)
ON CONFLICT (clave) DO UPDATE SET
    categoria_id         = EXCLUDED.categoria_id,
    etiqueta             = EXCLUDED.etiqueta,
    tipo                 = EXCLUDED.tipo,
    categoria_destino_id = EXCLUDED.categoria_destino_id,
    respuesta_id         = EXCLUDED.respuesta_id,
    es_volver            = EXCLUDED.es_volver,
    orden                = EXCLUDED.orden,
    activo               = TRUE;

-- ---------------------------------------------------------------------------
-- OPCION_CONTACTO  (derivaciones - RF04)
-- ---------------------------------------------------------------------------
INSERT INTO opcion_contacto (opcion_id, contacto_id, orden)
SELECT o.id, c.id, x.orden
FROM (VALUES
    ('RAIZ_OP_NOFUE', 'tutoria_academica',  1),
    ('RAIZ_OP_NOFUE', 'bedelia',            2),
    ('RAIZ_OP_NOFUE', 'advisory_pedagogica', 3)
) AS x(opcion_clave, contacto_clave, orden)
JOIN opcion_menu o ON o.clave = x.opcion_clave
JOIN contacto    c ON c.clave = x.contacto_clave
ON CONFLICT (opcion_id, contacto_id) DO UPDATE SET orden = EXCLUDED.orden;

-- ---------------------------------------------------------------------------
-- CONTEXTO  (datos institucionales y por comision - RF06)
-- `grupo` permite agrupar valores y armar submenus contextuales.
-- ---------------------------------------------------------------------------
INSERT INTO contexto (clave, nombre, valor, ambito_tipo, ambito_clave, grupo, orden) VALUES
('url_campus_virtual',   'Campus Virtual',       'https://aulasvirtuales.bue.edu.ar/',                     NULL, NULL, 'institucional', 1),
('url_siu',              'SIU Guaraní',          'https://guarani-autogestionagencia.bue.edu.ar/acceso',   NULL, NULL, 'institucional', 2),
('email_bedelia',        'Bedelía',              'bedelia.ifts29@bue.edu.ar',                              NULL, NULL, 'institucional', 3),
('cuatrimestre_vigente', 'Cuatrimestre vigente', '2C 2026',                                                NULL, NULL, 'institucional', 4),
('modalidad',            'Modalidad',            'Virtual sincrónica',                                     NULL, NULL, 'institucional', 5),
('dias_cursada', 'Comisión A', 'Lunes y Miércoles de 18:00 a 21:00 hs', 'comision', 'comision_a', 'dias_cursada', 1),
('dias_cursada', 'Comisión B', 'Martes y Jueves de 8:00 a 11:00 hs',    'comision', 'comision_b', 'dias_cursada', 2),
('dias_cursada', 'Comisión C', 'Viernes de 14:00 a 20:00 hs',           'comision', 'comision_c', 'dias_cursada', 3)
ON CONFLICT (clave, COALESCE(ambito_tipo,'global'), COALESCE(ambito_clave,'')) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    valor  = EXCLUDED.valor,
    grupo  = EXCLUDED.grupo,
    orden  = EXCLUDED.orden,
    activo = TRUE;

COMMIT;

-- ---------------------------------------------------------------------------
-- Consultas de verificacion
-- ---------------------------------------------------------------------------
-- SELECT * FROM v_arbol_menu;
-- SELECT opcion_clave, evento, total FROM metrica_opcion ORDER BY total DESC;
