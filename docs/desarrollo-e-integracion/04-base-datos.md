# 4. Base de Datos

**Estado:** vigente. Describe el esquema y el flujo de carga actuales.

## 4.1 Resumen

- **Motor:** PostgreSQL 16. Neon en producción; Docker local (`docker compose up`) en desarrollo.
- **Driver:** `pg` (node-postgres). La misma `DATABASE_URL` sirve para ambos.
- **Extensiones:** `pgcrypto`, `pg_trgm` (similitud para el texto libre). La búsqueda de palabras usa la configuración `spanish` de PostgreSQL, que viene incluida, sin extensión.
- **Contenido:** no se escribe a mano en la base. Entra por la sincronización desde la planilla y Drive (ver [07-contenido-y-decisiones.md](07-contenido-y-decisiones.md)).
- **Datos personales:** ninguno. Las métricas son agregados anónimos.

## 4.2 Tablas

### Menú

| Tabla | Descripción | Claves relevantes |
|---|---|---|
| `categoria` | Nodo del árbol: una pantalla con mensaje y opciones | `clave` (única), `es_raiz` |
| `opcion_menu` | Botón que el estudiante toca | `clave` (única), `categoria_id`, `tipo`, `categoria_destino_id`, `respuesta_id` |
| `respuesta` | Texto institucional validado | `clave` (única) |
| `documento` | Ficha de un archivo de Drive | `clave` (única), `drive_file_id` (única), `drive_nombre_archivo` |
| `respuesta_documento` | Adjuntos de una respuesta | (`respuesta_id`, `documento_id`) |
| `contacto` | Persona o área de derivación | `clave` (única), `comision`, `motivo` |
| `opcion_contacto` | Contacto de una opción de derivación | (`opcion_id`, `contacto_id`) |

El campo `opcion_menu.tipo` define qué hace la opción:

- `navegar`: abre otra categoría (subpregunta). Requiere `categoria_destino_id`.
- `responder`: muestra una respuesta y sus documentos. Requiere `respuesta_id`.
- `derivar`: muestra los contactos asociados. No tiene destino ni respuesta propia.

Una restricción de la tabla impide combinaciones inválidas.

### Base de conocimiento (texto libre)

| Tabla | Descripción |
|---|---|
| `kb_intencion` | Qué tipo de consulta responde una opción del menú (`opcion_clave`) |
| `kb_pregunta` | Formulación canónica de una intención, con prioridad y umbral |
| `kb_pregunta_variante` | Redacciones posibles, ya normalizadas (`normalized_text`), con peso |
| `kb_alias` | Siglas y nombres cortos con su expansión (por ejemplo "abd" → "administracion de bases de datos"). Se cargan desde la pestaña `alias` |
| `kb_termino_ignorado` | Palabras de la consulta que no identifican nada ("como", "para", "una"...). Se cargan desde la pestaña `ignorados`. Sólo se usan al buscar; no cambian cómo se guardan las variantes |

`kb_pregunta_variante` tiene además `search_vector`, un `tsvector` generado (`to_tsvector('spanish', normalized_text)`) que usa la búsqueda de palabras.

### Fragmentos de documentos

| Tabla | Descripción |
|---|---|
| `documento_fragmento` | Secciones de un documento, por título: `titulo`, `texto` (el literal del PDF, lo que se muestra), `texto_busqueda` (normalizado, con el nombre de la materia) y `search_vector` (GIN). Se regeneran al sincronizar |

`documento.fragmentos_md5` guarda el `md5` del archivo con el que se extrajeron los fragmentos. La sincronización extrae solo cuando difiere del `md5` de Drive. Un documento sin texto extraíble no tiene filas en `documento_fragmento`.

Índices: B-tree sobre `normalized_text` (coincidencia exacta), GIN sobre `search_vector` (búsqueda de palabras) y GIN con `gin_trgm_ops` (similitud).

### Métricas

| Tabla | Descripción |
|---|---|
| `metrica_opcion` | Contadores diarios por opción y evento (`seleccion`, `texto_exacto`, `aclaracion`, `no_disponible`, etc.). Sin datos personales ni texto de la consulta. `categoria_clave` queda `NULL` por ahora (ver [09](09-pendientes-proximas-iteraciones.md), sección 6). |
| `metrica_exportacion` | Un registro por mes publicado en la planilla de métricas: `mes` (`AAAA-MM`), ID de la planilla, registros, total y fecha de la última publicación. Lo actualiza la exportación mensual; republicar un mes reemplaza su fila. |

