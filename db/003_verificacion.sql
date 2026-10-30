-- ============================================================================
-- 003_verificacion.sql
-- Ejecuta consultas equivalentes a las que usa la aplicacion contra PostgreSQL
-- real, con las claves del contenido vigente de la planilla.
--
--   docker exec -i postgres-ifts29 psql -U postgres -d ifts29 -v ON_ERROR_STOP=1 -f db/003_verificacion.sql
--
-- Sirve para detectar desajustes entre el SQL de la aplicacion y el esquema
-- real (nombres de columnas, joins, filtros) y para revisar el contenido cargado.
-- Las secciones que escriben (metricas, sincronizacion) van dentro de una
-- transaccion que se revierte: no dejan datos ni tocan los IDs de Drive.
-- ============================================================================

\set ON_ERROR_STOP on
\pset pager off

\echo '=== 1. Categoria raiz (RAIZ) ==='
SELECT id, clave, nombre, mensaje, orden, es_raiz
  FROM categoria
 WHERE clave = 'RAIZ' AND activo;

\echo ''
\echo '=== 2. Opciones del menu raiz ==='
SELECT o.id, o.clave, o.etiqueta, o.tipo, o.es_volver, o.orden
  FROM opcion_menu o
 WHERE o.categoria_id = (SELECT id FROM categoria WHERE clave = 'RAIZ') AND o.activo
 ORDER BY o.orden, o.id;

\echo ''
\echo '=== 3. Opcion por clave (ABD_OP_PROG) ==='
SELECT o.id, o.clave, o.etiqueta, o.descripcion, o.tipo, o.es_volver, o.icono,
       o.respuesta_id, o.categoria_destino_id, c.clave AS categoria_clave
  FROM opcion_menu o
  JOIN categoria c ON c.id = o.categoria_id
 WHERE o.clave = 'ABD_OP_PROG' AND o.activo AND c.activo;

\echo ''
\echo '=== 4. Destino de navegacion (ACA_OP_ABD -> M_ADMIN_BASE_DATOS) ==='
SELECT o.clave AS opcion, cd.clave AS destino
  FROM opcion_menu o
  JOIN categoria cd ON cd.id = o.categoria_destino_id
 WHERE o.clave = 'ACA_OP_ABD';

\echo ''
\echo '=== 5. Respuesta de una opcion (ABD_OP_PROG) ==='
SELECT r.id, r.clave, LEFT(r.texto, 60) AS texto
  FROM opcion_menu o
  JOIN respuesta r ON r.id = o.respuesta_id
 WHERE o.clave = 'ABD_OP_PROG' AND r.activo;

\echo ''
\echo '=== 6. Documentos adjuntos de ABD_OP_CRONO (A y B: pregunta de comision) ==='
SELECT d.clave, d.mime_type, d.vigente, d.estado, d.sincronizado_en
  FROM opcion_menu o
  JOIN respuesta_documento rd ON rd.respuesta_id = o.respuesta_id
  JOIN documento d            ON d.id = rd.documento_id
 WHERE o.clave = 'ABD_OP_CRONO' AND d.estado <> 'archivado'
 ORDER BY rd.orden, d.id;

\echo ''
\echo '=== 7. Contactos de derivacion (DERIVACION_OP_TRAMITES) ==='
SELECT c.clave, c.nombre, c.area, c.email, c.url_perfil, c.motivo
  FROM opcion_menu o
  JOIN opcion_contacto oc ON oc.opcion_id = o.id
  JOIN contacto c         ON c.id = oc.contacto_id
 WHERE o.clave = 'DERIVACION_OP_TRAMITES' AND c.activo
 ORDER BY oc.orden, c.id;

\echo ''
\echo '=== 8. Metrica anonima: UPSERT (se revierte) ==='
BEGIN;
INSERT INTO metrica_opcion (opcion_clave, categoria_clave, evento, total)
VALUES ('ABD_OP_PROG', NULL, 'seleccion', 1)
ON CONFLICT (opcion_clave, evento, fecha)
DO UPDATE SET total = metrica_opcion.total + 1;

SELECT opcion_clave, evento, total FROM metrica_opcion
 WHERE opcion_clave = 'ABD_OP_PROG' AND evento = 'seleccion' AND fecha = CURRENT_DATE;
ROLLBACK;

