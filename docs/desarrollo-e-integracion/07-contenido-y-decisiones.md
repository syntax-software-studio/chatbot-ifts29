# 07 · Contenido, fuentes y decisiones

**Estado:** vigente. Describe la implementación actual.

## Resumen

La base PostgreSQL es la única fuente de lo que el bot muestra (menú, respuestas, documentos y base de conocimiento). El contenido no vive en el código: se edita en una planilla de Google y los documentos en una carpeta de Drive. La sincronización copia todo a la base.

- **Desarrollo:** PostgreSQL local con Docker (`docker compose up`).
- **Producción:** Neon. La misma variable `DATABASE_URL` sirve para ambos; el driver es `pg`.

## Fuentes

| Qué | Dónde | Quién lo edita |
|---|---|---|
| Menú, respuestas, intenciones, preguntas, variantes, derivación | Planilla "Bot IFTS29 - Contenido" (Google Sheets) | Equipo, sin código |
| Documentos (PDF) | Carpeta de Drive | Equipo, subiendo o renombrando archivos |
| Estructura de tablas | `db/001_schema.sql` | Desarrollo |

La cuenta de servicio tiene acceso **de lector** a la planilla y a la carpeta. Variables necesarias: `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHARED_FOLDER_ID`.

### Pestañas de la planilla

| Pestaña | Columnas |
|---|---|
| `categorias` | clave, nombre, mensaje, orden, es_raiz |
| `opciones` | clave, categoria, etiqueta, tipo (navegar / responder / derivar), destino, respuesta, orden, es_volver |
| `respuestas` | clave, texto, orden |
| `respuesta_documentos` | respuesta, documento (nombre del archivo en Drive, sin `.pdf`), orden |
| `intenciones` | clave, nombre, dominio, opcion |
| `preguntas` | intencion, pregunta, prioridad, umbral |
| `variantes` | intencion, pregunta, texto, peso |
| `contactos` | clave, nombre, area, comision, email, perfil, motivo, orden, opcion |
| `alias` | alias, expansion |
| `ignorados` | termino (palabras de la consulta que se descartan al buscar: "como", "para", "una"...) |

La sincronización valida los encabezados y las referencias entre pestañas antes de escribir. Si hay un error, muestra todos y **no cambia nada**.

## Sincronización

Un solo proceso actualiza todo:

- `POST /api/sync` (protegido con `SYNC_SECRET` si está definido), o
- `npm run sync --workspace backend`.

Pasos: lee y valida la planilla → convierte y valida el contenido → escribe en una sola transacción → sincroniza los documentos con Drive.

Al escribir:
- La base de conocimiento, los adjuntos y la asociación de contactos se reemplazan completos.
- Menú, respuestas, contactos y documentos se actualizan por clave, y lo que ya no está en la planilla **se borra**.
- Las métricas (`metrica_opcion`) no se tocan.

En Drive, los documentos se emparejan por nombre de archivo. Un documento que la planilla referencia y que no existe en Drive se reporta en la respuesta (`sinMatch`) y el bot no le muestra enlace.

## Convención de nombres de documentos

```
<CódigoMateria>_<Tipo>[_<Comisión>]_<Año>[_<CuatrimestreDeCursada>].pdf
```

- **CódigoMateria:** `ABD`, `EAM`, `LC`, `TP`, o `GENERAL` para documentos que no son de una materia.
- **Tipo:** `programa`, `cronograma`, `condiciones`, `horarios`, `contacto`, `entrega-documentacion`, `reglamento`, `plan-estudios`, `carga-horaria`, `correlatividades`, `equivalencias`, `guia-foros`, `instructivo-mensajeria`, `protocolo-examenes`. Las palabras compuestas usan guion.
- **Comisión** (opcional): sólo para documentos que dependen de la comisión. Va antes del año.
- **Año:** año al que corresponde el documento. Define si está actualizado.
- **CuatrimestreDeCursada** (opcional, al final): `1C` o `2C`. Indica en qué cuatrimestre de cursada está ubicada la materia dentro del plan de la carrera. **No es una fecha ni una versión.** Los documentos `GENERAL` no lo llevan.

