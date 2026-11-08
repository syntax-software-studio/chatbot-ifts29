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
--   * `texto_normalizado` (KB) es el texto ya normalizado por el MISMO
--     normalizador que usa la API, para que el indice y los umbrales de
--     similitud sean comparables.
--
--  Indices de la base de conocimiento:
--   * B-tree sobre `texto_normalizado` para la coincidencia EXACTA (Nivel A).
--   * GIN tsvector para full-text search (Nivel B_FTS, config `spanish`).
--   * GIN con `gin_trgm_ops` para la similitud trigram (Nivel B_TRG, `pg_trgm`).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ---------------------------------------------------------------------------
-- 1. CATEGORIA  ->  nodos del árbol conversacional
--    Una categoría agrupa opciones y define el mensaje del bot al entrar.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS menu_categoria (
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

COMMENT ON TABLE  menu_categoria              IS 'Nodos del arbol del menu (RF05).';
COMMENT ON COLUMN menu_categoria.mensaje       IS 'Mensaje del bot que se muestra al entrar a la categoria.';
COMMENT ON COLUMN menu_categoria.es_raiz       IS 'TRUE solo para la categoria inicial que muestra el saludo.';

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
CREATE TABLE IF NOT EXISTS opcion (
    id                  SERIAL PRIMARY KEY,
    clave               TEXT        NOT NULL UNIQUE,
    categoria_id        INTEGER     NOT NULL REFERENCES menu_categoria (id) ON DELETE CASCADE,
    etiqueta            TEXT        NOT NULL,
    tipo                TEXT        NOT NULL DEFAULT 'navegar'
                            CHECK (tipo IN ('navegar', 'responder', 'derivar')),
    categoria_destino_id INTEGER    REFERENCES menu_categoria (id) ON DELETE RESTRICT,
    respuesta_id        INTEGER     REFERENCES respuesta (id) ON DELETE SET NULL,
    es_volver           BOOLEAN     NOT NULL DEFAULT FALSE,
    en_menu             BOOLEAN     NOT NULL DEFAULT TRUE,
    orden               INTEGER     NOT NULL DEFAULT 0,
    activo              BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT opcion_destino_ck
        CHECK (
            (tipo = 'navegar'   AND categoria_destino_id IS NOT NULL AND respuesta_id IS NULL)
         OR (tipo = 'responder' AND respuesta_id         IS NOT NULL AND categoria_destino_id IS NULL)
         OR (tipo = 'derivar'   AND categoria_destino_id IS NULL)
        )
);

CREATE INDEX IF NOT EXISTS opcion_categoria_idx ON opcion (categoria_id, orden);
CREATE UNIQUE INDEX IF NOT EXISTS opcion_navegar_uniq
    ON opcion (categoria_id, categoria_destino_id)
    WHERE tipo = 'navegar' AND categoria_destino_id IS NOT NULL;

COMMENT ON TABLE  opcion               IS 'Opciones seleccionables del menu, destino final de toda consulta (RF05).';
COMMENT ON COLUMN opcion.tipo            IS 'navegar = subpregunta; responder = respuesta con adjuntos; derivar = contactos (RF04).';
COMMENT ON COLUMN opcion.es_volver     IS 'TRUE para la opcion "< Volver al menu anterior".';
COMMENT ON COLUMN opcion.en_menu       IS 'FALSE para opciones solo buscables por texto libre (no aparecen en el menu de navegacion).';
COMMENT ON COLUMN opcion.categoria_destino_id IS 'Categoria a la que navega la opcion.';
COMMENT ON COLUMN opcion.respuesta_id   IS 'Respuesta a mostrar. En tipo derivar es opcional (texto introductorio).';

-- ---------------------------------------------------------------------------
-- 4. DOCUMENTO  ->  ficha de un archivo de Drive
--    Nunca se guarda el binario ni los enlaces: se calculan desde drive_file_id.
--    Disponible = el archivo está en la carpeta de Drive. No hay estados: si el
--    archivo sale de la carpeta, la sincronización quita drive_file_id.
--    materia, tipo, comision, anio y cuatrimestre se leen del nombre del archivo
--    (ver docs/desarrollo-e-integracion/07). Quedan NULL si el nombre no cumple
--    la convención.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento (
    id                  SERIAL PRIMARY KEY,
    clave               TEXT        NOT NULL UNIQUE,
    materia             TEXT,
    tipo                TEXT,
    comision            TEXT        CHECK (comision ~ '^[A-Z]$'),
    anio                INTEGER,
    cuatrimestre        TEXT        CHECK (cuatrimestre IN ('1C', '2C')),
    drive_file_id       TEXT        UNIQUE,
    drive_md5           TEXT,
    -- md5 del archivo con el que se extrajeron sus fragmentos. Si difiere de
    -- drive_md5, la sincronización vuelve a extraer. Un PDF sin texto queda
    -- marcado igual, sin volver a descargarlo en cada sync.
    fragmentos_md5      TEXT,
    creado_en           TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sincronizado_en     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS documento_materia_idx ON documento (materia, tipo);

-- ---------------------------------------------------------------------------
-- 4b. DOCUMENTO_FRAGMENTO  ->  secciones de un documento para la búsqueda de pasajes
--     Se generan al sincronizar, a partir del PDF de Drive, cuando cambia su md5.
--     `texto` es el literal del documento (es lo que se muestra). `texto_busqueda`
--     es el mismo texto normalizado (sin tildes ni signos), y es sobre el que
--     corre FTS, igual que las variantes de la base de conocimiento.
--     Un documento sin texto extraíble no tiene filas: se muestra completo.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documento_fragmento (
    id              SERIAL PRIMARY KEY,
    documento_id    INTEGER     NOT NULL REFERENCES documento (id) ON DELETE CASCADE,
    orden           INTEGER     NOT NULL,
    titulo          TEXT        NOT NULL DEFAULT '',
    texto           TEXT        NOT NULL,
    texto_busqueda  TEXT        NOT NULL,
    search_vector   tsvector
        GENERATED ALWAYS AS (to_tsvector('spanish', texto_busqueda)) STORED,

    CONSTRAINT documento_fragmento_orden_uniq UNIQUE (documento_id, orden)
);

CREATE INDEX IF NOT EXISTS documento_fragmento_fts_idx ON documento_fragmento USING GIN (search_vector);

COMMENT ON TABLE documento_fragmento IS 'Secciones de un documento (por título), para la búsqueda de pasajes. Se regeneran al sincronizar.';

COMMENT ON TABLE  documento                   IS 'Documentos institucionales referenciados desde Drive (solo lectura).';
COMMENT ON COLUMN documento.drive_file_id     IS 'Identificador del archivo en Drive. NULL = no está en la carpeta: el bot no ofrece enlace.';
COMMENT ON COLUMN documento.comision          IS 'Comision leida del nombre del archivo (una letra). NULL si el documento no depende de la comision.';

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
    opcion_id   INTEGER     NOT NULL REFERENCES opcion (id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS contacto_opcion_idx ON contacto (opcion_id, orden);
COMMENT ON COLUMN contacto.opcion_id IS 'Opcion de derivacion a la que pertenece el contacto (una sola).';

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

-- Control de los reportes mensuales publicados en Drive. Los archivos son la
-- copia que consume el cliente; esta tabla dice cuáles meses ya están publicados.
CREATE TABLE IF NOT EXISTS metrica_exportacion (
    mes           CHAR(7)     PRIMARY KEY,
    archivo_id    TEXT        NOT NULL,
    registros     INTEGER     NOT NULL CHECK (registros >= 0),
    total         INTEGER     NOT NULL CHECK (total >= 0),
    generado_en   TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
--   * Toda intencion esta atada a una opcion de `opcion` y a una
--     `respuesta` ya validada: el texto libre no puede inventar contenido,
--     solo localizarlo.
--   * Versionado con `activo`: desactivar una variante la saca de la busqueda
--     sin borrar el historial.
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 9. KB_PREGUNTA  ->  la formulacion canonica de la consulta
--     Una opcion puede tener varias preguntas (por ejemplo, una por materia
--     o una version corta y una larga); el ranking usa `prioridad`.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pregunta (
    id                SERIAL PRIMARY KEY,
    opcion_id         INTEGER     NOT NULL REFERENCES opcion (id) ON DELETE CASCADE,
    pregunta          TEXT        NOT NULL,
    prioridad          INTEGER     NOT NULL DEFAULT 0,
    umbral_minimo NUMERIC(4,3) NOT NULL DEFAULT 0.700
                              CHECK (umbral_minimo >= 0 AND umbral_minimo <= 1),
    activo            BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en         TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT pregunta_uniq UNIQUE (opcion_id, pregunta)
);

CREATE INDEX IF NOT EXISTS pregunta_opcion_idx ON pregunta (opcion_id);

COMMENT ON TABLE  pregunta                IS 'Formulaciones canonicas de una opcion del menu (la que se busca por texto).';
COMMENT ON COLUMN pregunta.prioridad       IS 'Orden de presentacion cuando hay que pedir aclaracion (mayor primero).';
COMMENT ON COLUMN pregunta.umbral_minimo IS 'Corte inferior de similitud para esta pregunta (calibrable, D04).';

-- ---------------------------------------------------------------------------
-- 10. KB_PREGUNTA_VARIANTE  ->  las formas en que se puede escribir
--     Una misma pregunta admite varias redacciones; `peso` pondera la
--     variante en el ranking. Las variantes genericas (sin materia, por
--     ejemplo "dias de cursada") se repiten en varias preguntas a proposito:
--     son las que permiten pedir aclaracion en vez de adivinar (D06).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS pregunta_variante (
    id              SERIAL PRIMARY KEY,
    pregunta_id     INTEGER     NOT NULL REFERENCES pregunta (id) ON DELETE CASCADE,
    texto_original   TEXT        NOT NULL,
    texto_normalizado TEXT        NOT NULL,
    peso          NUMERIC(3,2) NOT NULL DEFAULT 1.00
                            CHECK (peso > 0 AND peso <= 1),
    activo          BOOLEAN     NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMPTZ NOT NULL DEFAULT now(),
    actualizado_en  TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Nivel B_FTS: vector FTS precalculado. El texto normalizado ya no tiene
    -- diacriticos (el normalizador JS los elimino), asi que no hace falta el
    -- wrapper immutable de unaccent.
    search_vector   tsvector
        GENERATED ALWAYS AS (to_tsvector('spanish', texto_normalizado)) STORED,

    CONSTRAINT kb_variante_uniq UNIQUE (pregunta_id, texto_normalizado)
);

-- Nivel A: coincidencia exacta por igualdad del texto normalizado.
CREATE INDEX IF NOT EXISTS kb_variante_normalized_idx
    ON pregunta_variante (texto_normalizado);

-- Nivel B_FTS: full-text search.
CREATE INDEX IF NOT EXISTS kb_variante_fts_idx
    ON pregunta_variante USING GIN (search_vector);

-- Nivel B_TRG: similitud trigram. El GIN acelera el filtro `similarity(...) >= x`.
CREATE INDEX IF NOT EXISTS kb_variante_trgm_idx
    ON pregunta_variante USING GIN (texto_normalizado gin_trgm_ops);

COMMENT ON TABLE  pregunta_variante         IS 'Redacciones alternativas de una pregunta, ya normalizadas.';
COMMENT ON COLUMN pregunta_variante.peso IS 'Peso de la variante en el ranking (1.00 = formulacion canonica).';

-- ---------------------------------------------------------------------------
-- 10b. KB_ALIAS  ->  siglas y abreviaturas que se expanden antes de buscar
--     Por ejemplo "abd" -> "administracion de bases de datos". Se cargan desde
--     la pestaña `alias` de la planilla.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS termino_equivalente (
    alias       TEXT PRIMARY KEY,
    expansion   TEXT NOT NULL
);

COMMENT ON TABLE termino_equivalente IS 'Siglas y abreviaturas de la consulta, ya normalizadas, con su expansion.';

-- ---------------------------------------------------------------------------
-- 10c. KB_TERMINO_IGNORADO  ->  palabras de la consulta que no identifican nada
--     Se cargan desde la pestaña `ignorados` de la planilla. Sólo se usan al
--     buscar (FTS y trigramas): no cambian cómo se guardan las variantes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS termino_ignorado (
    termino     TEXT PRIMARY KEY
);

COMMENT ON TABLE termino_ignorado IS 'Palabras de la consulta que se descartan al buscar (ruido), ya normalizadas.';

-- ---------------------------------------------------------------------------
-- 10e. PALABRA_VACIA  ->  articulos y preposiciones que no aportan significado
--     Se cargan desde la pestaña `palabras_vacias`. Se quitan de la consulta y de las variantes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palabra_vacia (
    termino TEXT PRIMARY KEY
);

COMMENT ON TABLE palabra_vacia IS 'Palabras que se quitan al normalizar consultas y variantes (de, la, y...).';

-- ---------------------------------------------------------------------------
-- 10d. TERMINO_RECONOCIMIENTO_SECCION  ->  títulos que parten un PDF en secciones
--     Se cargan desde la pestaña del mismo nombre. Ya normalizados.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS termino_reconocimiento_fragmento (
    termino TEXT PRIMARY KEY
);

COMMENT ON TABLE termino_reconocimiento_fragmento IS 'Títulos de sección que se reconocen dentro de los PDF para partirlos en fragmentos. Ya normalizados.';

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
        'menu_categoria', 'opcion', 'respuesta',
        'documento', 'contacto',
        'pregunta', 'pregunta_variante'
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
CREATE OR REPLACE VIEW v_menu_arbol AS
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
    d.clave || '.pdf'    AS documento_nombre,
    CASE WHEN d.drive_file_id IS NOT NULL
         THEN 'https://drive.google.com/file/d/' || d.drive_file_id || '/view'
    END                  AS documento_url
FROM opcion o
JOIN menu_categoria   c  ON c.id = o.categoria_id
LEFT JOIN menu_categoria cd ON cd.id = o.categoria_destino_id
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
CREATE OR REPLACE VIEW v_cobertura_intenciones AS
SELECT
    o.clave            AS opcion_clave,
    o.etiqueta         AS opcion_etiqueta,
    p.prioridad,
    p.umbral_minimo,
    p.pregunta,
    count(v.id)        AS variantes
FROM opcion o
JOIN pregunta p               ON p.opcion_id = o.id
LEFT JOIN pregunta_variante v ON v.pregunta_id = p.id AND v.activo
WHERE o.activo AND p.activo
GROUP BY o.clave, o.etiqueta, p.id, p.prioridad, p.umbral_minimo, p.pregunta
ORDER BY o.clave, p.prioridad DESC;

COMMENT ON VIEW v_cobertura_intenciones IS 'Cobertura de la base de conocimiento por opcion del menu y pregunta.';
