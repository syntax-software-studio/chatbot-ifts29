# 6. Pruebas de Integración

**Estado:** vigente. Resultados de la última ejecución: **44 pruebas de integración, todas pasando**.

## 6.1 Qué son

Pruebas de punta a punta contra una base PostgreSQL real, con el esquema del proyecto y un conjunto de datos de prueba cargado por el mismo cargador que usa la sincronización.

## 6.2 Entorno

- **Base de prueba:** `ifts29_test`, en el mismo servidor PostgreSQL de Docker que la base local. Se crea sola la primera vez.
- **Datos:** fixtures estáticos en `backend/test/fixtures/contenido.ts`. Son un conjunto chico y explícito, con una materia, dos respuestas, la derivación por motivo y dos intenciones de texto libre.
- **Sin servicios externos:** no se llama a Drive, a Sheets ni a Neon.
- **Requisito:** PostgreSQL levantado (`docker compose up -d`). Si no está, la prueba falla con un mensaje que indica cómo levantarlo.

`backend/test/helpers/entorno-prueba.ts` fija la URL de la base de prueba y reinicia su esquema y sus datos en cada archivo de prueba.

## 6.3 Cómo se ejecutan

```bash
npm test --workspace backend                                 # suite completa
node --import tsx --test test/integration/api.test.ts        # un archivo
```

## 6.4 Casos

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `src/repositories/test/kb-conocimiento.repository.test.ts` | 6 | Búsqueda en la base de conocimiento: coincidencia exacta, variantes compartidas por dos intenciones (ambigüedad), búsqueda por similitud con error de tipeo, mínimo de similitud, y que cada candidato apunte a su opción del menú. |
| `src/services/test/sync-load.service.test.ts` | 5 | Carga en la base: aplicar la planilla dos veces deja los mismos conteos; lo que la planilla ya no trae se borra; un documento de Drive queda enlazado; una segunda sincronización sin cambios no actualiza nada; si falla la extracción de un PDF se conservan sus fragmentos. |
| `src/services/test/kb.service.test.ts` | 12 | Motor de texto libre: coincidencia exacta, errores de tipeo, aclaración con opciones reales, saludo, consulta fuera de dominio, cobertura de términos, palabras de ruido y plurales. |
| `src/services/test/chat.service.test.ts` | 3 | Flujo de documentos por comisión: pregunta de comisión, documento de la comisión elegida, y respuesta directa cuando no hay comisiones. |
| `test/integration/api.test.ts` | 13 | Contrato HTTP: health con la base de datos, menú raíz, navegación a una materia, respuesta con texto y documentos, pantalla de motivos de derivación, contacto asociado a una opción de derivación, consulta escrita, aclaración, validación del cuerpo (400), opción inexistente, y métricas. |
| `src/services/test/analytics.service.test.ts` | 2 | Reporte mensual contra la base de prueba: incluye los eventos del mes y no los del siguiente; republicar un mes reemplaza su registro de control. La planilla se simula. |
| `test/integration/sql-coincide.test.ts` | 3 | Las columnas y tablas que usa el SQL de la aplicación existen en el esquema, y los archivos SQL no tienen BOM. |

## 6.5 Criterio

Las pruebas de integración verifican el recorrido que ve el estudiante: menú, texto libre, derivación y documentos. Cada una usa datos conocidos y comprueba la respuesta exacta, no sólo que el servicio responda.

## 6.6 Evaluación del texto libre

Además de las pruebas automáticas, hay dos scripts en `backend/test/` que miden la calidad del texto libre contra la base configurada:

```bash
npm run casos:generar --workspace backend    # genera casos a partir de las variantes (test/casos/salida/casos.json)
npm run casos:evaluar --workspace backend    # evalúa cada caso y muestra un resumen por transformación
```

El generador aplica transformaciones típicas a cada variante: sin tildes, mayúsculas, con un error de tipeo (transposición de dos letras), sin palabras vacías y con el orden de las palabras invertido. Cada caso conserva la opción que debería responder.

El evaluador clasifica cada caso como **acierto**, **aclaración que incluye la opción correcta**, **aclaración sin la opción**, **no disponible** u **opción incorrecta**. Los fallos quedan en `test/casos/salida/fallos.json`. Los archivos de salida no se versionan.

Limitación: los casos salen de las variantes cargadas, así que miden robustez frente a errores mecánicos, no cómo escribe realmente un estudiante.

