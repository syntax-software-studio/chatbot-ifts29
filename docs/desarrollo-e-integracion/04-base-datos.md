# 4. Base de Datos

**Estado:** vigente. Describe el esquema y el flujo de carga actuales.

## 4.1 Resumen

- **Motor:** PostgreSQL 16. Neon en producción; Docker local (`docker compose up`) en desarrollo.
- **Driver:** `pg` (node-postgres). La misma `DATABASE_URL` sirve para ambos.
- **Extensiones:** `pgcrypto`, `pg_trgm` (similitud para el texto libre).
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

Índices: B-tree sobre `normalized_text` (coincidencia exacta) y GIN con `gin_trgm_ops` (similitud).

### Métricas

| Tabla | Descripción |
|---|---|
| `metrica_opcion` | Contadores diarios por opción y evento (`seleccion`, `texto_exacto`, `aclaracion`, `no_disponible`, etc.). Sin datos personales ni texto de la consulta. |

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

> **Advertencia:** `--reset` borra `metrica_opcion`. Hasta que esté resuelto, exportar las métricas antes de resetear (`pg_dump -a -t metrica_opcion`).

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
| `DATABASE_URL` | Conexión PostgreSQL (Neon o Docker local). Vacía: la API usa el catálogo semilla en memoria (modo demo), que se retira en un paso pendiente. |
| `GOOGLE_SHEET_ID` | ID de la planilla de contenido. |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHARED_FOLDER_ID` | Acceso de lectura a la planilla y a Drive. |

## 4.9 Pendientes

- Preservar `metrica_opcion` en `--reset`.
- Migración de Neon: el esquema sin contexto y el contenido nuevo todavía no se aplicaron en producción.
