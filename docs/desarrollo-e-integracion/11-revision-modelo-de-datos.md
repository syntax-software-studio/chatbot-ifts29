# 11 · Revisión del modelo de datos y contrato de contenido

**Estado:** propuesta en curso. Lo ya implementado se retiró de este documento. Pendientes: contacto–opción, títulos de sección, idioma, hallazgos 5 a 8, nombres de las pestañas de la planilla, y la migración de bases existentes (local y Neon).

**Para quién:** el equipo de desarrollo y, en la entrega, quien gestione el contenido del asistente.

## 11.1 Objetivo

Reducir la complejidad que el administrador tiene que manejar para publicar contenido nuevo. La meta es que el cliente gestione el sistema sin depender del equipo técnico.

## 11.2 Dominios del sistema

El sistema se divide en cinco dominios. Cada tabla pertenece a uno solo, salvo las que se comparten y se indican en la nota de abajo.

| Dominio | Responsabilidad | Código principal | Tablas que escribe | Tablas que lee |
|---|---|---|---|---|
| **Sincronización** (ETL) | Leer la planilla y Drive, validar, transformar y escribir el contenido | `sync-extract`, `sync-transform`, `sync-load`, `planilla.ts`, `secciones.ts`, `comisiones.ts` | Todas las de contenido y conocimiento | Planilla, Drive |
| **Contenido** | Lo que el bot muestra: menú, respuestas, documentos y contactos | `chat-menu.repository` (lectura) | `menu_categoria`, `menu_opcion`, `respuesta`, `respuesta_documento`, `documento`, `documento_fragmento`, `contacto`, `opcion_contacto` | Chat, conocimiento |
| **Chat** | Decide cada turno: menú, respuesta, derivación, aclaración o "no disponible" | `chat.service`, `fragmentos.service`, `chat.routes`, `menu.routes` | Ninguna (solo métricas) | Contenido, conocimiento |
| **Conocimiento** | Interpreta el texto libre y lo ubica en una opción del menú | `kb.service`, `kb-conocimiento.repository`, `normalizar.ts` | `intencion`, `pregunta`, `pregunta_variante`, `termino_equivalente`, `termino_ignorado` (desde el ETL) | Contenido (`respuesta`, `menu_opcion`) |
| **Métricas** | Registrar cada turno y publicar el reporte mensual | `analytics.service`, `analytics.repository`, `metricas.ts`, `sheets-metricas.client`, `metricas.routes` | `metrica_opcion`, `metrica_exportacion` | Ninguna del contenido |

**Compartidas:** `respuesta` y `documento` pertenecen al contenido, pero las lee el chat y el conocimiento. `pregunta.respuesta_id` (antes `kb_pregunta.respuesta_id`) cruza conocimiento y contenido. `documento_fragmento` lo genera el ETL y lo usa el chat para buscar pasajes.

## 11.3 Superficies de gestión

Quien gestiona el sistema toca dos lugares. El resto es interno.

| Superficie | Qué se hace | Qué regla la rige |
|---|---|---|
| **Planilla de Google** ("Bot IFTS29 - Contenido") | Completar 10 pestañas: menú, respuestas, documentos por respuesta, intenciones, preguntas, variantes, contactos, alias e ignorados | Encabezados exactos (§11.4.1) y referencias por clave entre pestañas |
| **Carpeta de Drive** | Subir los PDF con el nombre correcto (§11.4.2) | Nombre de archivo = clave del documento. Si el archivo sale de la carpeta, el documento deja de ofrecerse |
| **Drive, como salida** | La planilla de métricas mensual se publica en Drive | Lo genera el sistema; no lo edita nadie |

Después de cada cambio se corre la sincronización (`npm run sync` o `POST /api/sync`). La respuesta indica errores de planilla, documentos sin archivo y nombres fuera de la convención.

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

Al sincronizar, el sistema lee estos campos del nombre y los guarda en `documento` (`materia`, `tipo`, `comision`, `anio`, `cuatrimestre`). Un nombre que no cumple el patrón genera un aviso y esos campos quedan vacíos. El documento no se publica hasta que se corrija el nombre o el patrón de la doc 07 se ajuste.