\echo ''
\echo '=== 9. Sincronizacion: UPDATE de documento (se revierte) ==='
BEGIN;
UPDATE documento
   SET drive_file_id        = '1TESTdriveFileId0000000000000000',
       drive_view_url       = 'https://drive.google.com/file/d/1TESTdriveFileId0000000000000000/view',
       drive_url            = 'https://drive.google.com/uc?export=download&id=1TESTdriveFileId0000000000000000',
       drive_md5            = 'deadbeef',
       drive_modified_time  = now(),
       sincronizado_en      = now(),
       actualizado_en       = now(),
       vigente              = TRUE,
       estado               = 'vigente'
 WHERE clave = 'TP_programa_2026_1C';

SELECT clave, nombre, drive_view_url, vigente, estado, sincronizado_en
  FROM documento WHERE clave = 'TP_programa_2026_1C';
ROLLBACK;

\echo ''
\echo '=== 10. Cobertura: documentos adjuntos por materia ==='
SELECT c.clave AS categoria,
       COUNT(d.id) AS documentos_adjuntos
  FROM categoria c
  JOIN opcion_menu o         ON o.categoria_id = c.id AND o.tipo = 'responder'
  JOIN respuesta_documento rd ON rd.respuesta_id = o.respuesta_id
  JOIN documento d            ON d.id = rd.documento_id
 WHERE c.clave LIKE 'M\_%'
 GROUP BY c.clave
 ORDER BY c.clave;

\echo ''
\echo '=== 11. Vista de mantenimiento v_arbol_menu (menu raiz y una materia) ==='
SELECT categoria_clave, opcion_clave, opcion_tipo, es_volver,
       respuesta_clave, documento_clave, documento_estado
  FROM v_arbol_menu
 WHERE categoria_clave IN ('RAIZ', 'M_TECNICAS_PROGRAMACION')
 ORDER BY orden;

\echo ''
\echo '=== 12. Trigger de actualizado_en ==='
SELECT clave, creado_en, actualizado_en FROM categoria WHERE clave = 'RAIZ';

-- ---------------------------------------------------------------------------
-- Base de conocimiento conversacional
-- ---------------------------------------------------------------------------

\echo ''
\echo '=== 13. Volumen de la base de conocimiento ==='
SELECT (SELECT COUNT(*) FROM kb_intencion)         AS intenciones,
       (SELECT COUNT(*) FROM kb_pregunta)          AS preguntas,
       (SELECT COUNT(*) FROM kb_pregunta_variante) AS variantes,
       (SELECT COUNT(*) FROM kb_alias)             AS alias,
       (SELECT COUNT(*) FROM kb_termino_ignorado)  AS ignorados;

\echo ''
\echo '=== 14. Integridad referencial de la KB (todas deben dar 0) ==='
-- Una intencion sin opcion o sin respuesta, o una variante huerfana, hacen que
-- la consulta escrita no pueda devolver una respuesta autorizada.
SELECT 'intencion sin opcion activa en el menu' AS problema, COUNT(*) AS cantidad
  FROM kb_intencion i
  LEFT JOIN opcion_menu o ON o.clave = i.opcion_clave AND o.activo
 WHERE i.activo AND o.clave IS NULL
UNION ALL
SELECT 'intencion sin respuesta en su opcion', COUNT(*)
  FROM kb_intencion i
  JOIN opcion_menu o    ON o.clave = i.opcion_clave
  LEFT JOIN respuesta r ON r.id = o.respuesta_id
 WHERE i.activo AND o.tipo = 'responder' AND r.id IS NULL
UNION ALL
SELECT 'pregunta sin intencion activa', COUNT(*)
  FROM kb_pregunta p
  LEFT JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
 WHERE p.activo AND i.id IS NULL
UNION ALL
SELECT 'variante sin pregunta', COUNT(*)
  FROM kb_pregunta_variante v
  LEFT JOIN kb_pregunta p ON p.id = v.pregunta_id
 WHERE p.id IS NULL;

\echo ''
\echo '=== 15. Cada intencion reutiliza una opcion y una respuesta del menu ==='
-- No hay texto nuevo: la consulta escrita devuelve lo que ya muestra el menu.
SELECT i.clave            AS intencion,
       o.clave            AS opcion,
       o.tipo             AS tipo_opcion,
       c.clave            AS categoria,
       (r.id IS NOT NULL) AS tiene_respuesta,
       LEFT(r.texto, 40)  AS respuesta
  FROM kb_intencion i
  JOIN opcion_menu o ON o.clave = i.opcion_clave
  JOIN categoria c   ON c.id = o.categoria_id
  LEFT JOIN respuesta r ON r.id = o.respuesta_id
 WHERE i.activo
 ORDER BY i.clave;