Ejemplos: `ABD_cronograma_2026_1C.pdf`, `ABD_condiciones_B_2026_1C.pdf`, `GENERAL_reglamento_2026.pdf`.

## Flujo de derivación

"No encontré lo que busco" es un menú más:

1. Pantalla de motivos: Orientación cursada · Trámites, certificados, etc. · Entrega de documentación.
2. "Orientación cursada" abre una pantalla de comisiones (A y B). Cada comisión muestra su contacto.
3. "Trámites" y "Entrega de documentación" muestran su contacto directamente.

Cada contacto pertenece a una sola opción de tipo `derivar` (columna `opcion` de `contactos`). La opción de derivación responde con el texto de `DERIVACION_GENERAL` y la tarjeta del contacto.

## Decisiones

1. **Fuente única en la base.** Nada del contenido vive en el código. Lo que no está en la planilla no se conserva en la base.
2. **Planilla de Google como editor.** Historial de versiones y edición sin código. La sync la lee en sólo lectura.
3. **Documentos identificados por nombre de archivo.** No hay lista aparte de documentos. Un nombre que no se puede parsear no se publica.
4. **Un solo driver (`pg`)** para desarrollo y producción.
5. **Derivación por pantallas.** Los motivos y las comisiones son opciones del menú. No hay un tipo de respuesta especial para preguntas.
6. **Sin submenús contextuales en la base.** Las tablas `contexto`, `opcion_contexto`, `contexto_opcion` y `sesion_contexto` se eliminaron: no tenían uso.
7. **Contacto de derivación con motivo corto.** El texto que ve el estudiante es la etiqueta corta; el texto largo del PDF de contactos queda como respaldo fuera de la carpeta de documentos.
8. **Sin `ALTER` en el esquema.** `001_schema.sql` describe el estado final; una base nueva queda igual que una creada desde cero.
9. **`db:push` aplica sólo el esquema.** El contenido entra por la sincronización.
10. **Sin modo demo.** No existe un catálogo semilla: sin base de datos la API responde 503. Una sola fuente de datos.
11. **Normalización de consultas.** Las siglas de la pestaña `alias` se expanden, en la consulta y en las variantes. Las palabras vacías (`PALABRAS_VACIAS`, en código) se quitan de ambos lados. Las palabras de ruido de la búsqueda (pestaña `ignorados`) sólo se quitan de la consulta, así que cambiarlas no requiere resincronizar.
12. **Búsqueda con cobertura de términos.** Cada variante recibe el promedio de cuánto cubre cada término de la consulta: 1 si coincide con stemming, la similitud si es un error de tipeo (≥ 0,6), 0 si no aparece. Por eso "condicons de abd" llega a condiciones sin aclaración.
13. **Documentos por comisión.** Si una respuesta tiene documentos de dos o más comisiones del mismo tipo, el bot pregunta "¿De qué comisión sos?" y muestra sólo el documento elegido. La comisión se lee del nombre del archivo (ver la convención). Si la respuesta tiene un solo documento, o documentos sin comisión, responde directo.

## Pendientes

- **Documentos que desaparecen de Drive.** La sincronización los deja como vigentes y sólo emite una advertencia. Definir si se archivan.
- **Conjunto dorado.** Consultas con respuesta esperada para medir el motor de texto libre y calibrar los umbrales.
- **Documento sin archivo.** `EAM_condiciones` está en la planilla pero no existe en Drive; el bot no le muestra enlace hasta que aparezca.
- **Lógica Computacional con el flujo de menú anterior.** Migrarla a la regla de comisiones (decisión 13) es opcional.
- **Producción (Neon).** Los cambios de esquema y de contenido todavía no se aplicaron en Neon. Requieren migración y revisión.
