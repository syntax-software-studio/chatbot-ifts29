# 04 · La base de datos como fuente única (deprecar el seed)

**Estado:** en implementación. Pasos 1 y 2 completados; sigue el paso 3. Rama de trabajo: `feat/base-fuente-unica`.

**Para quién:** equipo del proyecto (decisión de arquitectura y plan de migración).

## Resumen

La base de datos PostgreSQL es la **única fuente** del menú y de la base de conocimiento. Se usa Postgres local con Docker en desarrollo y Neon en producción; la misma variable `DATABASE_URL` sirve para ambos. El contenido estructurado vive en una planilla de Google en Drive, y los documentos en Drive. La sincronización carga todo desde Drive a la base. El catálogo semilla (`backend/src/seed/`) se depreca y se retira en pasos.

## Estado actual

**Hecho:**
- **Driver único `pg`.** Se reemplazó `@neondatabase/serverless` por `pg` (node-postgres). Ya no hay un driver por entorno. Verificado: `pg` 8.23 soporta SCRAM-SHA-256.
- **Postgres local con Docker.** `docker compose up` levanta la base, y el Dockerfile copia `001_schema.sql`, `002_seed.sql` y `005_kb_seed.sql` al arranque.
- **API contra la base local.** `/api/health` responde `ok`, el menú sale de la base, y el texto libre responde desde la base de conocimiento.
- **Planilla de contenido.** Creada en Drive como "Bot IFTS29 - Contenido", con las ocho pestañas cargadas desde los CSV y verificadas (encabezados y cantidad de filas).
- **Convención de nombres de documentos** confirmada y aplicada en Drive (ver más abajo).
- **Origen de datos renombrado** de `neon` a `base`, porque el nombre anterior no describía lo que indica (hay base de datos, sea local o Neon).

**Pendiente:**
- Submenú por comisión y derivación por motivo (código nuevo, ver más abajo).
- Schema sin `ALTER` y protección de métricas frente al reset.

## Qué hace el seed hoy

El seed cumple tres funciones, y cada una necesita un reemplazo:

| Función | Dónde está | Por qué existe |
|---|---|---|
| **Modo demo sin infraestructura** | `db/catalogo.ts`, `db/conocimiento.ts`, `drive.service.ts` (cuando `getPool()` es `null`) | Levantar el proyecto sin base de datos |
| **Corpus de tests** | `backend/test/solo-semilla.ts` y los tests que lo importan | Tests deterministas, sin red |
| **Autoría del SQL** | `backend/src/db/generar-kb-seed.ts` genera `db/005_kb_seed.sql`; `002_seed.sql` espeja `seed/catalogo.ts` | Escribir el contenido una sola vez, en código |

El seed también contiene el árbol del menú (categorías, opciones, respuestas, documentos, contactos).

No es un respaldo ante caídas: con `DATABASE_URL` configurada, si la base falla el bot responde "motor no disponible" y no cae al seed.

## Inventario de dependencias del seed

| Archivo | Depende de | Qué pasa si se retira el seed | Reemplazo |
|---|---|---|---|
| `backend/src/db/catalogo.ts` | `seedData` como rama de cada función | Se quitan las ramas; los tests que dependen de `seedData` dejan de funcionar | Sólo consultas a la base |
| `backend/src/db/conocimiento.ts` | `seedKb` en `candidatosSeed` | Desaparece el camino en memoria del matching | Sólo SQL (`buscarExacto`, `buscarSimilares`) |
| `backend/src/services/drive.service.ts` | `getPool() ? 'base' : 'seed'` en `sincronizarDocumentos()` | Sin base, la sync no tiene dónde escribir (ya lo informa) | Sin cambios de fondo |
| `backend/src/db/generar-kb-seed.ts` | `seedKb` como autoría | Se pierde el generador de `005_kb_seed.sql` | El contenido entra por la sync desde la planilla |
| `backend/src/db/push.ts` | Aplica `001`, `002`, `005` | Sigue funcionando, pero `005` ya no se regenera | Sólo esquema, cuando `002` y `005` se retiren |
| `backend/test/solo-semilla.ts` | Vacía `DATABASE_URL` para forzar el seed | Los tests necesitan otra fuente | Fixtures o base local de prueba |
| `backend/test/kb-seed.test.ts` | `seedKb` | Pierde sentido | Test de la sync y de la carga |
| `backend/test/sql-coincide.test.ts` | Cruza SQL con DDL | Se mantiene | Sin cambios |
| `backend/test/api.test.ts`, `conocimiento.test.ts`, `nl.service.test.ts` | `solo-semilla` y `seedData` | Hay que reescribirlos sobre fixtures | Ver paso 3 |

## Decisiones

