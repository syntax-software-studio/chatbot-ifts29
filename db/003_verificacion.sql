-- ============================================================================
-- 003_verificacion.sql
-- Ejecuta exactamente las mismas consultas que la capa de datos
-- (backend/src/db/catalogo.ts) contra PostgreSQL real.
--
--   docker exec -i ifts29-pgtest psql -U postgres -d ifts29 -f 003_verificacion.sql
--
-- Sirve para detectar desajustes entre el SQL de la aplicación y el esquema
-- real (nombres de columnas, joins, filtros) sin depender de una conexión
-- de red. Todas las consultas deben devolver filas, nunca un error.
-- ============================================================================

\set ON_ERROR_STOP on
\pset pager off

\echo '=== 1. SQL_CATEGORIA_POR_CLAVE (RAIZ) ==='
SELECT id, clave, nombre, mensaje, orden, es_raiz
  FROM categoria
 WHERE clave = 'RAIZ' AND activo
 LIMIT 1;

\echo ''
\echo '=== 2. SQL_OPCIONES (opciones de RAIZ) ==='
SELECT o.id, o.clave, o.etiqueta, o.descripcion, o.tipo, o.es_volver, o.icono
  FROM opcion_menu o
 WHERE o.categoria_id = (SELECT id FROM categoria WHERE clave = 'RAIZ') AND o.activo
 ORDER BY o.orden, o.id;

\echo ''
\echo '=== 3. SQL_OPCION_POR_CLAVE (TP_OP_PROG) ==='
SELECT o.id, o.clave, o.etiqueta, o.descripcion, o.tipo, o.es_volver, o.icono,
       o.respuesta_id, o.categoria_destino_id, c.clave AS categoria_clave
  FROM opcion_menu o
  JOIN categoria c ON c.id = o.categoria_id
 WHERE o.clave = 'TP_OP_PROG' AND o.activo AND c.activo
 LIMIT 1;

\echo ''
\echo '=== 4. Destino de navegacion (RAIZ_OP_ADMIN -> ADMINISTRATIVAS) ==='
SELECT clave FROM categoria
 WHERE id = (SELECT categoria_destino_id FROM opcion_menu WHERE clave = 'RAIZ_OP_ADMIN');

\echo ''
\echo '=== 5. SQL_RESPUESTA (programa de Tecnicas de Programacion) ==='
SELECT r.id, r.clave, r.texto
  FROM respuesta r
 WHERE r.clave = 'TP_programa' AND r.activo
 LIMIT 1;

\echo ''
\echo '=== 6. SQL_DOCUMENTOS_DE_RESPUESTA (adjuntos) ==='
SELECT d.id, d.clave, d.nombre, d.descripcion, d.tipo, d.mime_type,
       d.drive_view_url, d.vigente, d.estado, d.actualizado_en, d.sincronizado_en
  FROM respuesta_documento rd
  JOIN documento d ON d.id = rd.documento_id
 WHERE rd.respuesta_id = (SELECT id FROM respuesta WHERE clave = 'TP_programa')
   AND d.estado <> 'archivado'
 ORDER BY rd.orden, d.id;

\echo ''
\echo '=== 7. SQL_CONTACTOS_DE_OPCION (derivacion) ==='
SELECT c.id, c.clave, c.nombre, c.area, c.email,
       c.url_perfil, c.motivo
  FROM opcion_contacto oc
  JOIN contacto c ON c.id = oc.contacto_id
 WHERE oc.opcion_id = (SELECT id FROM opcion_menu WHERE clave = 'RAIZ_OP_NOFUE') AND c.activo
 ORDER BY oc.orden, c.id;

\echo ''
\echo '=== 10. Metrica anonima: UPSERT ==='
INSERT INTO metrica_opcion (opcion_clave, categoria_clave, evento, total)
VALUES ('RAIZ_OP_ADMIN', NULL, 'seleccion', 1)
ON CONFLICT (opcion_clave, evento, fecha)
DO UPDATE SET total = metrica_opcion.total + 1;