### 11.4.3 Vínculo entre planilla y Drive

- La pestaña `respuesta_documentos` referencia cada PDF por su nombre sin `.pdf`.
- El emparejamiento es exacto. Un PDF que la planilla referencia y que no está en Drive se reporta como `sinMatch`, y el bot no le muestra enlace.
- Un documento que está en Drive y no está referenciado en la planilla **no existe** para el bot.
- Un documento que sale de la carpeta pierde su archivo en la siguiente sincronización. El bot muestra "Documento en preparación" hasta que vuelva a subirse.

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
- El chat usa los campos guardados en la base, no el nombre del archivo.

## 11.5 Hallazgos pendientes sobre el modelo

5. **Contacto y opción.** La planilla asigna un contacto a una sola opción (columna `opcion`). La base lo modela como N:M con `opcion_contacto`, que tiene su propio `orden` además de `contacto.orden`.
6. **Texto del bot fuera de `respuesta`.** `menu_categoria.mensaje` contiene texto institucional. `pregunta.respuesta_id` apunta a `respuesta`, pero está vacío en todas las filas actuales.
7. **Documentos sin registro propio.** No hay pestaña de documentos. Las fichas se crean a partir de `respuesta_documentos`, y la existencia real depende de Drive.
8. **Claves mixtas.** Algunas relaciones usan `id` numérico (`menu_categoria_id`, `categoria_id`) y otras la clave de texto (`intencion.opcion_clave`, `metrica_opcion.opcion_clave`). Las métricas usan texto a propósito, para sobrevivir a los resets.

## 11.6 Pendientes de contrato y nombres

- **Reglas en el código:** mover los títulos de sección a la planilla (una pestaña `titulos`) para que el administrador pueda agregar uno sin tocar código. Cambia el contrato de §11.4.4. Pendiente de decisión (§11.7.2).
- **Un solo lugar para el patrón del nombre de documento**, con prueba automática.
- **Nombres de las pestañas de la planilla:** `alias`, `ignorados` y `variantes` siguen con su nombre actual. Decidir si se renombran para coincidir con las tablas `termino_equivalente`, `termino_ignorado` y `pregunta_variante`. Renombrarlas obliga al administrador a cambiar la planilla.

## 11.7 Decisiones abiertas

1. **Contacto y opción.** Hoy la relación es 1:1 y se propone una columna `opcion_id` en `contacto`. Si en el futuro un contacto puede estar en varias opciones, se vuelve a la tabla N:M.
2. **Títulos de sección.** ¿Pasan a la planilla o quedan en código?
3. **Idioma.** Se mantiene el castellano en las tablas y columnas. Los términos técnicos estándar (`search_vector`, `gin_trgm_ops`) quedan en inglés.
4. **Permisos al cliente (decidido).** El cliente recibe el archivo de la planilla como editor, con las pestañas de configuración protegidas (solo el dueño las edita) y los encabezados de cada pestaña protegidos. La carpeta de Drive se comparte como editor. Todo lo ajustable vive en Drive, y la gestión no requiere acceso a la base. Se mantiene en código `ESQUEMA_CONTENIDO`, porque es el contrato que valida la carga. Hay que verificar en una prueba que el cliente no pueda quitar la protección.
5. **Función de cada lista (pendiente de documentar para el cliente).** `PALABRAS_VACIAS`, `ignorados` y los títulos de sección (`termino_reconocimiento_fragmento`) tienen funciones distintas. Hay que escribir para el cliente, con sus palabras, qué hace cada una y cuándo se aplica.
6. **Variantes a partir de los títulos (pendiente).** Hoy una consulta como "bibliografia abd" no llega a un pasaje, porque ninguna variante la asocia a la intención de programa, aunque el título exista en los fragmentos. Propuesta: generar variantes al sincronizar, "<título> de <materia>" para cada título que aparece en los documentos de una intención. Riesgo: títulos genéricos ("final", "promoción", "cronograma") pueden crear variantes ambiguas. Hay que marcar qué títulos sirven como pregunta, o excluir los genéricos. Alternativa: que el bot use los fragmentos como evidencia al elegir la intención (cambio de lógica, no de contenido).