1. **Fuente única en Drive.** El contenido de los documentos y el contenido estructurado viven en Drive. La base se carga desde Drive; no hay copias en el repo.
2. **Contenido estructurado en una planilla de Google** ("Bot IFTS29 - Contenido"), con una pestaña por tabla. Tiene historial de versiones y la edita el equipo sin código. La sync la lee con la API de Google Sheets (sólo lectura).
3. **Documentos identificados por el nombre del archivo.** La sync descubre los PDF en la carpeta de Drive, parsea el nombre y crea o actualiza la ficha. Un nombre que no se puede parsear se reporta y no se publica. No hay lista aparte de documentos.
4. **Un solo driver de base de datos (`pg`)** para Postgres local y para Neon. Se eliminó el driver HTTP.
5. **El contacto de derivación** tiene un motivo corto, que es lo que el estudiante ve como opción. El texto largo del PDF `contacto.pdf` queda como respaldo, fuera de la carpeta de documentos.

### Formato de la planilla

| Pestaña | Columnas |
|---|---|
| `categorias` | clave, nombre, mensaje, orden, es_raiz |
| `opciones` | clave, categoria, etiqueta, tipo (navegar / responder / derivar), destino, respuesta, orden, es_volver |
| `respuestas` | clave, texto, orden |
| `respuesta_documentos` | respuesta, documento (nombre del archivo en Drive), orden |
| `intenciones` | clave, nombre, dominio, opcion |
| `preguntas` | intencion, pregunta, prioridad, umbral |
| `variantes` | intencion, pregunta, texto, peso |
| `contactos` | clave, nombre, area, comision, email, perfil, motivo, orden |

**Requisitos de configuración en Google (lado del equipo):**
- Habilitar la API de Google Sheets en el proyecto de Google Cloud de la cuenta de servicio.
- Compartir la planilla y la carpeta de Drive con la cuenta de servicio, como lector.

**Variables de entorno nuevas:** `GOOGLE_SHEET_ID` (el ID de la planilla, entre `/d/` y `/edit` de su URL).

### Convención de nombres de documentos

Formato: `<CódigoMateria>_<Tipo>[_<Comisión>]_<Año>[_<CuatrimestreDeCursada>].pdf`

- **`CódigoMateria`:** `ABD`, `EAM`, `LC`, `TP`, o `GENERAL` para documentos que no son de una materia.
- **`Tipo`:** lista cerrada: `programa`, `cronograma`, `condiciones`, `horarios`, `contacto`, `entrega-documentacion`, `reglamento`, `plan-estudios`, `carga-horaria`, `correlatividades`, `equivalencias`, `guia-foros`, `instructivo-mensajeria`, `protocolo-examenes`. Las palabras compuestas usan guion.
- **`Comisión`** (opcional): sólo para documentos que dependen de la comisión. Va antes del año. Ejemplo: `ABD_condiciones_A_2026_1C.pdf`.
- **`Año`:** año al que corresponde el documento. Define si está actualizado. La sync puede marcar como no vigentes los archivos de años anteriores.
- **`CuatrimestreDeCursada`** (opcional, va al final): `1C` o `2C`. Indica en qué cuatrimestre de cursada está ubicada la materia dentro del plan de la carrera. **No es una fecha ni una versión del documento.** Los documentos `GENERAL` no lo llevan.

Ejemplos: `ABD_cronograma_2026_1C.pdf`, `ABD_condiciones_B_2026_1C.pdf`, `GENERAL_reglamento_2026.pdf`.

**Excepciones pendientes en Drive:** `EAM_condiciones` no existe; la fila de `respuesta_documentos` queda con su nombre esperado, y la sync la reporta como faltante hasta que el archivo aparezca. Los archivos de nombre viejo (`programa__…`, `condiciones__…`, `reglamento__general.pdf`) son un respaldo y no los usa el bot.

### Submenú por comisión

Aplica a los documentos de materia (`ABD`, `EAM`, `LC`, `TP`):
- Si un tipo tiene archivos por comisión (por ejemplo `ABD_condiciones_A_…` y `ABD_condiciones_B_…`), el menú pregunta la comisión antes de mostrar el documento. Las opciones son las comisiones que existen para ese tipo.
- Si un tipo no tiene archivos por comisión (por ejemplo `ABD_cronograma_2026_1C.pdf`), se muestra el archivo único, sin preguntar.
- Los documentos `GENERAL` no tienen submenú.
- Las comisiones se toman de los nombres de archivo, no de una tabla aparte.

**Estado en el código:** no existe. El seed deja los submenús contextuales vacíos en el MVP (`seed/catalogo.ts`, `opcion_contexto`). Hay que construirlo en la sync y en el menú.

### Derivación por motivo

La opción de tipo `derivar` (hoy `RAIZ_OP_NOENCONTRE`, "No encontré lo que busco") pregunta por el **motivo** de la consulta. Cada motivo lleva al contacto que corresponde. Después se filtra por comisión: los contactos con comisión `A` o `B` aparecen sólo para esa comisión, y los de comisión `General` aparecen para todas.

- Las etiquetas de los motivos son la columna `motivo` de `contactos`: "Orientación cursada" (Tutorías, comisiones A y B), "Trámites, certificados, etc." (Bedelía) y "Entrega de documentación".
- La lógica exacta de qué motivo lleva a qué contacto se ajusta más adelante, con consultas reales.