SELECT opcion_clave, evento, total FROM metrica_opcion
 WHERE opcion_clave = 'RAIZ_OP_ADMIN' AND evento = 'seleccion' AND fecha = CURRENT_DATE;

\echo ''
\echo '=== 11. Sincronizacion: UPDATE de documento (simula Drive) ==='
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
 WHERE clave = 'DOC_TP_PROGRAMA';

SELECT clave, nombre, drive_view_url, vigente, estado, sincronizado_en
  FROM documento WHERE clave = 'DOC_TP_PROGRAMA';

-- Se restaura el estado inicial para no dejar datos de prueba.
UPDATE documento
   SET drive_file_id = NULL, drive_view_url = NULL, drive_url = NULL,
       drive_md5 = NULL, drive_modified_time = NULL, sincronizado_en = NULL,
       actualizado_en = now(), vigente = TRUE, estado = 'vigente'
 WHERE clave = 'DOC_TP_PROGRAMA';

DELETE FROM metrica_opcion WHERE opcion_clave = 'RAIZ_OP_ADMIN' AND fecha = CURRENT_DATE;

\echo ''
\echo '=== 12. Cobertura: cada materia tiene sus 3 documentos ==='
SELECT c.clave  AS categoria,
       COUNT(d.id) AS documentos_adjuntos
  FROM categoria c
  JOIN opcion_menu o            ON o.categoria_id = c.id AND o.tipo = 'responder'
  JOIN respuesta_documento rd    ON rd.respuesta_id = o.respuesta_id
  JOIN documento d               ON d.id = rd.documento_id
 WHERE c.clave LIKE 'M\_%'
 GROUP BY c.clave
 ORDER BY c.clave;

\echo ''
\echo '=== 13. Vista de mantenimiento v_arbol_menu ==='
SELECT categoria_clave, opcion_clave, opcion_tipo, es_volver,
       respuesta_clave, documento_clave, documento_estado
  FROM v_arbol_menu
 WHERE categoria_clave IN ('RAIZ', 'M_TECNICAS_PROGRAMACION')
 ORDER BY orden;

\echo ''
\echo '=== 14. Trigger de actualizado_en ==='
SELECT clave, creado_en, actualizado_en FROM categoria WHERE clave = 'RAIZ';

-- ---------------------------------------------------------------------------
-- Base de conocimiento conversacional (001 + 005)
-- ---------------------------------------------------------------------------

\echo ''
\echo '=== 15. Volumen de la base de conocimiento ==='
SELECT (SELECT COUNT(*) FROM kb_intencion)         AS intenciones,
       (SELECT COUNT(*) FROM kb_pregunta)          AS preguntas,
       (SELECT COUNT(*) FROM kb_pregunta_variante) AS variantes;

\echo ''
\echo '=== 16. Integridad referencial de la KB (todas deben dar 0) ==='
-- Una intencion sin opcion o sin respuesta, o una variante huerfana, hacen que
-- la consulta escrita no pueda devolver una respuesta autorizada.
SELECT 'intencion sin opcion activa en el menu' AS problema, COUNT(*) AS cantidad
  FROM kb_intencion i
  LEFT JOIN opcion_menu o ON o.clave = i.opcion_clave AND o.activo
 WHERE o.clave IS NULL
UNION ALL
SELECT 'intencion sin opcion de respuesta', COUNT(*)
  FROM kb_intencion i
  JOIN opcion_menu o   ON o.clave = i.opcion_clave
  LEFT JOIN respuesta r ON r.id = o.respuesta_id
 WHERE i.activo AND o.respuesta_id IS NOT NULL AND r.id IS NULL
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
\echo '=== 17. Cada intencion reutiliza una opcion y una respuesta del menu ==='
-- No hay texto nuevo: la consulta escrita devuelve lo que ya muestra el menu.
SELECT i.clave            AS intencion,
       o.clave            AS opcion,
       o.tipo             AS tipo_opcion,
       c.clave            AS categoria,
       (r.id IS NOT NULL) AS tiene_respuesta,
       LEFT(r.texto, 40)  AS respuesta
  FROM kb_intencion i
  JOIN opcion_menu o ON o.clave = i.opcion_clave
  JOIN categoria c    ON c.id = o.categoria_id
  LEFT JOIN respuesta r ON r.id = o.respuesta_id
 WHERE i.activo
 ORDER BY i.clave;

