# 11 · Revisión del modelo de datos y contrato de contenido

**Estado:** propuesta (borrador). Describe lo que hay hoy y propone cambios. Implementado hasta ahora: renombrado de tablas y vistas (§11.6), en código y SQL. Pendientes: columnas (§11.6, "Alinear planilla y base") y bases existentes (local y Neon).

**Para quién:** el equipo de desarrollo y, en la entrega, quien gestione el contenido del asistente. Los nombres de tablas y columnas se revisan con ese criterio: que alguien sin formación técnica pueda entender qué carga y qué significa.

## 11.1 Objetivo

Reducir la complejidad que el administrador tiene que manejar para publicar contenido nuevo. Hoy el modelo tiene 17 tablas, convenciones de nombres mezcladas y reglas que solo están en el código. La meta es que el cliente gestione el sistema sin depender del equipo técnico.

## 11.2 Dominios del sistema

El sistema se divide en cinco dominios. Cada tabla pertenece a uno solo, salvo las que se comparten y se indican en la columna "Compartidas con".

| Dominio | Responsabilidad | Código principal | Tablas que escribe | Tablas que lee |
|---|---|---|---|---|
| **Sincronización** (ETL) | Leer la planilla y Drive, validar, transformar y escribir el contenido | `sync-extract`, `sync-transform`, `sync-load`, `planilla.ts`, `secciones.ts`, `comisiones.ts` | Todas las de contenido y conocimiento | Planilla, Drive |
| **Contenido** | Lo que el bot muestra: menú, respuestas, documentos y contactos | `chat-menu.repository` (lectura) | `menu_categoria`, `menu_opcion`, `respuesta`, `respuesta_documento`, `documento`, `documento_fragmento`, `contacto`, `opcion_contacto` | Chat, conocimiento |
| **Chat** | Decide cada turno: menú, respuesta, derivación, aclaración o "no disponible" | `chat.service`, `fragmentos.service`, `chat.routes`, `menu.routes` | Ninguna (solo métricas) | Contenido, conocimiento |
| **Conocimiento** | Interpreta el texto libre y lo ubica en una opción del menú | `kb.service`, `kb-conocimiento.repository`, `normalizar.ts` | `kb_intencion`, `kb_pregunta`, `kb_pregunta_variante`, `kb_alias`, `kb_termino_ignorado` (desde el ETL) | Contenido (`respuesta`, `menu_opcion`) |
| **Métricas** | Registrar cada turno y publicar el reporte mensual | `analytics.service`, `analytics.repository`, `metricas.ts`, `sheets-metricas.client`, `metricas.routes` | `metrica_opcion`, `metrica_exportacion` | Ninguna del contenido |

**Compartidas:** `respuesta` y `documento` pertenecen al contenido, pero las lee el chat y el conocimiento. `kb_pregunta.respuesta_id` cruza conocimiento y contenido. `documento_fragmento` lo genera el ETL y lo usa el chat para buscar pasajes.

## 11.3 Superficies de gestión

Quien gestiona el sistema toca dos lugares. El resto es interno.

| Superficie | Qué se hace | Qué regla la rige |
|---|---|---|
| **Planilla de Google** ("Bot IFTS29 - Contenido") | Completar 10 pestañas: menú, respuestas, documentos por respuesta, intenciones, preguntas, variantes, contactos, alias e ignorados | Encabezados exactos (§11.4.1) y referencias por clave entre pestañas |
| **Carpeta de Drive** | Subir los PDF con el nombre correcto (§11.4.2) | Nombre de archivo = clave del documento |
| **Drive, como salida** | La planilla de métricas mensual se publica en Drive | Lo genera el sistema; no lo edita nadie |

Después de cada cambio se corre la sincronización (`npm run sync` o `POST /api/sync`). La respuesta indica errores de planilla y documentos sin archivo (`sinMatch`).

## 11.4 Contrato de contenido: reglas implícitas

Estas reglas hoy están repartidas entre la planilla, el código y la doc 07. Son el contrato que el cliente tiene que respetar.

### 11.4.1 Planilla

- Cada pestaña debe tener los encabezados exactos del esquema (`ESQUEMA_CONTENIDO` en `planilla.ts`). Si falta una pestaña o un encabezado, la sincronización muestra todos los errores y no escribe nada.
- Las columnas extra y las pestañas no incluidas en el esquema se ignoran. Sirven como hojas de trabajo.
- Las filas completamente vacías se ignoran.
- Las relaciones se hacen por **clave de texto** (columna `clave`, o el nombre de la pestaña referenciada), no por número.

