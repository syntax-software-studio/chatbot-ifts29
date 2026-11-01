# 11 · Revisión del modelo de datos: pendientes

**Estado:** la revisión del modelo está implementada. Este documento lista solo lo que falta. La documentación vigente del sistema está en las docs 02, 04 y 07.

## Pendientes

1. **Pestañas de la planilla con los nombres acordados.** Renombrar en código (`ESQUEMA_CONTENIDO`) y en el sheet al mismo tiempo, antes de un sync. Lista: categorias, opciones, respuestas, respuesta_documentos, preguntas, variantes, equivalentes, ignorados, reconocimiento_fragmentos, contactos.
2. **Patrón del nombre de documento en un solo lugar,** con una prueba automática que lo cubra.
3. **Decidir y resolver qué pasa con dos campos sin uso:** `menu_categoria.mensaje` (texto que vive fuera de `respuesta`) y `pregunta.respuesta_id` (vacío en todas las filas). Decisión pendiente.
4. **Variantes a partir de los títulos de sección.** Hoy "bibliografia abd" no llega a un pasaje. Hay que decidir entre generar variantes al sincronizar (con riesgo en títulos genéricos como "final") o usar los fragmentos como evidencia al elegir la opción.
5. **Textos para el cliente:** qué hace cada lista (`PALABRAS_VACIAS`, `ignorados`, títulos de sección), con ejemplos.
6. **Prueba de permisos:** verificar que el cliente, con acceso de editor, no puede quitar la protección de las pestañas de configuración.
