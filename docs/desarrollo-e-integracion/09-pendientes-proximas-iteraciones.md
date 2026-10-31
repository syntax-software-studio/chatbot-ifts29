# 09 · Pendientes

**Estado:** lista de trabajo. Cada ítem enlaza al documento con el detalle.

## 1. Despliegue

El procedimiento manual está en [10 · Tareas operativas](10-operacion.md).

- **Automatizarlo:** un script `npm run desplegar` con confirmación en cada paso, o un flujo en GitHub Actions que corra la sincronización. Ambas opciones necesitan las credenciales de Drive y de Neon fuera del código.

## 2. Extractos de documentos

Detalle en [08](08-extractos-de-documentos.md).

- **Conjunto dorado:** consultas con el pasaje esperado, incluidas las que hoy no resuelven (`como apruebo abd`, `promocionar`, `programas de abd`).
- **Umbral `KB_UMBRAL_PASAJE`:** medirlo con el conjunto dorado y con logs de consultas reales.
- **Ranking** cuando varios pasajes tienen la misma confianza.
- **Títulos falsos** en los programas (viñetas de unidades temáticas, "REPASO").
- **Revisar en producción** que la segunda sincronización no descargue nada.

## 3. Contenido

- **Variantes faltantes** para promoción ("promocionar", "promociono") y otros temas (ver [07](07-contenido-y-decisiones.md)).
- **`EAM_condiciones`:** está en la planilla y no existe en Drive. El bot muestra "Documento en preparación".
- **Cronogramas** con encabezado "2° cuatrimestre 2024" en archivos de 2026: confirmar si siguen vigentes.
- **Documentos que desaparecen de Drive:** definir si se archivan.
- **Reglamento y protocolo de exámenes:** son imágenes. Pedir al cliente un PDF con texto seleccionable.
- **Lógica Computacional:** migrarla a la regla de comisiones (decisión 13 de [07](07-contenido-y-decisiones.md)). Opcional.
- **Submenú por comisión** para los documentos de materia.

## 4. Pruebas

- **Pregunta por comisión en la interfaz:** los tests del backend cubren el flujo, no el renderizado en el navegador.
- **Fixtures más complejos:** varias materias, comisiones y documentos con y sin texto.
- **Fixtures desde la planilla:** una copia versionada, para que las pruebas no dependan de la red.

## 5. Base de datos y reset

- **Respaldo en `db:reset`:** `rescatarMetricas` guarda las filas solo en memoria; si el proceso se corta, se pierden. Opciones: un JSON de respaldo antes del `DROP`, o hacer el reset en una transacción.
- **Automatizar el respaldo** manual de `metrica_opcion` ([10.6](10-operacion.md#106-respaldo-de-metrica_opcion)).
- **Categoría en métricas:** `metrica_opcion.categoria_clave` queda `NULL`. Propuesta: completarla al exportar con un join de `opcion_menu` a `categoria`.

## 6. Operación y administración

- **Sincronización automática:** cron de Vercel que llama a `POST /api/sync`, sin permisos de escritura en GitHub ni en la planilla. Antes, medir la sincronización completa: `maxDuration` es 30 s y la extracción de PDFs no se midió en Vercel. Si no entra, partirla en pasos.
- **Logs persistentes de cada sync:** tabla `sync_log`, expuesta por un endpoint protegido.
- **Aprobación de fragmentos:** estado por fragmento, y la búsqueda usa solo los aprobados. Falta decidir dónde se aprueba (planilla o pantalla).
- **Normalización del tipo de documento:** lista cerrada en `documento.tipo`.
- **Panel de administración:** solo si lo anterior no alcanza. Decisión con el cliente: planilla más pantalla mínima, o contenido en la base.
