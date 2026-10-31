# 10. Tareas operativas

**Estado:** vigente. Lista de las tareas que se repiten sobre la base, la sincronización y la exportación de métricas. Cada tarea dice cuándo se hace, cómo, cómo se verifica y qué riesgo tiene.

**Para quién:** quien opera el sistema en local o en producción (Neon y Vercel).

Regla general: cualquier comando que escriba en Neon se corre con confirmación previa, y nunca sin respaldo de `metrica_opcion`.

---

## 10.1 Aplicar el esquema (`db:push`)

**Cuándo:** se agregó una tabla nueva a `db/001_schema.sql`. Por ejemplo, `metrica_exportacion` en su momento.

```bash
npm run db:push --workspace backend
```

- Solo crea lo que falta (`CREATE ... IF NOT EXISTS`). No borra nada y no carga contenido.
- **No agrega columnas** a tablas que ya existen. Si una tabla cambia, hace falta `--reset`.

**Verificar:** la tabla nueva aparece en la base, y `GET /api/health` responde `"estado":"ok"`.

## 10.2 Sincronizar el contenido

**Cuándo:** cambió la planilla "Bot IFTS29 - Contenido" o un documento de Drive.

En local:

```bash
npm run sync --workspace backend
```

En producción: `POST /api/sync` con el secreto `SYNC_SECRET` (ver [02 § 2.5](02-manual-tecnico.md)).

- Si la planilla tiene errores, la sincronización **no escribe nada** y devuelve la lista de errores. Corregir la planilla y volver a correr.
- La base de conocimiento se reemplaza completa. Menú, respuestas y contactos se actualizan por clave.
- Los documentos se comparan por `fragmentos_md5`: si el archivo no cambió, no se vuelve a extraer.

**Verificar:** la respuesta tiene `ok: true` y `errores` vacío. Después, consultas de referencia en el widget: `para aprobar abd necesito`, `condicons de abd`, `inscripcion a materias`.

## 10.3 Resetear la base (`--reset`)

**Cuándo:** el esquema cambió de forma que `db:push` no alcanza (por ejemplo, una columna nueva en una tabla que ya existe), o la base local quedó inconsistente.

**Antes de empezar:**

