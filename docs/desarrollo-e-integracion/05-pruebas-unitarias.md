# 5. Pruebas Unitarias

**Estado:** vigente. Resultados de la última ejecución: **34 pruebas unitarias, todas pasando**.

## 5.1 Qué son

Pruebas de funciones puras: no usan base de datos, red ni credenciales. Verifican reglas de conversión, validación y normalización que no dependen del entorno.

## 5.2 Cómo se ejecutan

```bash
npm test --workspace backend
```

La suite completa corre también las pruebas de integración (ver [06-pruebas-integracion.md](06-pruebas-integracion.md)). Para correr sólo un archivo:

```bash
node --import tsx --test test/normalizar.test.ts
```

Las pruebas corren de a un archivo (`--test-concurrency=1`), porque las de integración comparten la base de prueba.

## 5.3 Casos

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `normalizar.test.ts` | 5 | Normalización del texto libre (acentos, mayúsculas, puntuación, letras repetidas), expansión de siglas y palabras vacías, y comparación por palabras con errores de tipeo. |
| `fuente-contenido.test.ts` | 8 | Validación de la planilla: contenido válido, celdas con comas y comillas, filas vacías, pestaña faltante, encabezados distintos o en otro orden, pestañas fuera del esquema, reporte de todos los errores juntos. |
| `carga-contenido.test.ts` | 16 | Conversión a tipos de base: enteros, booleanos, decimales con coma, referencias entre pestañas (categorías, respuestas, opciones, intenciones, preguntas, variantes, contactos), reglas de opciones (`navegar` requiere destino, `responder` requiere respuesta), contactos asociados a una opción de tipo `derivar`, variantes repetidas tras normalizar, y acumulación de errores. |
| `sql-coincide.test.ts` | 3 | Las columnas y tablas que usa el SQL de la aplicación existen en el esquema, y los archivos SQL no tienen BOM. |

## 5.4 Criterio

Cada regla de validación tiene su prueba de caso válido y, al menos, de caso inválido. Un error de contenido tiene que aparecer en la planilla antes de llegar a la base: si `convertirContenido` lo rechaza, la sincronización no escribe nada.