### 11.4.2 Nombre de documento

Patrón (`comisiones.ts`):

```
<CódigoMateria>_<tipo>[_<Comisión>]_<Año>[_<CuatrimestreDeCursada>]
```

- **CódigoMateria:** letras mayúsculas (`ABD`, `EAM`, `LC`, `TP`, `GENERAL`).
- **tipo:** minúsculas, con guion para palabras compuestas (`entrega-documentacion`, `plan-estudios`).
- **Comisión:** una sola letra mayúscula, opcional. Solo para documentos que dependen de la comisión.
- **Año:** cuatro dígitos.
- **Cuatrimestre de cursada:** `1C` o `2C`, opcional. No es una fecha ni una versión.

Según la doc 07 (decisión 3), un nombre que no se puede parsear no se publica. Esto está pendiente de confirmar en el código de carga. El campo `tipo` **no se guarda** en la base; es solo parte del nombre.

### 11.4.3 Vínculo entre planilla y Drive

- La pestaña `respuesta_documentos` referencia cada PDF por su nombre sin `.pdf`.
- El emparejamiento es exacto. Un PDF que la planilla referencia y que no está en Drive se reporta como `sinMatch`, y el bot no le muestra enlace.
- Un documento que está en Drive y no está referenciado en la planilla **no existe** para el bot.

### 11.4.4 Contenido de los PDF

- El texto tiene que ser seleccionable. Un PDF escaneado no tiene fragmentos y se muestra completo.
- Los fragmentos para búsqueda se separan por título. El título se reconoce de tres maneras:
  1. Una línea que coincide con la lista `TITULOS_CONOCIDOS` de `secciones.ts`.
  2. Un texto al inicio de la línea seguido de `:` (por ejemplo `FINAL: ...`), si el texto está en la lista.
  3. Un encabezado en mayúsculas, corto y sin viñetas ni datos de tabla.

  **Importante:** un título nuevo que no esté en la lista y no tenga el formato 3 queda dentro de la sección anterior. Agregarlo hoy requiere cambiar código.

### 11.4.5 Comisiones

- El bot pregunta la comisión solo si una respuesta tiene documentos de **dos o más comisiones del mismo grupo** (misma materia, tipo, año y cuatrimestre).
- Si la respuesta tiene un solo documento, o documentos sin comisión, responde directo.

## 11.5 Hallazgos sobre el modelo actual

1. **`documento.tipo` nunca se completa.** La sincronización inserta siempre `'documento'`. El `CHECK` lista valores que no coinciden con los tipos del nombre de archivo (`condiciones_aprobacion` frente a `condiciones`).
2. **`documento.estado` se pisa en cada sincronización.** La sincronización fuerza `estado = 'vigente'` y `vigente = TRUE` para todo documento encontrado en Drive. Solo `archivado` se mantiene. Los estados `borrador`, `revision` y `reemplazado` no son usables hoy.
3. **Columnas sin uso.** `vigencia_desde`, `vigencia_hasta`, `observaciones` y `drive_carpeta` no se leen ni se escriben en el código. `documento.descripcion` no la carga la sincronización.
4. **Identidad repetida en `documento`.** `clave`, `nombre` y `drive_nombre_archivo` contienen el mismo dato (con y sin `.pdf`). `drive_url` y `drive_view_url` se pueden derivar de `drive_file_id`. `mime_type` es siempre PDF.
5. **Contacto y opción.** La planilla asigna un contacto a una sola opción (columna `opcion`). La base lo modela como N:M con `opcion_contacto`, que tiene su propio `orden` además de `contacto.orden`.
6. **Texto del bot fuera de `respuesta`.** `categoria.mensaje` contiene texto institucional. `kb_pregunta.respuesta_id` apunta a `respuesta`, pero está vacío en todas las filas actuales.
7. **Documentos sin registro propio.** No hay pestaña de documentos. Las fichas se crean a partir de `respuesta_documentos`, y la existencia real depende de Drive.
8. **Claves mixtas.** Algunas relaciones usan `id` numérico (`categoria_id`) y otras la clave de texto (`kb_intencion.opcion_clave`, `metrica_opcion.opcion_clave`). Las métricas usan texto a propósito, para sobrevivir a los resets.
9. **Reglas en el código, no en la planilla.** Los títulos de sección (`TITULOS_CONOCIDOS`) y el patrón del nombre de documento viven en código. Cambiarlos no es tarea del administrador.

## 11.6 Propuesta de simplificación

### Nombres de tablas

