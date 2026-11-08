# 3. Manual Operacional

Guía paso a paso para operar el sistema en local (desarrollo) y en producción (Neon + Vercel). Cada tarea describe cuándo hacerla, cómo, cómo verificarla y qué riesgo tiene.

**Para quién:** quien mantiene el sistema en producción o lo desarrolla localmente.

**Regla general:** cualquier comando que escriba en Neon se ejecuta con confirmación previa, y nunca sin respaldo de `metrica_opcion` (ver [3.6](#36-respaldo-de-datos)).

---

## 3.1 Cargar o actualizar documentos en la base de conocimiento

El proceso completo de agregar o modificar un documento: subirlo a Drive, actualizarlo en la planilla de contenido, y sincronizar para que el sistema lo indexe automáticamente.

### Sistema de claves y referencias

Todo el contenido se vincula por **claves únicas**. Cada entidad (categoría, opción, respuesta, contacto) tiene una `clave` que la identifica, y las otras tablas la referencian por esa `clave`.

Ejemplo:
```
Categoría        clave: RAIZ
                   ↓ (referencia)
Opción          clave: RAIZ_OP_MATERIAS, categoria: RAIZ
                   ↓ (referencia)
Respuesta        clave: ABD_programa
                   ↓ (referencia en respuesta_documentos)
Documento        nombre: ABD_programa_2026_1C.pdf
```

**Convención de claves:**
- Usa MAYÚSCULAS y guiones o guiones bajos: `RAIZ`, `RAIZ_OP_MATERIAS`, `ABD_programa`
- Sé consistente y descriptivo: la clave debe indicar a qué se refiere

### 3.1.1 Agregar un documento nuevo (ejemplo completo)

**Escenario:** Agregar el documento "Condiciones para aprobar ABD" con comisión A.

**Paso 1: Subir el PDF a Drive**

1. Carpeta: https://drive.google.com/drive/folders/1Y13Rl0F-XP71tXJOQe9euK_xvRMB29ii
2. Nombre respetando convención (ver [10-contenido-y-decisiones.md](10-contenido-y-decisiones.md)):
   - Formato: `MATERIA_tipo[_comision]_año[_cuatrimestre].pdf`
   - Ejemplo: `ABD_condiciones_A_2026_1C.pdf`
3. El sistema parsea el nombre para extraer: materia=ABD, tipo=condiciones, comision=A, año=2026, cuatrimestre=1C

**Paso 2: Actualizar la planilla de contenido**

Planilla: https://docs.google.com/spreadsheets/d/1sqEH4R_09iOn0hp8IY7eAwaWRknJX1GuxXaZZxCiwcA/

Actualiza estas pestañas en orden:

**a) Pestaña `respuestas` (si no existe una respuesta para esto)**

Agrega una fila:
```
clave: ABD_condiciones
texto: Estas son las condiciones para aprobar ABD. [Texto completo de la respuesta institucional]
orden: 1
```

**b) Pestaña `respuesta_documentos`**

Agrega una fila para asociar el documento con la respuesta:
```
respuesta: ABD_condiciones
documento: ABD_condiciones_A_2026_1C
orden: 1
```

⚠️ **Importante:** el campo `documento` es el nombre del archivo **SIN** la extensión `.pdf`.

**c) Pestaña `preguntas` (si quieres que se encuentre por texto libre)**

Agrega una fila:
```
opcion: ABD_condiciones  (la clave de la opción que muestra esta respuesta)
pregunta: ¿Cuáles son las condiciones para aprobar ABD?
prioridad: 30
umbral_minimo: 0.7
```

**d) Pestaña `variantes` (alternativas que el usuario podría escribir)**

Agrega filas con formas distintas de preguntar:
```
opcion: ABD_condiciones
pregunta: ¿Cuáles son las condiciones para aprobar ABD?
texto_original: condiciones para aprobar abd
peso: 1

opcion: ABD_condiciones
pregunta: ¿Cuáles son las condiciones para aprobar ABD?
texto_original: como apruebo abd
peso: 0.8

opcion: ABD_condiciones
pregunta: ¿Cuáles son las condiciones para aprobar ABD?
texto_original: requisitos para aprobar abd
peso: 1
```

