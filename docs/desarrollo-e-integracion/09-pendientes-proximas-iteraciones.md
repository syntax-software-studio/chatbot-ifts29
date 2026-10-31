# 09 · Pendientes para próximas iteraciones

**Estado:** lista de trabajo. Reúne lo que no entra en la iteración actual, para no perderlo. Cada ítem tiene el documento donde se describe con más detalle.

## 1. Despliegue ordenado

Hoy el despliegue a producción son pasos manuales que tienen que correr en orden. Un error de orden no rompe nada a la vista, pero deja el chat degradado (por ejemplo, sin lista de términos ignorados). Hace falta un procedimiento que lo haga en el orden correcto y que se pueda repetir.

Orden propuesto:

1. **Respaldo** de `metrica_opcion` a CSV (el reset la conserva, pero el respaldo es la única recuperación si algo falla).
2. **Verificar el runtime**: Node en el entorno de despliegue compatible con `pdfjs-dist` (requiere 22.13 o superior, y `engines` del proyecto dice `>=20`).
3. **Esquema y contenido**: `npm run db:reset`, después `npm run sync`. La sync valida la planilla antes de escribir y no escribe si hay errores.
4. **Código**: desplegar el backend y el frontend. Va después de la base: el código nuevo espera `kb_termino_ignorado` y `documento_fragmento`.
5. **Verificación**: `/api/health`, consultas de referencia (`para aprobar abd necesito`, `condicons de abd`, `inscripcion a materias`) y la salida de la sync.

Opciones a evaluar: un script `npm run desplegar` que haga los pasos 1 a 3 con confirmación antes de cada uno, o un flujo en GitHub Actions que corra la sync con los secretos del repo. Las dos opciones necesitan las credenciales de Drive y de Neon fuera del código.

Referencias: [02 § 2.9](02-manual-tecnico.md), [04 § 4.9](04-base-datos.md).

## 2. Refactor por capas

En curso en la rama `refactor/capas`. Hecho en esta rama: dominios `chat/`, `kb/` y `sync/` con barrels (`index.ts`), `drive.service` partido en `sync/drive.ts` y `sync/documentos.ts`, `nl` sin dependencia de `chat` (el saludo lo resuelve el chat), y `extraccion` usando el normalizador de `utils`. Pendiente: el normalizador de la extracción cambia `texto_busqueda` en las letras repetidas, así que en producción hay que volver a extraer los fragmentos.

Pendiente, en el orden propuesto en la conversación:

1. ~~**Un solo normalizador.**~~ Hecho: `lib/normalizar.ts` es el único normalizador de texto. Se quitó `similitudTrigram`, que la app no usaba.
2. ~~**Dirección de dependencias.**~~ Hecho: `routes` → `services` → `repositories` → `db`. Queda pendiente el SQL inline de `sync-load.service.ts`.
3. ~~**Separar `drive.service.ts`**~~ Hecho: `clients/drive.ts` y `services/sync-load.service.ts`.
4. ~~**Separar `carga-contenido.service.ts`**~~ Hecho: `sync-transform.service.ts` (convertir) y `sync-load.service.ts` (escribir).
5. **Agrupar por dominio** no aplica: se organizó por responsabilidad, con el dominio en el nombre del archivo.

Cada paso con los tests en verde, en commits chicos y sin cambiar comportamiento. Decisión: no se usa ORM; el SQL es específico de PostgreSQL y el esquema es el estado final.

## 3. Extractos de documentos

Referencia: [08](08-extractos-de-documentos.md).

- **Conjunto dorado**: consultas con el pasaje esperado, incluidas las que hoy no resuelven (`como apruebo abd` no encuentra la sección de aprobación; `promocionar`; `programas de abd`).
- **Umbral `KB_UMBRAL_PASAJE`**: medirlo con el conjunto dorado y con logs de consultas reales.
- **Ranking** cuando hay varios pasajes con la misma confianza.
- **Títulos falsos** en los programas (viñetas de unidades temáticas, "REPASO").
- **Documentos sin texto** (`GENERAL_reglamento`, `GENERAL_protocolo-examenes`): pedir al cliente un PDF con texto seleccionable. El OCR se descartó por la calidad del resultado.
- **Costo de sincronización**: resuelto con `fragmentos_md5`. Revisar en producción que la segunda sync no descargue nada.

## 4. Vocabulario y contenido

- **Variantes faltantes** para promoción ("promocionar", "promociono") y otros temas consultados (ver [07](07-contenido-y-decisiones.md)).
- **Documento sin archivo:** `EAM_condiciones` está en la planilla y no existe en Drive. El bot muestra "Documento en preparación".
- **Cronogramas** con encabezado "2° cuatrimestre 2024" en archivos de 2026: confirmar con el equipo si el contenido está vigente.
- **Documentos que desaparecen de Drive:** definir si se archivan (ver [04](04-base-datos.md)).

## 5. Pruebas

- **Tests de la pregunta por comisión en la interfaz.** Los tests del backend cubren el flujo, pero no el renderizado en el navegador.
- **Fixtures más complejos**, con varias materias, comisiones y documentos con y sin texto.
- **Tests de la sincronización** con Drive simulado, para no depender de credenciales.

## 6. Base de datos y reset

- **Respaldo de métricas en `db:reset`.** `rescatarMetricas` guarda las filas solo en memoria: si el proceso se corta entre el `DROP` y la restauración, se pierden. Opciones: escribir un JSON de respaldo antes del `DROP`, o hacer el reset en una transacción. Carga toda la tabla en memoria, lo que no escala bien.

## 7. Documentación

- **`003_verificacion.sql`** ya se actualizó a las claves vigentes. Falta revisar `sql-coincide.test.ts` si cambian las consultas de la verificación.
- **Decisión 1:1 o 1:N** para `documento_fragmento`: la implementación usa 1:N, con un fragmento para los documentos cortos. Confirmar si es lo que se quiso decir.
