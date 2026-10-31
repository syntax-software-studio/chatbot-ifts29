# 5. Pruebas Unitarias

**Estado:** vigente. Resultados de la última ejecución: **50 pruebas unitarias, todas pasando**.

## 5.1 Qué son

Pruebas de funciones puras: no usan base de datos, red ni credenciales. Verifican reglas de conversión, validación y normalización que no dependen del entorno.

## 5.2 Cómo se ejecutan

```bash
npm test --workspace backend
```

La suite completa corre también las pruebas de integración (ver [06-pruebas-integracion.md](06-pruebas-integracion.md)). Cada prueba unitaria está junto al módulo que prueba. Para correr sólo un archivo:

```bash
node --import tsx --test src/lib/test/normalizar.test.ts
```

Las pruebas corren de a un archivo (`--test-concurrency=1`), porque las de integración comparten la base de prueba.

## 5.3 Casos

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `src/lib/test/normalizar.test.ts` | 5 | Normalización del texto libre (acentos, mayúsculas, puntuación, letras repetidas), expansión de siglas y palabras vacías, y comparación por palabras con errores de tipeo. |
| `src/lib/test/comisiones.test.ts` | 6 | Lectura de materia, tipo, comisión y grupo desde el nombre del documento; clave de opción por comisión; cuándo preguntar; filtrado de documentos. |
| `src/lib/test/planilla.test.ts` | 8 | Validación de la planilla: contenido válido, celdas con comas y comillas, filas vacías, pestaña faltante, encabezados distintos o en otro orden, pestañas fuera del esquema, reporte de todos los errores juntos. |
| `src/lib/test/secciones.test.ts` | 7 | Partición de un PDF en secciones: títulos conocidos (con tilde o error de tipeo), oraciones que contienen un título, viñetas, encabezados en mayúsculas, título seguido de `:`, y normalización para la búsqueda. |
| `src/lib/test/metricas.test.ts` | 4 | Reporte mensual: mes anterior (también al cambiar de año), rango de fechas del mes, validación del formato `AAAA-MM`, y tabla con cabecera y categoría vacía cuando no hay. |
| `src/services/test/sync.service.test.ts` | 4 | Orquestación de la sincronización: si la planilla tiene errores no se escribe nada; con la planilla válida se escribe el contenido antes que los documentos; en modo de prueba no se escribe el contenido. |
| `src/services/test/sync-transform.service.test.ts` | 16 | Conversión a tipos de base: enteros, booleanos, decimales con coma, referencias entre pestañas, reglas de opciones (`navegar` requiere destino, `responder` requiere respuesta), contactos asociados a una opción `derivar`, variantes repetidas tras normalizar, y acumulación de errores. |

## 5.4 Criterio

Cada regla de validación tiene su prueba de caso válido y, al menos, de caso inválido. Un error de contenido tiene que aparecer en la planilla antes de llegar a la base: si `convertirContenido` lo rechaza, la sincronización no escribe nada.