**Paso 3: Sincronizar el contenido**

En local:
```bash
npm run sync --workspace backend
```

En producción: `POST /api/sync` con el secreto `SYNC_SECRET` (ver [02-manual-tecnico.md § 2.5](02-manual-tecnico.md)).

El sistema automáticamente:
- Descarga el PDF de Drive
- Parsea el nombre para extraer metadatos (materia, tipo, comisión, año, cuatrimestre)
- Extrae el texto y lo divide en fragmentos por títulos de sección
- Genera los índices de búsqueda (`search_vector`)
- Valida todas las referencias. Si hay errores: devuelve la lista y **no cambia nada**

**Paso 4: Verificar**

```bash
# 1. Contar fragmentos extraídos
psql "$DATABASE_URL" -c "SELECT count(*) FROM documento_fragmento WHERE documento_id = (SELECT id FROM documento WHERE clave LIKE 'abd_condiciones_a%');"

# 2. Probar búsqueda en el widget
# Escribir: "condiciones para aprobar abd" → debe mostrar extracto del PDF
# Escribir: "como apruebo abd" → debe mostrar extracto del PDF
```

### 3.1.2 Actualizar un documento existente

**Si el PDF cambió:**

1. Reemplazar el archivo en Drive (mantener el mismo nombre).
2. Correr la sincronización (Paso 3 de arriba).
3. El sistema detecta que el MD5 del archivo cambió y descarga/extrae de nuevo automáticamente.

**Si cambió el contenido en la planilla:**

1. Editar la pestaña correspondiente (`respuestas`, `preguntas`, `variantes`, etc.).
2. Correr la sincronización.

### 3.1.3 Re-extraer todos los documentos (cambio en normalización)

**Cuándo:** cambió la forma de extraer o normalizar el texto de los PDFs (por ejemplo, el normalizador de `texto_busqueda`). Los fragmentos viejos quedan con el texto anterior, y las búsquedas dejan de coincidir.

**Antes de empezar:**

