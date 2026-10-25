# 04 · La base de datos como fuente única (deprecar el seed)

**Estado:** propuesta para discusión. No implementada. Rama de trabajo: `feat/base-fuente-unica`.

**Para quién:** equipo del proyecto (decisión de arquitectura y plan de migración).

## Resumen

Proponemos que la base de datos (Neon en producción, PostgreSQL local en desarrollo) sea la **única fuente** del menú y de la base de conocimiento. El contenido entra por una sincronización repetible desde Drive, no por código TypeScript. El catálogo semilla (`backend/src/seed/`) se depreca y se retira en pasos.

## Qué hace el seed hoy

El seed cumple tres funciones distintas, y cada una necesita un reemplazo:

| Función | Dónde está | Por qué existe |
|---|---|---|
| **Modo demo sin infraestructura** | `db/catalogo.ts`, `db/conocimiento.ts`, `drive.service.ts` (cuando `getPool()` es `null`) | Levantar el proyecto sin Neon |
| **Corpus de tests** | `backend/test/solo-semilla.ts` y los tests que lo importan | Tests deterministas, sin red |
| **Autoría del SQL** | `backend/src/db/generar-kb-seed.ts` genera `db/005_kb_seed.sql`; `002_seed.sql` espeja `seed/catalogo.ts` | Escribir el contenido una sola vez, en código |

Además, el seed contiene el **árbol del menú** (categorías, opciones, respuestas, documentos, contactos), no sólo la base de conocimiento.

No es un respaldo ante caídas: con `DATABASE_URL` configurada, si Neon falla el bot responde "motor no disponible" y no cae al seed.

## Inventario de dependencias

| Archivo | Depende de | Qué pasa si se retira el seed | Reemplazo propuesto |
|---|---|---|---|
| `backend/src/db/catalogo.ts` | `seedData` como rama de cada función | Hay que quitar las ramas, y los tests que dependen de `seedData` dejan de funcionar | Sólo consultas a la base |
| `backend/src/db/conocimiento.ts` | `seedKb` en `candidatosSeed` | Desaparece el camino en memoria del matching | Sólo SQL (`buscarExacto`, `buscarSimilares`) |
| `backend/src/services/drive.service.ts` | `getPool() ? 'neon' : 'seed'` en `sincronizar()` | Sin base, la sync no tiene dónde escribir (ya lo informa) | Sin cambios de fondo |
| `backend/src/db/generar-kb-seed.ts` | `seedKb` como autoría | Se pierde el generador de `005_kb_seed.sql` | El contenido entra por sync desde Drive, no por generador |
| `backend/src/db/push.ts` | Aplica `001`, `002`, `005` | Sigue funcionando, pero `005` ya no se regenera | Migraciones versionadas |
| `backend/test/solo-semilla.ts` | Vacía `DATABASE_URL` para forzar el seed | Los tests necesitan otra fuente | Ver "Tests" abajo |
| `backend/test/kb-seed.test.ts` | `seedKb` | Pierde sentido | Test de la sync y de la carga |
| `backend/test/sql-coincide.test.ts` | Cruza SQL con DDL | Se mantiene, no depende del seed | Sin cambios |
| `backend/test/api.test.ts`, `conocimiento.test.ts`, `nl.service.test.ts` | `solo-semilla` y `seedData` | Hay que reescribirlos sobre fixtures | Ver "Tests" abajo |
| Documentación (`02-manual-tecnico.md`, `04-base-datos.md`, `05-pruebas-unitarias.md`, `06-pruebas-integracion.md`, `01-introduccion.md`) | Describen el modo demo y los tests contra el seed | Quedan desactualizadas | Se actualizan al migrar |

## Dónde quedaríamos parados si se retirara hoy

Estado actual, sin cambios de código previos:

1. **La sync no carga contenido.** `sincronizar()` sólo actualiza metadatos de `documento` (ID de Drive, MD5, enlaces, vigencia). No crea intenciones, preguntas, variantes ni respuestas, y no extrae texto de los PDF. Sin el seed, la base quedaría sin contenido conversacional.
2. **No hay fixtures de test.** Los tests dependen del catálogo completo. Hay que definir un conjunto chico y explícito, o correr los tests contra Postgres.
3. **El desarrollo local no tiene ruta documentada sin Neon.** El repo trae `docker-compose.yml` y `docker/postgres.dockerfile`, pero la documentación sólo describe el modo demo.
4. **El menú tampoco tiene fuente alternativa.** Su estructura vive en `seed/catalogo.ts`. Para deprecarlo, el árbol tiene que cargarse en la base desde una fuente definida (ver preguntas abiertas).
5. **El contenido no tiene formato de autoría.** Hoy el equipo escribe en TypeScript. Sin seed, hace falta un formato que el equipo pueda editar (ver preguntas abiertas).
6. **El matching no tiene corpus medido.** No existe un conjunto dorado de consultas con respuesta esperada (ver `03-ejemplo-pregunta-sencilla.md` y el análisis de tests). Sin él no se puede comparar el motor actual con el rediseño.

## Plan de migración

Cada paso tiene un criterio de salida. No se avanza al siguiente sin cumplirlo.

**Paso 1. Entorno local con Postgres.**
Documentar y verificar el arranque con `docker-compose.yml` y `db:push`, sin Neon.
*Salida:* el backend responde `origen: "neon"` con Postgres local.

**Paso 2. Sync de contenido.**
Extender `sincronizar()` para que, además de las fichas, cargue el contenido desde Drive: archivo, texto extraído y fragmentos (ver el rediseño de la base).
*Salida:* con una sync sobre una carpeta de prueba, la base tiene documentos con fragmentos y sin ningún dato del seed.

**Paso 3. Fixtures de test.**
Crear un conjunto chico de datos en `backend/test/fixtures/` (3 o 4 documentos ficticios) y un repositorio inyectable en `interpretarConsulta`. Los tests de comportamiento dejan de importar el seed.
*Salida:* `npm test` pasa sin importar `backend/src/seed/`.

**Paso 4. Conjunto dorado.**
Armar el archivo de consultas con respuesta esperada y un script que reporte aciertos y falsos positivos por umbral. Se corre contra la base.
*Salida:* línea base medida del motor actual.

**Paso 5. Menú desde la base.**
Mover la carga del árbol del menú a una fuente definida, y dejar `002_seed.sql` como única definición.
*Salida:* el menú se levanta sin `backend/src/seed/catalogo.ts`.

**Paso 6. Retiro.**
Eliminar `backend/src/seed/`, `generar-kb-seed.ts`, `solo-semilla.ts` y las ramas `getPool() ? ... : seed` del código. Actualizar la documentación listada arriba y marcar `fuente()` como neon-only.
*Salida:* ningún archivo de `backend/src` importa el seed, y `grep -r "seed/" backend/src` no devuelve resultados.

## Preguntas abiertas

- **Formato de autoría del contenido.** ¿Drive con una convención de nombres, una planilla, o un archivo de índice por materia? Las dos convenciones actuales (`<Materia>_<Tipo>.pdf` y `condiciones__<materia>.pdf`) no coinciden.
- **Fuente del menú.** ¿El árbol se edita en la base directamente, en una planilla, o en un archivo versionado en el repo?
- **Modo demo.** ¿Se necesita una demo sin Neon ni Postgres local? Si sí, la alternativa es un volcado de la base a un archivo, no el seed en código.
- **Quién ejecuta la sync.** Hoy es `POST /api/sync` para personal autorizado. ¿Se programa, o se ejecuta a mano al inicio de cada cuatrimestre?
- **Textos escritos a mano.** Varias respuestas (por ejemplo, "Estas son las condiciones oficiales…") son texto del bot. ¿Quedan en la base como plantilla, o salen del documento?

## Relación con otros documentos

- `02-preguntas-y-fuentes.md`: define qué preguntas necesita responder el bot y qué fuente tiene cada una.
- `01-estructura-menu.md`: define la estructura del menú, que pasaría a salir de la base.
- `docs/desarrollo-e-integracion/04-base-datos.md` (sección 4.4) y `02-manual-tecnico.md` (modo demo): describen el seed como alternativa vigente. Están marcados como deprecados y apuntan a este documento.
