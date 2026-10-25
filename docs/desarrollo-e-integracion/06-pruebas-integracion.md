# 6. Pruebas de Integración

**Estado:** vigente. Resultados de la última ejecución: **24 pruebas de integración, todas pasando**.

## 6.1 Qué son

Pruebas de punta a punta contra una base PostgreSQL real, con el esquema del proyecto y un conjunto de datos de prueba cargado por el mismo cargador que usa la sincronización.

## 6.2 Entorno

- **Base de prueba:** `ifts29_test`, en el mismo servidor PostgreSQL de Docker que la base local. Se crea sola la primera vez.
- **Datos:** fixtures estáticos en `backend/test/fixtures/contenido.ts`. Son un conjunto chico y explícito, con una materia, dos respuestas, la derivación por motivo y dos intenciones de texto libre.
- **Sin servicios externos:** no se llama a Drive, a Sheets ni a Neon.
- **Requisito:** PostgreSQL levantado (`docker compose up -d`). Si no está, la prueba falla con un mensaje que indica cómo levantarlo.

`backend/test/entorno-prueba.ts` fija la URL de la base de prueba y reinicia su esquema y sus datos en cada archivo de prueba.

## 6.3 Cómo se ejecutan

```bash
npm test --workspace backend                          # suite completa
node --import tsx --test test/api.test.ts             # un archivo
```

## 6.4 Casos

| Archivo | Pruebas | Qué verifica |
|---|---|---|
| `conocimiento.test.ts` | 6 | Búsqueda en la base de conocimiento: coincidencia exacta, variantes compartidas por dos intenciones (ambigüedad), búsqueda por similitud con error de tipeo, mínimo de similitud, y que cada candidato apunte a su opción del menú. |
| `nl.service.test.ts` | 5 | Motor de texto libre: coincidencia exacta, error de tipeo resuelto por similitud, aclaración con opciones reales, saludo al menú raíz, y consulta fuera de dominio. |
| `api.test.ts` | 13 | Contrato HTTP: health con origen de base de datos, menú raíz, navegación a una materia, respuesta con texto y documentos, pantalla de motivos de derivación, contacto asociado a una opción de derivación, consulta escrita, aclaración, validación del cuerpo (400), opción inexistente, y métricas. |

## 6.5 Criterio

Las pruebas de integración verifican el recorrido que ve el estudiante: menú, texto libre, derivación y documentos. Cada una usa datos conocidos y comprueba la respuesta exacta, no sólo que el servicio responda.

## 6.6 Pendientes

- **Conjunto dorado:** un archivo de consultas con respuesta esperada, para medir aciertos y falsos positivos del texto libre y calibrar los umbrales. Hoy las pruebas verifican casos puntuales, no la calidad del motor.
- **Fixtures desde la planilla:** una forma de tomar una copia de la planilla como fixture versionado, para que las pruebas reflejen el contenido real sin depender de la red.