1. Respaldar `metrica_opcion` (ver [3.6](#36-respaldo-de-datos)).
2. No es una tarea de rutina. Verificar que haga falta comparando `texto_busqueda` actual con lo que produce el normalizador nuevo.

**Procedimiento:**

```sql
-- Sobre la base que corresponda (local o Neon, con confirmación)
UPDATE documento SET fragmentos_md5 = NULL;
```

Después, correr la sincronización (Paso 3 de 3.1.1). Como el MD5 ya no coincide, cada documento se descarga y se extrae de nuevo.

- Son todos los documentos, con descargas de Drive. Hacerlo en local es más seguro que en Vercel (límite de 30 s, ver [11-pendientes-post-mvp.md](11-pendientes-post-mvp.md)).
- Si la sincronización se corta a mitad, los documentos sin `fragmentos_md5` quedan pendientes. Volver a correr completa la extracción.

**Verificar:**

```sql
SELECT count(*) FROM documento WHERE fragmentos_md5 IS NULL;  -- Debe dar 0
```

Después, una consulta de pasaje: `como apruebo abd` debe devolver extractos.

### 3.1.4 Reindexar fragmentos (si la búsqueda falla)

**Cuándo:** los fragmentos existen pero no aparecen en las búsquedas de texto libre. O se agregaron fragmentos manualmente sin indexar.

El índice de búsqueda se genera automáticamente: cada fragmento tiene un `search_vector` (columna generada desde `texto_busqueda`) que alimenta un índice GIN. Si fallan las búsquedas:

1. **Los fragmentos se extrajeron pero el índice se corrupto:** reindexar sin re-extraer (opción A).
2. **Se agregaron fragmentos manualmente:** la sincronización los recalcula, o reindexar de inmediato (opciones A o B).

**Opción A: Reindexar el índice GIN**

```sql
-- Sobre la base que corresponda (local o Neon, con confirmación)
REINDEX INDEX CONCURRENTLY documento_fragmento_fts_idx;
```

- `CONCURRENTLY` permite que el widget siga funcionando. Sin ello, se bloquea la tabla.
- En Neon, `CONCURRENTLY` no funcionará si la base es muy grande. Usar entonces `REINDEX INDEX documento_fragmento_fts_idx` en local (respaldar `metrica_opcion` primero).

**Opción B: Sincronizar (recalcula todo)**

Ejecutar la sincronización (Paso 3 de 3.1.1). Como `fragmentos_md5` coincide, no descarga documentos, pero recalcula `search_vector` y regenera el índice.

**Verificar:**

```sql
SELECT count(*) FROM documento_fragmento;  -- Debe ser > 0
```

Una consulta de pasaje debe devolver fragmentos: `como apruebo abd`.

### 3.1.5 Agregar términos de fragmentos como opciones buscables

**Cuándo:** querés que el bot encuentre términos específicos dentro de los documentos (ej: "bibliografía de abd", "objetivos de lógica computacional", "unidades temáticas").

Los PDFs se dividen en fragmentos por títulos. Este proceso agrega esos títulos como **opciones buscables**: cuando alguien pregunta "¿cuál es la bibliografía de ABD?", el bot devuelve el fragmento correspondiente.

#### Cómo funciona la búsqueda de fragmentos (⚠️ importante)

1. **Título en el PDF** (ej: "BIBLIOGRAFÍA") → se normaliza a minúsculas sin tildes
2. **Término en planilla** (ej: "Bibliografía") → se normaliza durante `sync` 
3. **Base de datos** → almacena términos normalizados (ej: "bibliografia")
4. **Búsqueda** → compara PDF normalizado con términos en BD
5. **Resultado** → devuelve el fragmento si coinciden

**Punto crítico:** Los términos en `reconocimiento_fragmentos` deben exactamente coincidir con los títulos en el PDF (respetando el significado, no la capitalización). Sin `npm run sync`, los nuevos términos no se cargan en la BD y no funcionarán.

**Flujo completo (5 pasos, 4 pestañas a actualizar):**

#### Paso 1: Verificar que el término esté en `reconocimiento_fragmentos`

En la pestaña `reconocimiento_fragmentos`, agregar (si no existe) una fila con el título del fragmento en el PDF:

```
termino
Bibliografía
Fundamentación
Unidades temáticas
```

⚠️ **Debe coincidir exactamente con el título en el PDF** (no importa mayúsculas, se normalizan automáticamente).

#### Paso 2: Crear respuestas

En la pestaña `respuestas`, agrega una fila por cada término + materia:

```
clave: ABD_BIBLIOGRAFIA
texto: La bibliografía se encuentra en el programa vigente. Consultá el documento para más detalles.
orden: 7
```

Repite para: fundamentación, objetivos, bibliografía, contenidos, evaluación (o los términos que uses).

#### Paso 3: Crear opciones

En la pestaña `opciones`, agrega opciones que referencien esas respuestas:

```
clave: ABD_OP_BIBLIOGRAFIA
categoria: ABD
etiqueta: Bibliografía de Administración de Bases de Datos
tipo: responder
respuesta: ABD_BIBLIOGRAFIA
orden: 8
es_volver: FALSE
```

**Importante:** `categoria` es la categoría de materia (ej: ABD, EAM, LC, TP). `respuesta` es la clave de la respuesta que creaste en Paso 2.

#### Paso 4: Crear preguntas y variantes

En la pestaña `preguntas`, agregar:

```
opcion: ABD_OP_BIBLIOGRAFIA
pregunta: ¿Cuál es la bibliografía de ABD?
prioridad: 30
umbral_minimo: 0,7
```

En la pestaña `variantes`, agregar formas distintas de preguntar:

```
opcion: ABD_OP_BIBLIOGRAFIA
pregunta: ¿Cuál es la bibliografía de ABD?
texto_original: bibliografía abd
peso: 1

opcion: ABD_OP_BIBLIOGRAFIA
pregunta: ¿Cuál es la bibliografía de ABD?
texto_original: bibliografía
peso: 0,7
```

#### Paso 5: Sincronizar (⚠️ OBLIGATORIO)

```bash
npm run sync --workspace backend
```

**Este paso es obligatorio.** Sin él, los nuevos términos en `reconocimiento_fragmentos` no se cargan en la BD y no funcionarán.

**Verificar:**

- La respuesta tiene `ok: true` y `errores` vacío
- En el widget: busca "bibliografía abd" → debe devolver el fragmento (no solo la respuesta)

**Checklist:**

- [ ] Término existe en `reconocimiento_fragmentos` (coincide con título en PDF)
- [ ] Respuesta existe en `respuestas`
- [ ] Opción existe en `opciones` (referencia respuesta)
- [ ] Pregunta existe en `preguntas` (referencia opción)
- [ ] Variantes existen en `variantes` (sin duplicados)
- [ ] **`npm run sync` ejecutada SIN ERRORES** ← paso obligatorio
- [ ] Búsqueda en widget devuelve fragmento PDF (no solo respuesta)

---

## 3.2 Aplicar el esquema (`db:push`)

**Cuándo:** se agregó una tabla nueva a `db/001_schema.sql` (o una extensión, un índice, etc.).

```bash
npm run db:push --workspace backend
```

- Solo crea lo que falta (`CREATE ... IF NOT EXISTS`). No borra nada.
- **No modifica columnas** de tablas existentes. Si una tabla cambia, hace falta `--reset` (ver [3.4](#34-resetear-la-base)).

**Verificar:**

```bash
GET /api/health  # Responde "estado":"ok"
```

---

## 3.3 Sincronizar el contenido

Carga/actualiza el menú, respuestas, contactos y documentos desde la planilla "Bot IFTS29 - Contenido" y Drive.

En local:

```bash
npm run sync --workspace backend
```

En producción: `POST /api/sync` con `SYNC_SECRET`.

- Si la planilla tiene errores, **no escribe nada** y devuelve la lista. Corregir y volver a correr.
- La base de conocimiento se reemplaza completa. Menú, respuestas y contactos se actualizan por clave.
- Los documentos se comparan por `fragmentos_md5`: si no cambió el PDF, no se vuelve a extraer.

**Verificar:**

```bash
Respuesta con ok: true y errores vacío.

# Después, en el widget:
# "para aprobar abd necesito"
# "condiciones de abd"
# "inscripcion a materias"
```

**Para agregar/actualizar documentos:** ver [3.1](#31-cargar-o-actualizar-documentos-en-la-base-de-conocimiento) arriba, que es el flujo completo.

---

## 3.4 Resetear la base (`--reset`)

**Cuándo:** el esquema cambió de forma que `db:push` no alcanza (ej. columna nueva en tabla existente), o la base local quedó inconsistente.

**Antes de empezar:**

1. Respaldar `metrica_opcion` (ver [3.6](#36-respaldo-de-datos)).
2. Confirmar que `DATABASE_URL` apunta a la base correcta. Para Neon, requiere confirmación explícita.

```bash
cd backend
node --import tsx src/db/push.ts --reset
cd ..
npm run sync --workspace backend      # El reset deja las tablas de contenido vacías
```

**Verificar:**

- `GET /api/health` en `"ok"`.
- El menú raíz responde con datos.
- Consultas de referencia (ver [3.3](#33-sincronizar-el-contenido)) funcionan.
- Las filas de `metrica_opcion` siguen estando (fueron respaldadas y restauradas).

---

## 3.5 Exportación mensual de métricas

**No requiere acción manual.** Vercel llama a `GET /api/metricas/exportar-mes-anterior` el día 1 de cada mes a las 06:00 (UTC), y publica el mes anterior en la planilla de métricas.

**Verificar que corrió:**

Mirar los logs de la función en Vercel, o revisar que la pestaña del mes anterior en la planilla se haya actualizado. Si no, revisar que `CRON_SECRET` y `GOOGLE_METRICAS_*` estén cargadas en Vercel.

**Rehacer un mes (manual):**

Por ejemplo después de corregir datos en `metrica_opcion`:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://<dominio>/api/metricas/exportar-mes-anterior?mes=AAAA-MM"
```

- Reemplaza la pestaña de ese mes. No suma a lo anterior.
- Si el mes no tiene datos, la pestaña queda vacía.
- **No correr en local contra la planilla de producción con el mes actual**, porque reemplaza esa pestaña.

Detalle: [02-manual-tecnico.md § 2.5](02-manual-tecnico.md), [04-base-datos.md](05-base-datos.md).

---

## 3.6 Respaldo de datos

### Respaldo de `metrica_opcion`

**Cuándo:** antes de cualquier `--reset` contra Neon, y periódicamente como seguro.

**Hoy es manual:**

Exportar la tabla completa a CSV desde DBeaver, o `psql`:

```bash
psql "$DATABASE_URL" -c "\copy metrica_opcion TO 'metrica_opcion_AAAA-MM-DD.csv' CSV HEADER"
```

Guardar el archivo con la fecha en el nombre, fuera del repo.

**Verificación:**

```sql
SELECT count(*) FROM metrica_opcion;  -- El número debe coincidir con el CSV
```

La automatización (comando `npm run metricas:respaldo`) está pendiente (ver [11-pendientes-post-mvp.md](11-pendientes-post-mvp.md)).

---

## 3.7 Rotación de secretos y claves

**Cuándo:** un secreto se filtró, un usuario dejó de tenerlo, o se cumple el plazo interno.

| Secreto | Dónde se usa | Cómo rotarlo |
|---|---|---|
| `SYNC_SECRET` | `POST /api/sync` | Generar uno nuevo, cargarlo en Vercel y `.env` local |
| `CRON_SECRET` | Exportación de métricas, llamadas manuales | Igual que `SYNC_SECRET`. Vercel toma el valor nuevo en el siguiente despliegue |
| `GOOGLE_PRIVATE_KEY` | Sincronización (lectura de Drive) | Crear clave nueva en Google Cloud, cargarla, borrar la anterior |
| `GOOGLE_METRICAS_PRIVATE_KEY` | Exportación de métricas | Igual que `GOOGLE_PRIVATE_KEY` |

Después de rotar, verificar la tarea que la usa (sincronización: [3.1](#31-cargar-o-actualizar-documentos-en-la-base-de-conocimiento) y [3.3](#33-sincronizar-el-contenido); métricas: [3.5](#35-exportación-mensual-de-métricas)).

**Acceso a la planilla de métricas:**

Revisar periódicamente que solo tengan acceso la cuenta de métricas y sus administradores. La cuenta de lectura **no** debe tener acceso a esa planilla.

---

## 3.8 Checklist antes de un despliegue a producción

1. **Respaldo hecho:** `metrica_opcion` respaldada (si hay reset).
2. **Esquema actualizado:** `db:push` ejecutado, o `--reset` si corresponde.
3. **Contenido sincronizado:** con `errores` vacío.
4. **Documentos indexados:** si hay cambios en extracción, verificar [3.1.4](#314-reindexar-fragmentos-si-la-búsqueda-falla).
5. **Variables de entorno en Vercel:** `DATABASE_URL`, `SYNC_SECRET`, `CRON_SECRET`, `GOOGLE_*`, `GOOGLE_METRICAS_*`.
6. **Health check:** `GET /api/health` en `"ok"`. Consultas de referencia del widget funcionan.

---

**Referencias:**
- [02-manual-tecnico.md § 2.5 a 2.6](02-manual-tecnico.md) — Configuración e instalación
- [05-base-datos.md § 4.4 a 4.5](05-base-datos.md) — Carga y sincronización
- [10-contenido-y-decisiones.md](10-contenido-y-decisiones.md) — Fuentes y convención de nombres
- [11-pendientes-post-mvp.md](11-pendientes-post-mvp.md) — Tareas futuras
