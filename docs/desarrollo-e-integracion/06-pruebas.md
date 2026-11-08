# 6. Pruebas

Resultados de la última ejecución: **96 pruebas, todas pasando** (80 unitarias + 16 de integración).

![Ejecución de pruebas](screenshots/00-pruebas.gif)

---

## 6.1 Pruebas Unitarias

Pruebas de funciones puras: no usan base de datos, red ni credenciales. Verifican reglas de conversión, validación y normalización que no dependen del entorno.

### Cómo se ejecutan

```bash
npm test --workspace backend
```

La suite completa corre también las pruebas de integración. Cada prueba unitaria está junto al módulo que prueba. Para correr sólo un archivo:

```bash
node --import tsx --test src/lib/test/normalizar.test.ts
```

Las pruebas corren de a un archivo (`--test-concurrency=1`), porque las de integración comparten la base de prueba.

### Casos

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `src/lib/test/normalizar.test.ts` | 5 | Normalización del texto libre (acentos, mayúsculas, puntuación, letras repetidas), expansión de siglas y palabras vacías, y comparación por palabras con errores de tipeo. |
| `src/lib/test/comisiones.test.ts` | 6 | Lectura de materia, tipo, comisión y grupo desde el nombre del documento; clave de opción por comisión; cuándo preguntar; filtrado de documentos. |
| `src/lib/test/planilla.test.ts` | 8 | Validación de la planilla: contenido válido, celdas con comas y comillas, filas vacías, pestaña faltante, encabezados distintos o en otro orden, pestañas fuera del esquema, reporte de todos los errores juntos. |
| `src/lib/test/fragmentos.test.ts` | 7 | Partición de un PDF en secciones: títulos conocidos (con tilde o error de tipeo), oraciones que contienen un título, viñetas, encabezados en mayúsculas, y normalización para la búsqueda. |
| `src/lib/test/metricas.test.ts` | 4 | Reporte mensual: mes anterior (también al cambiar de año), rango de fechas del mes, validación del formato `AAAA-MM`, y tabla con cabecera y categoría vacía cuando no hay. |
| `src/services/test/sync.service.test.ts` | 4 | Orquestación de la sincronización: si la planilla tiene errores no se escribe nada; con la planilla válida se escribe el contenido antes que los documentos; en modo de prueba no se escribe el contenido. |
| `src/services/test/sync-transform.service.test.ts` | 16 | Conversión a tipos de base: enteros, booleanos, decimales con coma, referencias entre pestañas, reglas de opciones (`navegar` requiere destino, `responder` requiere respuesta), contactos asociados a una opción `derivar`, variantes repetidas tras normalizar, y acumulación de errores. |

### Criterio

Cada regla de validación tiene su prueba de caso válido y, al menos, de caso inválido. Un error de contenido tiene que aparecer en la planilla antes de llegar a la base: si `convertirContenido` lo rechaza, la sincronización no escribe nada.

---

## 6.2 Pruebas de Integración

Pruebas de punta a punta contra una base PostgreSQL real, con el esquema del proyecto y un conjunto de datos de prueba cargado por el mismo cargador que usa la sincronización.

### Entorno

- **Base de prueba:** `ifts29_test`, en el mismo servidor PostgreSQL de Docker que la base local. Se crea sola la primera vez.
- **Datos:** fixtures estáticos en `backend/test/fixtures/contenido.ts`. Son un conjunto chico y explícito, con una materia, dos respuestas, la derivación por motivo y dos intenciones de texto libre.
- **Sin servicios externos:** no se llama a Drive, a Sheets ni a Neon.
- **Requisito:** PostgreSQL levantado (`docker compose up -d`). Si no está, la prueba falla con un mensaje que indica cómo levantarlo.

`backend/test/helpers/entorno-prueba.ts` fija la URL de la base de prueba y reinicia su esquema y sus datos en cada archivo de prueba.

### Cómo se ejecutan

```bash
npm test --workspace backend                                 # suite completa
node --import tsx --test test/integration/api.test.ts        # un archivo
```

### Casos

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `src/repositories/test/kb-conocimiento.repository.test.ts` | 6 | Búsqueda en la base de conocimiento: coincidencia exacta, variantes compartidas por dos intenciones (ambigüedad), búsqueda por similitud con error de tipeo, mínimo de similitud, y que cada candidato apunte a su opción del menú. |
| `src/services/test/sync-load.service.test.ts` | 5 | Carga en la base: aplicar la planilla dos veces deja los mismos conteos; lo que la planilla ya no trae se borra; un documento de Drive queda enlazado; una segunda sincronización sin cambios no actualiza nada; si falla la extracción de un PDF se conservan sus fragmentos. |
| `src/services/test/kb.service.test.ts` | 12 | Motor de texto libre: coincidencia exacta, errores de tipeo, aclaración con opciones reales, saludo, consulta fuera de dominio, cobertura de términos, palabras de ruido y plurales. |
| `src/services/test/chat.service.test.ts` | 3 | Flujo de documentos por comisión: pregunta de comisión, documento de la comisión elegida, y respuesta directa cuando no hay comisiones. |
| `test/integration/api.test.ts` | 13 | Contrato HTTP: health con la base de datos, menú raíz, navegación a una materia, respuesta con texto y documentos, pantalla de motivos de derivación, contacto asociado a una opción de derivación, consulta escrita, aclaración, validación del cuerpo (400), opción inexistente, y métricas. |
| `src/services/test/analytics.service.test.ts` | 2 | Reporte mensual contra la base de prueba: incluye los eventos del mes y no los del siguiente; republicar un mes reemplaza su registro de control. La planilla se simula. |
| `test/integration/sql-coincide.test.ts` | 3 | Las columnas y tablas que usa el SQL de la aplicación existen en el esquema, y los archivos SQL no tienen BOM. |

### Criterio

Las pruebas de integración verifican el recorrido que ve el estudiante: menú, texto libre, derivación y documentos. Cada una usa datos conocidos y comprueba la respuesta exacta, no sólo que el servicio responda.

### Evaluación del texto libre

Además de las pruebas automáticas, hay dos scripts en `backend/test/` que miden la calidad del texto libre contra la base configurada:

```bash
npm run casos:generar --workspace backend    # genera casos a partir de las variantes (test/casos/salida/casos.json)
npm run casos:evaluar --workspace backend    # evalúa cada caso y muestra un resumen por transformación
```

El generador aplica transformaciones típicas a cada variante: sin tildes, mayúsculas, con un error de tipeo (transposición de dos letras), sin palabras vacías y con el orden de las palabras invertido. Cada caso conserva la opción que debería responder.

El evaluador clasifica cada caso como **acierto**, **aclaración que incluye la opción correcta**, **aclaración sin la opción**, **no disponible** u **opción incorrecta**. Los fallos quedan en `test/casos/salida/fallos.json`. Los archivos de salida no se versionan.