### Vistas

- `v_arbol_menu`: el árbol completo con sus respuestas y documentos, para revisión.
- `v_kb_resolucion`: cobertura de la base de conocimiento por intención y pregunta.

## 4.3 Diagrama

```mermaid
erDiagram
    CATEGORIA ||--o{ OPCION_MENU : contiene
    CATEGORIA ||--o{ OPCION_MENU : "destino de navegar"
    RESPUESTA ||--o{ OPCION_MENU : muestra
    RESPUESTA ||--o{ RESPUESTA_DOCUMENTO : adjunta
    DOCUMENTO ||--o{ RESPUESTA_DOCUMENTO : "es adjunto de"
    OPCION_MENU ||--o{ OPCION_CONTACTO : deriva
    CONTACTO ||--o{ OPCION_CONTACTO : "es derivado por"
    OPCION_MENU ||--o{ KB_INTENCION : "emite"
    KB_INTENCION ||--o{ KB_PREGUNTA : tiene
    KB_PREGUNTA ||--o{ KB_PREGUNTA_VARIANTE : tiene
    OPCION_MENU ||--o{ METRICA_OPCION : "se registra en"
```

## 4.4 Carga y sincronización

El contenido se carga con un solo proceso, que valida antes de escribir:

```bash
npm run sync --workspace backend      # o POST /api/sync con SYNC_SECRET
```

1. Lee las ocho pestañas de la planilla y valida encabezados y referencias. Si hay errores, muestra todos y **no escribe nada**.
2. Escribe en una sola transacción. La base de conocimiento, los adjuntos y la asociación de contactos se reemplazan completos. Menú, respuestas, contactos y documentos se actualizan por clave, y lo que ya no está en la planilla se borra.
3. Sincroniza los documentos con Drive: completa enlaces, IDs y MD5 de cada ficha.

Las métricas no se tocan en ningún paso.

## 4.5 Esquema y reset

| Comando | Qué hace |
|---|---|
| `npm run db:push --workspace backend` | Aplica sólo `db/001_schema.sql`. Es idempotente. No carga contenido. |
| `node --import tsx src/db/push.ts --reset` (desde `backend/`) | Borra el esquema `public` y lo vuelve a crear con `001`. Después hay que correr la sincronización. |

> **Métricas:** `--reset` rescata las filas de `metrica_opcion` antes de borrar el esquema y las restaura después de aplicar `001`. Si ya había una fila con la misma clave, se suman los totales.

Nunca correr `--reset` contra Neon sin respaldo.

## 4.6 Archivos SQL

| Archivo | Uso |
|---|---|
| `db/001_schema.sql` | Esquema completo, estado final, sin `ALTER`. Lo aplican `db:push`, `--reset` y el arranque de Docker. |
| `db/003_verificacion.sql` | Consultas de verificación del esquema. Se ejecuta a mano con `psql`. |

El contenido no tiene archivos SQL: viene de la planilla.

## 4.7 Desarrollo local con Docker

```bash
docker compose up -d --build
```

Levanta PostgreSQL 16 en `localhost:5432` con la base `ifts29` y el esquema `001`. Después, para cargar el contenido:

```bash
DATABASE_URL=postgresql://postgres:password123@localhost:5432/ifts29 npm run sync --workspace backend
```

Si el volumen ya existía con una versión anterior del esquema, el arranque no vuelve a ejecutar `001`. Para empezar de cero: `docker compose down -v` y después `up`.

## 4.8 Configuración

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL (Neon o Docker local). Vacía: la API responde 503. |
| `GOOGLE_SHEET_ID` | ID de la planilla de contenido. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHARED_FOLDER_ID` | Acceso de lectura a la planilla y a Drive. |

## 4.9 Pendientes

- Migración de Neon: el esquema y el contenido nuevos todavía no se aplicaron en producción. Antes de aplicarlos, correr el reset y la sincronización en una rama de prueba y revisar con `\d kb_pregunta_variante` que existan `search_vector` y su índice, y que `kb_termino_ignorado` tenga filas.
- Documentos que desaparecen de Drive: la sincronización los deja como vigentes y sólo emite una advertencia. Pendiente definir si se archivan.
- Fragmentos de documentos: validar la búsqueda de pasajes con el conjunto dorado y ajustar el umbral (ver [08](08-extractos-de-documentos.md)).