Criterio: singular, castellano, sin acentos y sin prefijos técnicos. Cuando sea posible, el nombre coincide con la pestaña de la planilla.

| Actual | Propuesta | Motivo |
|---|---|---|
| `categoria` | `menu_categoria` | Nodo del árbol del menú. El prefijo indica que pertenece al menú |
| `opcion_menu` | `menu_opcion` | Botón del menú. Se distingue de `opcion_contacto` |
| `respuesta` | `respuesta` (sin cambio) | Clara |
| `respuesta_documento` | `respuesta_documento` (sin cambio) | Tabla de adjuntos |
| `documento` | `documento` (sin cambio) | Ficha del archivo en Drive |
| `documento_fragmento` | `documento_fragmento` (sin cambio) | Refleja lo que es: fragmentos del documento |
| `contacto` | `contacto` (sin cambio) | Clara |
| `opcion_contacto` | Eliminar si la relación sigue 1:1 (ver §11.7.2) | Pasa a una columna `opcion_id` en `contacto` |
| `kb_intencion` | `intencion` | Igual a la pestaña `intenciones` |
| `kb_pregunta` | `pregunta` | Igual a la pestaña `preguntas` |
| `kb_pregunta_variante` | `pregunta_variante` | Redacción completa con la que se compara la consulta. Igual a la pestaña `variantes` |
| `kb_alias` | `termino_equivalente` | Término que se reemplaza por su equivalente: una sigla ("abd") o un apodo ("pepito"). Pestaña `alias` (a renombrar junto con la tabla) |
| `kb_termino_ignorado` | `termino_ignorado` | Término que se descarta al consultar. Igual a la pestaña `ignorados` |
| `metrica_opcion` | `metrica_opcion` (sin cambio) | Clara |
| `metrica_exportacion` | `metrica_exportacion` (sin cambio) | Registra cada mes publicado |
| `v_arbol_menu` | `v_menu_arbol` | Castellano |
| `v_kb_resolucion` | `v_cobertura_intenciones` | Dice qué mide |

Los nombres de tablas no cambian la planilla. Cambian el SQL, los repositorios y las consultas, y conviene hacerlo junto con la alineación de columnas.

### Columnas

- **Alinear planilla y base:** el encabezado de la planilla es el nombre de la columna en la base. Hoy `dominio`/`domain`, `prioridad`/`priority`, `umbral`/`minimum_threshold`, `peso`/`weight` y `perfil`/`url_perfil` no coinciden.
- **Documento:** una sola identidad (`clave`, el nombre sin `.pdf`). Eliminar las columnas sin uso. Derivar los enlaces desde `drive_file_id`.
- **Tipo y comisión:** guardarlos al sincronizar, parseados del nombre de archivo. Así el administrador no los carga dos veces.
- **Estado del documento:** un único campo (ver §11.7.1).

### Reglas

- Mover los títulos de sección a la planilla (una pestaña `titulos`) para que el administrador pueda agregar uno sin tocar código. Es una decisión a evaluar, porque cambia el contrato de §11.4.4.
- Un solo lugar para el patrón del nombre de documento, con prueba automática.

## 11.7 Decisiones abiertas

1. **Ciclo de vida de los documentos.** ¿Alcanza con `vigente` / `archivado`, o se necesitan `borrador`, `revision` y `reemplazado`? Si es lo segundo, la sincronización deja de pisar el estado.
2. **Contacto y opción.** Hoy la relación es 1:1 y se propone una columna `opcion_id` en `contacto`. Si en el futuro un contacto puede estar en varias opciones, se vuelve a la tabla N:M.
3. **Títulos de sección.** ¿Pasan a la planilla o quedan en código?
4. **Idioma.** Se mantiene el castellano en las tablas y columnas. Los términos técnicos estándar (`search_vector`, `gin_trgm_ops`) quedan en inglés.

## 11.8 Traducción pendiente al castellano

Identificadores que hoy están en inglés y se pasan a castellano en el mismo cambio que los nombres de §11.6:

- Columnas: `domain` → `dominio`, `priority` → `prioridad`, `minimum_threshold` → `umbral_minimo`, `weight` → `peso`, `original_text` → `texto_original`, `normalized_text` → `texto_normalizado`.
- Tablas con prefijo `kb_` (ver §11.6): se eliminan los prefijos. Los nombres nuevos son `intencion`, `pregunta`, `pregunta_variante`, `termino_equivalente` y `termino_ignorado`.
- Vistas: `v_menu_arbol` y `v_cobertura_intenciones`.
- Comentarios del SQL que estén en inglés, si los hay.
