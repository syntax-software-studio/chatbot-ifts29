# 09 · Pendientes post-MVP

Todo lo que sigue queda para después de la entrega del MVP.

## Despliegue

- Automatizar el despliegue, con script y confirmación en cada paso, o con GitHub Actions. Ver [10](10-operacion.md).
- Sincronización automática con el cron de Vercel. Antes, medir cuánto tarda la sincronización completa.

## Texto libre y extractos

- Conjunto dorado de consultas con el pasaje esperado, y medir `KB_UMBRAL_PASAJE` con él. Ver [08](08-extractos-de-documentos.md).
- Ranking de pasajes cuando tienen la misma confianza.
- Títulos falsos en los programas (viñetas de unidades temáticas, "REPASO").
- Variantes para promoción y otros temas. Ver [07](07-contenido-y-decisiones.md).
- Calibrar los umbrales con consultas reales, con un procedimiento documentado.
- Ciclo de mejora: revisar las consultas que terminaron en `no_disponible` o en aclaración, y convertirlas en variantes o contenido.

## Contenido

- `EAM_condiciones`: el archivo está en la planilla y no existe en Drive.
- Confirmar si siguen vigentes los cronogramas con encabezado "2° cuatrimestre 2024".
- Reglamento y protocolo de exámenes: son imágenes; pedir un PDF con texto seleccionable.
- Submenú por comisión para los documentos de materia.
- Lógica Computacional: migrarla a la regla de comisiones (opcional).
- Lista cerrada para el tipo de documento.
- Flujo para agregar documentos nuevos: documentar cómo se suma un archivo a la carpeta y a la planilla.

## Pruebas

- Probar en el navegador la pregunta por comisión (hoy solo cubren el flujo los tests del backend).
- Fixtures con varias materias, comisiones y documentos con y sin texto, y una copia versionada de la planilla.
- Ampliar el conjunto de consultas de referencia con respuestas esperadas.

## Base de datos

- `db:reset`: el respaldo de métricas vive solo en memoria. Guardarlo en archivo o hacer el reset en una transacción.
- Automatizar el respaldo de `metrica_opcion` ([10.6](10-operacion.md#106-respaldo-de-metrica_opcion)).
- Completar `metrica_opcion.categoria_clave` al exportar, con un join a `categoria`.

## Operación

- Logs persistentes de cada sincronización, con un endpoint protegido.
- Verificar en producción que una segunda sincronización no descargue nada.
- Decidir dónde se aprueban los fragmentos, y si cada fragmento tiene estado.
- Panel de administración, solo si lo anterior no alcanza.