**Estado en el código:** la derivación ya existe con la misma estructura; la parte de motivo y filtro por comisión hay que ajustarla.

## Plan de migración

Cada paso tiene un criterio de salida. No se avanza al siguiente sin cumplirlo.

**Paso 1. Entorno local con Postgres.** ✅ Completado.
Docker levanta la base con los tres archivos SQL. La API corre contra esa base: `/api/health` responde `ok`, el menú y el texto libre salen de la base.
*Salida cumplida:* el backend responde desde Postgres local, con `origen: "base"`.

**Paso 2. Sync de contenido.** ✅ Completado.
1. Lector de la planilla (`fuente-contenido.service.ts`): lee las ocho pestañas con la API de Sheets, en sólo lectura, y valida los encabezados.
2. Conversión y carga (`carga-contenido.service.ts`): convierte y valida todo antes de escribir; si hay errores, no escribe nada. La escritura es una sola transacción.
3. Documentos: la ficha se crea por nombre de archivo, y la sync con Drive completa enlaces e IDs.
4. Prueba local: verificada contra Postgres de Docker (menú, texto libre, derivación y documentos).

Un solo comando sincroniza todo: `POST /api/sync` o `npm run sync --workspace backend`. Primero carga el contenido de la planilla y después sincroniza los documentos.

*Salida cumplida:* la base tiene sólo el contenido de la planilla. Lo que no está en la planilla se borra en cada sync (el seed se retiró como fuente y ya no tiene filas en la base). Las métricas no se tocan.

**Paso 3. Fixtures de test.**
Conjunto chico de datos en `backend/test/fixtures/` (3 o 4 documentos ficticios) y un repositorio inyectable en `interpretarConsulta`. Los tests de comportamiento dejan de importar el seed.
*Salida:* `npm test` pasa sin importar `backend/src/seed/`.

**Paso 4. Conjunto dorado.**
Archivo de consultas con respuesta esperada y un script que reporta aciertos y falsos positivos por umbral. Se corre contra la base.
*Salida:* línea base medida del motor actual.

**Paso 5. Menú y conocimiento sin seed.**
El menú y la base de conocimiento salen de la planilla. `002_seed.sql` y `005_kb_seed.sql` dejan de ser fuente: `db:push` aplica sólo el esquema (`001_schema.sql`).
*Salida:* `db:push` aplica sólo el esquema, y el contenido entra por la sync.

**Paso 6. Retiro.**
Eliminar `backend/src/seed/`, `generar-kb-seed.ts`, `solo-semilla.ts` y las ramas `getPool() ? ... : seed` del código. Marcar `fuente()` como base-only.
*Salida:* ningún archivo de `backend/src` importa el seed, y `grep -r "seed/" backend/src` no devuelve resultados.

## Preguntas abiertas

- **Métricas antes de un reset.** `db:reset` borra `metrica_opcion` y `sesion_contexto`, y no hay copia. Hace falta exportarlas o excluirlas del reset antes de usarlo.
- **Modo demo.** ¿Se necesita una demo sin base de datos? Si sí, la alternativa es un volcado de la base a un archivo, no el seed en código.
- **Quién ejecuta la sync.** Hoy es `POST /api/sync` para personal autorizado. ¿Se programa, o se ejecuta a mano al inicio de cada cuatrimestre?
- **Textos escritos a mano.** Varias respuestas (por ejemplo, "Estas son las condiciones oficiales…") son texto del bot. Quedan en la planilla, en la pestaña `respuestas`, y el equipo las edita ahí.
- **Schema sin `ALTER`.** `001_schema.sql` todavía contiene sentencias `ALTER` de migraciones anteriores. Reescribirlo como estado final está acordado y pendiente.
- **Permisos de escritura sobre la planilla.** Hoy la cuenta de servicio sólo lee. La carga inicial la hace el equipo importando los CSV.

## Análisis inicial

Esta sección describe el estado antes de empezar esta rama, y se mantiene como referencia.

1. **La sync no cargaba contenido.** `sincronizar()` sólo actualizaba metadatos de `documento` (ID de Drive, MD5, enlaces, vigencia).
2. **No había fixtures de test.** Los tests dependían del catálogo completo.
3. **El desarrollo local no tenía ruta documentada sin Neon.** Se resolvió con el paso 1.
4. **El menú no tenía fuente alternativa.** Su estructura vivía en `seed/catalogo.ts`.
5. **El contenido no tenía formato de autoría editable.** Se resolvió con la planilla.
6. **El matching no tenía corpus medido.** Pendiente en el paso 4.

## Relación con otros documentos

- `02-preguntas-y-fuentes.md`: define qué preguntas necesita responder el bot y qué fuente tiene cada una.
- `01-estructura-menu.md`: define la estructura del menú, que sale de la planilla.
- `docs/desarrollo-e-integracion/04-base-datos.md` (sección 4.4) y `02-manual-tecnico.md` (modo demo): describen el seed como alternativa vigente. Están marcados como deprecados y apuntan a este documento.