\echo ''
\echo '=== 16. Coincidencia EXACTA: cuando hay que pedir ACLARACION ==='
-- La consulta se resuelve primero por igualdad de `normalized_text` (B-tree).
-- Si el texto coincide con variantes de MAS de una intencion, el motor pide
-- aclaracion con esas opciones del menu.
-- Textos ya normalizados (alias expandidos, sin palabras vacias), como los ve el motor.
WITH consultas(texto) AS (
  VALUES ('programa administracion bases datos'),
         ('condiciones aprobacion administracion bases datos'),
         ('administracion bases datos'),
         ('dias cursada')
)
SELECT q.texto,
       COUNT(DISTINCT p.intencion_id) AS intenciones,
       CASE WHEN COUNT(DISTINCT p.intencion_id) = 0 THEN 'sin coincidencia exacta'
            WHEN COUNT(DISTINCT p.intencion_id) = 1 THEN 'respuesta directa'
            ELSE 'ACLARACION' END      AS desenlace,
       string_agg(DISTINCT i.clave, ', ' ORDER BY i.clave) AS intenciones_clave
  FROM consultas q
  LEFT JOIN kb_pregunta_variante v ON v.normalized_text = q.texto AND v.activo
  LEFT JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
  LEFT JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
 GROUP BY q.texto
 ORDER BY q.texto;

\echo ''
\echo '=== 17. Cobertura por termino (aproximacion de la busqueda por palabras) ==='
-- Terminos de la consulta sin los ignorados, y similitud por termino contra las
-- palabras de cada variante (word_similarity). Un termino que aparece exacto no
-- cuenta aca: lo cubre la busqueda de palabras. Es una referencia para revisar
-- vocabulario, no el calculo exacto de la aplicacion.
-- Textos ya normalizados. "una", "como" y "para" están en `ignorados`.
WITH consultas(texto) AS (
  VALUES ('horario cursada'),
         ('condicons administracion bases datos'),
         ('como me inscribo una materia'),
         ('tiempo libre')
),
terminos AS (
  SELECT q.texto, t.termino
    FROM consultas q
    CROSS JOIN LATERAL unnest(string_to_array(q.texto, ' ')) AS t(termino)
   WHERE length(t.termino) >= 4
     AND t.termino NOT IN (SELECT termino FROM kb_termino_ignorado)
),
candidatos AS (
  SELECT tm.texto, tm.termino, i.clave AS intencion,
         MAX(word_similarity(tm.termino, v.normalized_text)) AS similitud
    FROM terminos tm
    JOIN kb_pregunta_variante v ON v.activo
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
   GROUP BY tm.texto, tm.termino, i.clave
)
SELECT texto, termino, intencion, ROUND(similitud::numeric, 3) AS similitud
  FROM candidatos
 WHERE similitud >= 0.6 AND similitud < 1
 ORDER BY texto, similitud DESC;

\echo ''
\echo '=== 18. Columnas de busqueda (search_vector e indice GIN) ==='
SELECT attname, attgenerated
  FROM pg_attribute
 WHERE attrelid = 'kb_pregunta_variante'::regclass
   AND attname = 'search_vector' AND NOT attisdropped;

SELECT indexname FROM pg_indexes
 WHERE tablename = 'kb_pregunta_variante'
   AND indexname IN ('kb_variante_fts_idx', 'kb_variante_trgm_idx', 'kb_variante_normalized_idx')
 ORDER BY indexname;

\echo ''
\echo '=== 19. Cobertura por intencion (vista v_kb_resolucion) ==='
SELECT intencion_clave, opcion_clave, priority, minimum_threshold,
       variantes, LEFT(pregunta, 46) AS pregunta
  FROM v_kb_resolucion
 ORDER BY domain, intencion_clave, priority DESC;

\echo ''
\echo '=== 20. Textos compartidos entre intenciones (disparan ACLARACION) ==='
-- No es un error: son las redacciones genericas que existen en varias materias
-- a proposito, para que el motor pregunte en lugar de adivinar.
SELECT v.normalized_text,
       COUNT(DISTINCT p.id)           AS preguntas,
       COUNT(DISTINCT p.intencion_id) AS intenciones,
       string_agg(DISTINCT i.clave, ', ' ORDER BY i.clave) AS intenciones_clave
  FROM kb_pregunta_variante v
  JOIN kb_pregunta p   ON p.id = v.pregunta_id AND p.activo
  JOIN kb_intencion i  ON i.id = p.intencion_id AND i.activo
 WHERE v.activo
 GROUP BY v.normalized_text
HAVING COUNT(DISTINCT p.intencion_id) > 1
 ORDER BY intenciones DESC, v.normalized_text;