\echo ''
\echo '=== 18. Coincidencia EXACTA: cuando hay que pedir ACLARACION ==='
-- La consulta escrita se resuelve primero por igualdad de `normalized_text`
-- (indice B-tree). Si el texto coincide con variantes de MAS de una intencion,
-- el motor NO elige una: pide aclaracion con esas opciones del menu.
WITH consultas(texto) AS (
  VALUES ('como accedo al siu guarani'),
         ('cuando empiezan las clases'),
         ('programa'),
         ('requisitos de admision')
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
\echo '=== 19. Similitud trigram para consultas SIN coincidencia exacta ==='
-- Mismo criterio que la aplicacion (KB_UMBRAL_ALTO=0.90, KB_UMBRAL_MEDIO=0.70,
-- margen de ambiguedad 0.05): por encima del alto responde, entre el medio y
-- el alto pregunta, y por debajo informa que no hay informacion.
WITH consultas(texto) AS (
  VALUES ('como entro al siu guarani'),
         ('cuando arrancan las cursadas'),
         ('inscribirme en una materia'),
         ('quiero cambiarme de comision')
),
candidatos AS (
  SELECT q.texto,
         i.clave AS intencion,
         MAX(similarity(q.texto, v.normalized_text))::numeric AS similitud
    FROM consultas q
    JOIN kb_pregunta_variante v ON v.activo
    JOIN kb_pregunta  p ON p.id = v.pregunta_id AND p.activo
    JOIN kb_intencion i ON i.id = p.intencion_id AND i.activo
   GROUP BY q.texto, i.clave
),
top AS (
  SELECT DISTINCT ON (texto) texto, intencion, similitud
    FROM candidatos
   ORDER BY texto, similitud DESC
)
SELECT texto, intencion, ROUND(similitud, 4) AS similitud,
       CASE WHEN similitud >= 0.90 THEN 'respuesta'
            WHEN similitud >= 0.70 THEN 'aclaracion'
            ELSE 'no_disponible' END AS desenlace
  FROM top
 ORDER BY texto;

\echo ''
\echo '=== 20. Cobertura por intencion (vista v_kb_resolucion) ==='
SELECT intencion_clave, opcion_clave, priority, minimum_threshold,
       variantes, LEFT(pregunta, 46) AS pregunta
  FROM v_kb_resolucion
 ORDER BY domain, intencion_clave, priority DESC;

\echo ''
\echo '=== 21. Textos compartidos entre intenciones (disparan ACLARACION) ==='
-- No es un error: son las redacciones genericas ("programa", "cuando empiezan
-- las clases") que existen en varias materias a proposito, para que el motor
-- pregunte en lugar de adivinar. Sirve para calibrar KB_UMBRAL_MEDIO.
SELECT v.normalized_text,
       COUNT(DISTINCT p.id)      AS preguntas,
       COUNT(DISTINCT p.intencion_id) AS intenciones,
       string_agg(DISTINCT i.clave, ', ' ORDER BY i.clave) AS intenciones_clave
  FROM kb_pregunta_variante v
  JOIN kb_pregunta p   ON p.id = v.pregunta_id AND p.activo
  JOIN kb_intencion i  ON i.id = p.intencion_id AND i.activo
 WHERE v.activo
 GROUP BY v.normalized_text
HAVING COUNT(DISTINCT p.intencion_id) > 1
 ORDER BY intenciones DESC, v.normalized_text;

\echo ''
\echo '=== 22. Eventos de metrica registrados hasta ahora ==='
-- El flujo escrito agrega texto_exacto / texto_similar / texto_regla /
-- aclaracion / no_disponible. No guarda el texto de la consulta.
SELECT evento, COUNT(*) AS filas, SUM(total) AS eventos
  FROM metrica_opcion
 GROUP BY evento
 ORDER BY evento;

\echo ''
\echo 'VERIFICACION COMPLETA'
