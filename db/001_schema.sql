-- ============================================================================
--  Asistente Virtual Institucional - IFTS N.29 (Syntax SRL)
--  001_schema.sql - Esquema relacional para PostgreSQL (Neon y Docker local)
--
--  Contiene las dos mitades del sistema, que son un solo sistema:
--    * el menu guiado (categorias, opciones, respuestas, documentos, contactos)
--    * la base de conocimiento que permite responder consultas escritas
--  Las consultas escritas no agregan contenido: cada intencion esta atada a una
--  opcion del menu y a una respuesta ya validada, asi que el texto libre solo
--  localiza lo que ya existe.
--
--  Este archivo es ESTRUCTURA. No contiene datos: el contenido entra por la
--  sincronizacion desde la planilla de Google (npm run sync). Es el estado
--  final del esquema, sin ALTER: una base nueva queda igual que una base
--  creada desde cero.
--
--  Principios de diseño:
--   * No se almacenan datos personales ni identificadores de estudiantes.
--     El sistema es público, anónimo y de solo lectura (RNF05).
--   * El menú es un árbol genérico (categoria -> opcion -> respuesta o
--     subcategoria). Una pregunta es una categoria; una subpregunta es una
--     opcion que abre otra categoria (RNF10).
--   * `normalized_text` (KB) es el texto ya normalizado por el MISMO
--     normalizador que usa la API, para que el indice y los umbrales de
--     similitud sean comparables.
--
--  Indices de la base de conocimiento:
--   * B-tree sobre `normalized_text` para la coincidencia EXACTA (Nivel A).
--   * GIN tsvector para full-text search (Nivel B_FTS, config `spanish`).
--   * GIN con `gin_trgm_ops` para la similitud trigram (Nivel B_TRG, `pg_trgm`).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. CATEGORIA  ->  nodos del árbol conversacional
--    Una categoría agrupa opciones y define el mensaje del bot al entrar.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categoria (
    id              SERIAL PRIMARY KEY,
    clave           TEXT        NOT NULL UNIQUE,
    nombre          TEXT        NOT NULL,
    mensaje         TEXT,
    orden           INTEGER     NOT NULL DEFAULT 0,
    es_raiz         BOOLEAN     NOT NULL DEFAULT FALSE,
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  categoria              IS 'Nodos del arbol del menu (RF05).';
COMMENT ON COLUMN categoria.mensaje       IS 'Mensaje del bot que se muestra al entrar a la categoria.';
COMMENT ON COLUMN categoria.es_raiz       IS 'TRUE solo para la categoria inicial que muestra el saludo.';

-- ---------------------------------------------------------------------------
-- 2. RESPUESTA  ->  texto institucional validado que muestra el bot
--    Unico lugar donde vive el contenido institucional: ni el menu ni el
--    texto libre guardan texto propio.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS respuesta (
    id              SERIAL PRIMARY KEY,
    clave           TEXT        NOT NULL UNIQUE,
    texto           TEXT        NOT NULL,
    orden           INTEGER     NOT NULL DEFAULT 0,
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE respuesta IS 'Respuestas predefinidas validadas por la institucion.';

-- ---------------------------------------------------------------------------
-- 3. OPCION_MENU  ->  botones que el estudiante puede tocar
--    tipo = 'navegar'   -> abre otra categoria (subpregunta)
--    tipo = 'responder'  -> muestra el texto de una RESPUESTA (+ documentos)
--    tipo = 'derivar'    -> muestra contactos de derivacion (RF04)
--    Una opcion 'responder' es tambien el destino de las consultas escritas:
--    la base de conocimiento la ubica y devuelve exactamente su respuesta.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS opcion_menu (
    id                  SERIAL PRIMARY KEY,
    clave               TEXT        NOT NULL UNIQUE,
    categoria_id        INTEGER     NOT NULL REFERENCES categoria (id) ON DELETE CASCADE,
    etiqueta            TEXT        NOT NULL,
    descripcion         TEXT,
    tipo                TEXT        NOT NULL DEFAULT 'navegar'
                            CHECK (tipo IN ('navegar', 'responder', 'derivar')),
    categoria_destino_id INTEGER    REFERENCES categoria (id) ON DELETE RESTRICT,
    respuesta_id        INTEGER     REFERENCES respuesta (id) ON DELETE SET NULL,
    es_volver           BOOLEAN     NOT NULL DEFAULT FALSE,
    icono               TEXT,
    orden               INTEGER     NOT NULL DEFAULT 0,
    activo              BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT opcion_menu_destino_ck
        CHECK (
            (tipo = 'navegar'   AND categoria_destino_id IS NOT NULL AND respuesta_id IS NULL)
         OR (tipo = 'responder' AND respuesta_id         IS NOT NULL AND categoria_destino_id IS NULL)
         OR (tipo = 'derivar'   AND categoria_destino_id IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS opcion_menu_categoria_idx ON opcion_menu (categoria_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS opcion_menu_navegar_uniq
    ON opcion_menu (categoria_id, categoria_destino_id)
    WHERE tipo = 'navegar' AND categoria_destino_id IS NOT NULL;

COMMENT ON TABLE  opcion_menu               IS 'Opciones seleccionables del menu, destino final de toda consulta (RF05).';
COMMENT ON COLUMN opcion_menu.tipo            IS 'navegar = subpregunta; responder = respuesta con adjuntos; derivar = contactos (RF04).';
COMMENT ON COLUMN opcion_menu.es_volver     IS 'TRUE para la opcion "< Volver al menu anterior".';
COMMENT ON COLUMN opcion_menu.categoria_destino_id IS 'Categoria a la que navega la opcion.';
COMMENT ON COLUMN opcion_menu.respuesta_id   IS 'Respuesta a mostrar. En tipo derivar es opcional (texto introductorio).';

-- ---------------------------------------------------------------------------
-- 4. DOCUMENTO  ->  ficha del archivo institucional alojado en Google Drive
--    Nunca se guarda el binario: solo el fileId y la metadata de vigencia.
--    (RF07: diferenciar vigente de histórico / reemplazado / de ejemplo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento (
    id                  SERIAL PRIMARY KEY,
    clave               TEXT        NOT NULL UNIQUE,
    nombre              TEXT        NOT NULL,
    descripcion         TEXT,
    tipo                TEXT        NOT NULL DEFAULT 'documento'
                            CHECK (tipo IN ('programa', 'cronograma', 'condiciones_aprobacion',
                                            'instructivo', 'presentacion', 'planilla', 'documento')),
    drive_file_id       TEXT        UNIQUE,
    drive_nombre_archivo TEXT,
    mime_type           TEXT        NOT NULL DEFAULT 'application/pdf',
    drive_url           TEXT,
    drive_view_url      TEXT,
    drive_md5           TEXT,
    drive_modified_time TIMESTAMPTZ,
    drive_carpeta       TEXT,
    vigente             BOOLEAN     NOT NULL DEFAULT TRUE,
    estado              TEXT        NOT NULL DEFAULT 'vigente'
                            CHECK (estado IN ('borrador', 'revision', 'vigente', 'reemplazado', 'archivado')),
    vigencia_desde      DATE,
    vigencia_hasta      DATE,
    observaciones       TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sincronizado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS documento_vigente_idx  ON documento (vigente, estado);
CREATE INDEX IF NOT EXISTS documento_tipo_idx      ON documento (tipo);

COMMENT ON TABLE  documento                   IS 'Documentos institucionales referenciados desde Drive (solo lectura).';
COMMENT ON COLUMN documento.drive_file_id     IS 'Identificador del archivo en Google Drive.';
COMMENT ON COLUMN documento.drive_view_url    IS 'Enlace publico de lectura generado/verificado por la sincronizacion.';
COMMENT ON COLUMN documento.estado            IS 'Ciclo de vida: borrador -> revision -> vigente -> reemplazado/archivado.';

-- ---------------------------------------------------------------------------
-- 5. RESPUESTA_DOCUMENTO  ->  documentos adjuntos a una respuesta
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS respuesta_documento (
    respuesta_id  INTEGER NOT NULL REFERENCES respuesta (id) ON DELETE CASCADE,
    documento_id  INTEGER NOT NULL REFERENCES documento (id) ON DELETE CASCADE,
    orden         INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (respuesta_id, documento_id)
);

CREATE INDEX IF NOT EXISTS respuesta_documento_doc_idx ON respuesta_documento (documento_id);

COMMENT ON TABLE respuesta_documento IS 'Adjuntos (PDF/planilla/slide) vinculados a una respuesta.';

-- ---------------------------------------------------------------------------
-- 6. CONTACTO  ->  derivacion (RF04)
--    El sistema solo MUESTRA los datos; no envia nada ni gestiona tramites.
--    `comision` indica a que comision responde el contacto ('A', 'B', ... o
--    'General').
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contacto (
    id          SERIAL PRIMARY KEY,
    clave       TEXT        NOT NULL UNIQUE,
    nombre      TEXT        NOT NULL,
    area        TEXT,
    email       TEXT,
    url_perfil  TEXT,
    motivo      TEXT,
    comision    TEXT,
    orden       INTEGER     NOT NULL DEFAULT 0,
    activo      BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en   TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  contacto            IS 'Persona o area a la que se deriva la consulta (RF04).';
COMMENT ON COLUMN contacto.motivo     IS 'Motivo de la derivacion, mostrado junto al contacto.';

CREATE TABLE IF NOT EXISTS opcion_contacto (
    opcion_id    INTEGER NOT NULL REFERENCES opcion_menu (id) ON DELETE CASCADE,
    contacto_id  INTEGER NOT NULL REFERENCES contacto (id)  ON DELETE CASCADE,
    orden        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (opcion_id, contacto_id)
);

CREATE INDEX IF NOT EXISTS opcion_contacto_contacto_idx ON opcion_contacto (contacto_id);

-- ---------------------------------------------------------------------------
-- 7. METRICA_OPCION  ->  contadores agregados, sin datos personales (RNF05)
--     Solo se guarda la opcion alcanzada y el desenlace del turno. No hay IP,
--     ni DNI, ni legajo, ni texto de la consulta.
--     `evento` distingue la navegacion del menu del flujo escrito: los cinco
--     valores `texto_*` / `aclaracion` / `no_disponible` dicen si la consulta
--     se resolvio y como, que es lo que permite calibrar la base de conocimiento.
--     Es una tabla de datos historicos: ningun reset debe tocarla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS metrica_opcion (
    opcion_clave    TEXT        NOT NULL,
    categoria_clave TEXT,
    evento          TEXT        NOT NULL DEFAULT 'seleccion'
                        CHECK (evento IN (
                            'seleccion', 'documento_abierto', 'derivacion', 'reinicio', 'error',
                            'texto_exacto', 'texto_similar', 'texto_regla', 'aclaracion', 'no_disponible'
                        )),
    fecha           DATE        NOT NULL DEFAULT CURRENT_DATE,
    total           INTEGER     NOT NULL DEFAULT 0 CHECK (total >= 0),

    PRIMARY KEY (opcion_clave, evento, fecha)
);

COMMENT ON TABLE metrica_opcion IS 'Metricas agregadas y anonimas para detectar vacios en la base de conocimiento.';

COMMENT ON COLUMN metrica_opcion.evento IS
    'Resultado del turno: navegacion del menu o desenlace de una consulta escrita '
    '(texto_exacto, texto_similar, texto_regla, aclaracion, no_disponible).';

-- ===========================================================================
--  BASE DE CONOCIMIENTO  ->  consultas escritas
--
--  El menu obliga a recorrer un arbol de categorias; estas tablas permiten
--  ADEMAS aceptar consultas escritas: el sistema interpreta el texto, ubica la
--  intencion y devuelve la MISMA opcion del menu que ya existia.
--
--  Principios (los mismos de arriba):
--   * Toda intencion esta atada a una opcion de `opcion_menu` y a una
--     `respuesta` ya validada: el texto libre no puede inventar contenido,
--     solo localizarlo.
--   * Versionado con `activo`: desactivar una variante la saca de la busqueda
--     sin borrar el historial.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 8. KB_INTENCION  ->  a que tipo de consulta responde cada opcion del menu
--     `clave` es la identidad estable (no el id) para que la carga sea
--     idempotente y para poder comparar con el catalogo local.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_intencion (
    id              SERIAL PRIMARY KEY,
    clave           TEXT        NOT NULL UNIQUE,
    nombre          TEXT        NOT NULL,
    domain          TEXT        NOT NULL DEFAULT 'administrativo'
                            CHECK (domain IN ('administrativo', 'academico')),
    opcion_clave    TEXT        NOT NULL REFERENCES opcion_menu (clave)
                            ON UPDATE CASCADE ON DELETE RESTRICT,
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE  kb_intencion                IS 'Intenciones conversacionales; cada una reusa una opcion del menu (no inventan respuestas).';
COMMENT ON COLUMN kb_intencion.clave          IS 'Identidad estable de la intencion (ej: dias_cursada_TP).';
COMMENT ON COLUMN kb_intencion.domain         IS 'administrativo (trámites) | academico (materias).';
COMMENT ON COLUMN kb_intencion.opcion_clave   IS 'Opcion del menu que emite la respuesta autorizada.';
COMMENT ON COLUMN kb_intencion.activo         IS 'FALSE = fuera de la busqueda, sin borrar el registro.';

-- ---------------------------------------------------------------------------
-- 9. KB_PREGUNTA  ->  la formulacion canonica de la consulta
--     Una intencion puede tener varias preguntas (por ejemplo, una por materia
--     o una version corta y una larga); el ranking usa `priority`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_pregunta (
    id                SERIAL PRIMARY KEY,
    intencion_id      INTEGER     NOT NULL REFERENCES kb_intencion (id) ON DELETE CASCADE,
    pregunta          TEXT        NOT NULL,
    respuesta_id      INTEGER     REFERENCES respuesta (id) ON DELETE SET NULL,
    priority          INTEGER     NOT NULL DEFAULT 0,
    minimum_threshold NUMERIC(4,3) NOT NULL DEFAULT 0.700
                              CHECK (minimum_threshold >= 0 AND minimum_threshold <= 1),
    activo            BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT kb_pregunta_uniq UNIQUE (intencion_id, pregunta)
);

CREATE INDEX IF NOT EXISTS kb_pregunta_intencion_idx ON kb_pregunta (intencion_id);

COMMENT ON TABLE  kb_pregunta                IS 'Formulaciones canonicas de una intencion.';
COMMENT ON COLUMN kb_pregunta.respuesta_id   IS 'Respuesta autorizada a emitir; NULL deriva en la opcion del menu.';
COMMENT ON COLUMN kb_pregunta.priority       IS 'Orden de presentacion cuando hay que pedir aclaracion (mayor primero).';
COMMENT ON COLUMN kb_pregunta.minimum_threshold IS 'Corte inferior de similitud para esta pregunta (calibrable, D04).';

-- ---------------------------------------------------------------------------
-- 10. KB_PREGUNTA_VARIANTE  ->  las formas en que se puede escribir
--     Una misma pregunta admite varias redacciones; `weight` pondera la
--     variante en el ranking. Las variantes genericas (sin materia, por
--     ejemplo "dias de cursada") se repiten en varias preguntas a proposito:
--     son las que permiten pedir aclaracion en vez de adivinar (D06).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_pregunta_variante (
    id              SERIAL PRIMARY KEY,
    pregunta_id     INTEGER     NOT NULL REFERENCES kb_pregunta (id) ON DELETE CASCADE,
    original_text   TEXT        NOT NULL,
    normalized_text TEXT        NOT NULL,
    weight          NUMERIC(3,2) NOT NULL DEFAULT 1.00
                            CHECK (weight > 0 AND weight <= 1),
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Nivel B_FTS: vector FTS precalculado. El texto normalizado ya no tiene
    -- diacriticos (el normalizador JS los elimino), asi que no hace falta el
    -- wrapper immutable de unaccent.
    search_vector   tsvector
        GENERATED ALWAYS AS (to_tsvector('spanish', normalized_text)) STORED,

    CONSTRAINT kb_variante_uniq UNIQUE (pregunta_id, normalized_text)
);

-- Nivel A: coincidencia exacta por igualdad del texto normalizado.
CREATE INDEX IF NOT EXISTS kb_variante_normalized_idx
    ON kb_pregunta_variante (normalized_text);

-- Nivel B_FTS: full-text search.
CREATE INDEX IF NOT EXISTS kb_variante_fts_idx
    ON kb_pregunta_variante USING GIN (search_vector);

-- Nivel B_TRG: similitud trigram. El GIN acelera el filtro `similarity(...) >= x`.
CREATE INDEX IF NOT EXISTS kb_variante_trgm_idx
    ON kb_pregunta_variante USING GIN (normalized_text gin_trgm_ops);

COMMENT ON TABLE  kb_pregunta_variante         IS 'Redacciones alternativas de una pregunta, ya normalizadas.';
COMMENT ON COLUMN kb_pregunta_variante.weight IS 'Peso de la variante en el ranking (1.00 = formulacion canonica).';

-- ---------------------------------------------------------------------------
-- 10b. KB_ALIAS  ->  siglas y abreviaturas que se expanden antes de buscar
--     Por ejemplo "abd" -> "administracion de bases de datos". Se cargan desde
--     la pestaña `alias` de la planilla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS kb_alias (
    alias       TEXT PRIMARY KEY,
    expansion   TEXT NOT NULL
);

COMMENT ON TABLE kb_alias IS 'Siglas y abreviaturas de la consulta, ya normalizadas, con su expansion.';

-- ---------------------------------------------------------------------------
-- 11. Trigger de mantenimiento: actualizado_en
--     Una sola funcion para todas las tablas con columna `actualizado_en`,
--     del menu y de la base de conocimiento.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION touch_actualizado_en() RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en := now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOREACH t IN ARRAY ARRAY[
        'categoria', 'opcion_menu', 'respuesta',
        'documento', 'contacto',
        'kb_intencion', 'kb_pregunta', 'kb_pregunta_variante'
    ] LOOP
        EXECUTE format('DROP TRIGGER IF EXISTS trg_%1$s_touch ON %1$I', t);
        EXECUTE format(
            'CREATE TRIGGER trg_%1$s_touch BEFORE UPDATE ON %1$I
             FOR EACH ROW EXECUTE FUNCTION touch_actualizado_en()', t);
    END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 12. Vista de lectura del menu para el equipo de mantenimiento (RNF09)
--     Un solo SELECT muestra el arbol completo con sus adjuntos.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_arbol_menu AS
SELECT
    c.clave              AS categoria_clave,
    c.nombre             AS categoria_nombre,
    o.clave              AS opcion_clave,
    o.etiqueta           AS opcion_etiqueta,
    o.tipo               AS opcion_tipo,
    o.es_volver          AS es_volver,
    o.orden              AS orden,
    cd.clave             AS destino_clave,
    cd.nombre            AS destino_nombre,
    cd.mensaje           AS destino_mensaje,
    r.clave              AS respuesta_clave,
    r.texto              AS respuesta_texto,
    d.clave              AS documento_clave,
    d.nombre             AS documento_nombre,
    d.drive_view_url     AS documento_url,
    d.estado             AS documento_estado
FROM opcion_menu o
JOIN categoria   c  ON c.id = o.categoria_id
LEFT JOIN categoria cd ON cd.id = o.categoria_destino_id
LEFT JOIN respuesta  r  ON r.id = o.respuesta_id
LEFT JOIN respuesta_documento rd ON rd.respuesta_id = r.id
LEFT JOIN documento d ON d.id = rd.documento_id
WHERE o.activo AND c.activo
ORDER BY c.orden, o.orden, rd.orden;

-- ---------------------------------------------------------------------------
-- 13. Vista de mantenimiento de la base de conocimiento
--     Que consultas se resuelven y cuales no. No guarda texto de los
--     estudiantes: solo el origen del acierto.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW v_kb_resolucion AS
SELECT
    i.clave            AS intencion_clave,
    i.nombre           AS intencion_nombre,
    i.domain,
    i.opcion_clave     AS opcion_clave,
    p.priority         AS priority,
    p.minimum_threshold,
    p.pregunta,
    count(v.id)        AS variantes
FROM kb_intencion i
JOIN kb_pregunta p          ON p.intencion_id = i.id
LEFT JOIN kb_pregunta_variante v ON v.pregunta_id = p.id AND v.activo
WHERE i.activo AND p.activo
GROUP BY i.clave, i.nombre, i.domain, i.opcion_clave, p.id, p.priority, p.minimum_threshold, p.pregunta
ORDER BY i.domain, i.clave, p.priority DESC;

COMMENT ON VIEW v_kb_resolucion IS 'Cobertura de la base de conocimiento por intencion y pregunta.';