1. **Respaldar `metrica_opcion` a CSV** (ver [10.6](#106-respaldo-de-metrica_opcion)). El reset conserva las filas en memoria, pero si el proceso se corta entre el borrado y la restauración, se pierden. Hoy el respaldo es manual; no está automatizado.
2. Confirmar que la base apuntada por `DATABASE_URL` es la correcta. Para Neon, eso requiere confirmación explícita.

```bash
cd backend
node --import tsx src/db/push.ts --reset
cd ..
npm run sync --workspace backend      # el reset deja las tablas de contenido vacías
```

**Verificar:** `GET /api/health`, el menú raíz responde con datos, y las consultas de referencia de [10.2](#102-sincronizar-el-contenido) funcionan. Las filas de `metrica_opcion` siguen estando.

## 10.4 Actualizar `fragmentos_md5` (re-extraer los PDFs)

**Cuándo:** cambió la forma de extraer o normalizar el texto de los PDFs (por ejemplo, el normalizador que genera `texto_busqueda`). Los fragmentos viejos quedan con el texto anterior, y las búsquedas de extractos dejan de coincidir en silencio.

No es una tarea de rutina. Antes de hacerla, verificar que haga falta: comparar `texto_busqueda` de la base con lo que produce el normalizador actual. Esa verificación todavía no se hizo.

Procedimiento:

```sql
-- Sobre la base que corresponda (local o Neon, con confirmación)
UPDATE documento SET fragmentos_md5 = NULL;
```

Después, correr la sincronización ([10.2](#102-sincronizar-el-contenido)). Como el MD5 ya no coincide, cada documento se descarga y se extrae de nuevo.

- Son todos los documentos, con sus descargas de Drive. Hacerlo en local es más seguro que dentro de la función de Vercel, que tiene 30 s de máximo (ver [09](09-pendientes-proximas-iteraciones.md), sección 6).
- Si la sincronización se corta a mitad, los documentos sin `fragmentos_md5` quedan como pendientes. Volver a correr la sincronización los completa.

**Verificar:** `SELECT count(*) FROM documento WHERE fragmentos_md5 IS NULL;` debe dar `0` al terminar, y una consulta de extracto (por ejemplo, `como apruebo abd`) devuelve pasajes.

## 10.5 Exportación mensual de métricas

**No requiere acción manual.** Vercel llama a `GET /api/metricas/exportar-mes-anterior` el día 1 de cada mes a las 06:00 (UTC), y publica el mes anterior en la planilla de métricas, con una pestaña por mes.

Para verificar que corrió, mirar los logs de la función en Vercel o la pestaña del mes anterior en la planilla. Si la pestaña no se actualizó, revisar que `CRON_SECRET` y las variables `GOOGLE_METRICAS_*` sigan cargadas en Vercel.

Solo hace falta llamarlo a mano para **rehacer un mes**, por ejemplo después de corregir datos:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" "https://<dominio>/api/metricas/exportar-mes-anterior?mes=AAAA-MM"
```

- Reemplaza la pestaña de ese mes con los datos actuales de `metrica_opcion`. No suma a lo anterior.
- Si el mes no tiene datos, la pestaña queda vacía. Si un mes quedó con menos datos porque se borraron filas, reexportarlo no recupera nada.
- **No correrlo en local contra la planilla de producción con el mes actual**, porque reemplaza esa pestaña.

Detalle de la exportación: [02 § 2.5](02-manual-tecnico.md) y [04](04-base-datos.md).

## 10.6 Respaldo de `metrica_opcion`

**Cuándo:** antes de cualquier `--reset` contra Neon, y periódicamente como seguro.

**Hoy es manual:** exportar la tabla completa a CSV desde DBeaver (o `psql`), y guardar el archivo con la fecha en el nombre, fuera del repo. Ejemplo con `psql`:

```bash
psql "$DATABASE_URL" -c "\copy metrica_opcion TO 'metrica_opcion_AAAA-MM-DD.csv' CSV HEADER"
```

Un respaldo verificable también se puede comprobar contando las filas: el número debe coincidir con `SELECT count(*) FROM metrica_opcion`.

La automatización (un comando `npm run metricas:respaldo`) está pendiente, ver [09](09-pendientes-proximas-iteraciones.md), sección 5.

## 10.7 Rotación de secretos y claves

**Cuándo:** un secreto se filtró, alguien que tenía acceso dejó de tenerlo, o se cumple el plazo interno.

| Secreto | Dónde se usa | Cómo rotarlo |
|---|---|---|
| `SYNC_SECRET` | `POST /api/sync` | Generar uno nuevo, cargarlo en Vercel y en el `.env` local |
| `CRON_SECRET` | Cron de métricas y llamadas manuales a la exportación | Igual que `SYNC_SECRET`. Vercel toma el valor nuevo en el siguiente despliegue |
| Clave de la cuenta de lectura (`GOOGLE_PRIVATE_KEY`) | Sincronización | Crear una clave nueva en Google Cloud, cargarla, y borrar la anterior |
| Clave de la cuenta de métricas (`GOOGLE_METRICAS_PRIVATE_KEY`) | Exportación | Igual que la anterior |

Después de rotar una clave de cuenta de servicio, verificar la tarea que la usa (sincronización: [10.2](#102-sincronizar-el-contenido); métricas: [10.5](#105-exportación-mensual-de-métricas)).

**Acceso a la planilla de métricas:** revisar periódicamente que solo tengan acceso la cuenta de métricas y las personas que la administran. La cuenta de lectura **no** debe tener acceso a esa planilla.

---

## 10.8 Checklist antes de un despliegue

1. Respaldo de `metrica_opcion` hecho (si hay reset).
2. Esquema aplicado (`db:push`, o `--reset` si corresponde).
3. Contenido sincronizado, con `errores` vacío.
4. Variables de entorno cargadas en Vercel (`DATABASE_URL`, `SYNC_SECRET`, `CRON_SECRET`, `GOOGLE_*`, `GOOGLE_METRICAS_*`).
5. `GET /api/health` en `"ok"`, y consultas de referencia del widget.

Referencias: [04 § 4.4 a 4.5](04-base-datos.md), [02 § 2.5 y 2.6](02-manual-tecnico.md), [09](09-pendientes-proximas-iteraciones.md).
