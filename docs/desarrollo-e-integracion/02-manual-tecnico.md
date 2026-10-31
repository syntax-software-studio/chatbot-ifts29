# 2. Manual Técnico

**Estado:** vigente. Describe la implementación actual.

**Para quién:** desarrolladores que instalan, mantienen o continúan el sistema.

## 2.1 Descripción del sistema

Asistente virtual del IFTS N.°29 para estudiantes. Responde por dos caminos que llegan a la misma información:

- **Menú guiado:** pantallas de botones. Cada opción lleva a otra pantalla o muestra una respuesta, documentos o contactos.
- **Texto libre:** el estudiante escribe una consulta y el sistema la ubica en la base de conocimiento. Si la coincidencia es clara, responde con la misma respuesta del menú; si hay ambigüedad, pide aclaración con opciones del menú.

El sistema no genera texto: todo lo que muestra está validado y cargado desde la planilla de contenido. Es anónimo y de solo lectura para el estudiante. Funciona sin LLM ni embeddings.

Se integra en el campus virtual (Moodle) como widget embebible (`iframe`).

## 2.2 Arquitectura

```
Widget (React + Vite)  ──HTTP──▶  API (Express 5 + TypeScript)  ──pg──▶  PostgreSQL
                                        │                                (Neon / Docker)
                                        ├──▶ Google Sheets (lectura: planilla de contenido)
                                        └──▶ Google Drive  (lectura: documentos y enlaces)
```

- **Frontend** (`frontend/`): widget embebible. Renderiza pantallas de opciones, respuestas, documentos y tarjetas de contacto.
- **Backend** (`backend/`): API REST. Desplegable como función serverless en Vercel (`api/index.ts`) o como servidor local (`npm run dev:api`).
- **Base de datos:** ver [04-base-datos.md](04-base-datos.md).
- **Contenido:** ver [07-contenido-y-decisiones.md](07-contenido-y-decisiones.md).

### Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | React, Vite, TypeScript |
| Backend | Express 5, TypeScript, zod (validación), pg (PostgreSQL) |
| Google | googleapis (Sheets y Drive), cuenta de servicio |
| Base de datos | PostgreSQL 16, extensiones `pgcrypto` y `pg_trgm` |
| Extracción de PDF | `pdfjs-dist` (solo en la sincronización, no en las consultas) |
| Tests | `node:test` con `tsx` |

## 2.3 Estructura del código

```
backend/src/
├── app.ts                          # Express: monta routers, CORS, rate limit, errores
├── index.ts                        # Arranque del servidor local
├── routes/                         # Controllers HTTP
│   ├── chat.routes.ts              # POST /api/chat, /api/chat/documento
│   ├── menu.routes.ts              # GET /api/menu
│   ├── system.routes.ts            # health, sincronización
│   └── metricas.routes.ts          # Exportación mensual de métricas (la llama el cron)
├── services/                       # Casos de uso: deciden, no hablan SQL ni HTTP
│   ├── chat.service.ts             # Arma cada turno: menú, respuesta, aclaración, no disponible
│   ├── kb.service.ts               # Interpreta el texto libre (exacto, similar, aclaración, saludo)
│   ├── fragmentos.service.ts       # Decide qué extracto mostrar (umbral y límite)
│   ├── analytics.service.ts        # Métricas de producto (qué consulta y qué respuesta)
│   ├── sync.service.ts             # Orquesta: planilla → base → documentos
│   ├── sync-extract.service.ts     # Extracción: lee la planilla y las secciones de los PDFs
│   ├── sync-transform.service.ts   # Transformación: convierte la planilla
│   └── sync-load.service.ts        # Carga: escribe el contenido y los documentos (SQL inline, pendiente de repositorio)
├── repositories/                   # SQL: única capa que toca la base
│   ├── chat-menu.repository.ts
│   ├── analytics.repository.ts
│   ├── kb-conocimiento.repository.ts
│   └── fragmentos.repository.ts
├── clients/                        # APIs externas y lectura de archivos
│   ├── drive.client.ts             # Cliente de la API de Drive
│   ├── drive.ts                    # Listar, descargar y enlazar archivos de Drive
│   ├── sheets.client.ts            # Cliente de Google Sheets
│   ├── sheets-metricas.client.ts   # Publica el reporte mensual en la planilla de métricas
│   ├── pdf.client.ts               # Lee las líneas de texto de un PDF
│   └── google-auth.ts              # Cuenta de servicio, con el alcance pedido
├── lib/                            # Lógica pura, sin E/S
│   ├── normalizar.ts               # Normalización de texto (consulta, variantes y documentos)
│   ├── comisiones.ts               # Nombre de documento → comisión; filtrado
│   ├── secciones.ts                # Parte las líneas de un PDF en secciones por título
│   ├── planilla.ts                 # Valida pestañas y encabezados de la planilla
│   └── metricas.ts                 # Calendario del reporte, rango del mes y tabla
├── db/
│   ├── pool.ts                     # Conexión pg
│   ├── types.ts                    # Contratos de datos compartidos con el frontend
│   └── push.ts                     # Aplica el esquema (y --reset)
├── scripts/
│   └── sync.ts                     # Comando npm run sync
├── middleware/                     # CORS, rate limit, errores
├── config/
│   └── env.ts                      # Variables de entorno
└── utils/
    └── errors.ts                   # Errores HTTP
```

Organizado por responsabilidad técnica: `routes` → `services` → `repositories` → `db`. `clients` y `lib` no dependen de `services` ni de `repositories`. El dominio aparece en el nombre de cada archivo (`chat.`, `kb.`, `fragmentos.`, `sync-`, `analytics.`).

Frontend: `components/ChatWidget.tsx` (contenedor), `OptionList.tsx` (botones del menú), `ContactCard.tsx`, `DocumentCard.tsx`, `MessageBubble.tsx`. El estado de la conversación vive en `hooks/useChat.ts`, y el cliente HTTP en `api/client.ts`.

## 2.4 Flujo de una consulta

**Menú:** el frontend envía `{ "opcion": "<clave>" }`. El backend busca la opción y responde según su tipo:

| Tipo de opción | Respuesta (`tipo`) |
|---|---|
| `navegar` | `nodo`: la categoría destino, con su mensaje y sus opciones |
| `responder` | `respuesta`: texto y documentos adjuntos |
| `derivar` | `derivacion`: texto y tarjetas de contacto |

**Texto libre:** el frontend envía `{ "message": "<texto>" }`. El motor:

1. Expande siglas y nombres cortos con la pestaña `alias` (por ejemplo, "abd" → "administracion de bases de datos").
2. Normaliza el texto (minúsculas, sin acentos ni signos) y quita palabras vacías ("de", "la", "el", "y"...). Las variantes de la base pasan por la misma normalización al cargarse.
3. Saludos: devuelve el menú raíz.
4. Coincidencia exacta con una variante → responde con la opción de esa intención.
5. Si no hay exacta, busca por tres caminos y, para cada variante, se queda con el mayor puntaje:
   - **Cobertura de términos (FTS):** los términos significativos son las palabras de la consulta sin las de la pestaña `ignorados`. Cada término cubre 1 si coincide con stemming (`spanish`), o su similitud si es un error de tipeo (≥ 0,6). La confianza es el promedio sobre los términos.
   - **Trigramas por término:** cada término se compara con las palabras de cada variante (`word_similarity`). Las coincidencias exactas no cuentan acá, porque ya las cubre FTS.
   - **Comparación por palabras:** proporción de palabras de la consulta que aparecen en la variante, tolerando un error de tipeo por palabra (distancia de Damerau ≤ 1 en palabras de 4 letras o más).
6. Umbrales: `≥ KB_UMBRAL_ALTO` (0,90) responde; entre `KB_UMBRAL_MEDIO` (0,70) y el alto, o si dos intenciones empatan, devuelve `aclaracion` con opciones del menú; por debajo, `no_disponible`.
7. Si la opción tiene documentos de dos o más comisiones del mismo tipo, la respuesta es una pregunta de comisión (ver [07](07-contenido-y-decisiones.md), decisión 13).
8. En consultas escritas con respuesta de documentos, busca pasajes en los fragmentos de esos documentos (`documento_fragmento`), con la misma cobertura y el umbral `KB_UMBRAL_PASAJE` (0,90). Si hay pasajes, se muestran en lugar del texto general, seguidos de «Para más información te adjuntamos el PDF completo». Si no, queda el documento completo (ver [08](08-extractos-de-documentos.md)).

La comparación por palabras se calcula en memoria sobre las variantes activas. Si la base crece mucho, conviene pasarla a SQL.

Sin base de datos la API responde 503 (`BASE_NO_CONFIGURADA`). No hay modo demo: el contenido siempre sale de la base.

## 2.5 API

| Método | Ruta | Uso |
|---|---|---|
| GET | `/api/health` | Estado del servicio, base de datos y Drive |
| GET | `/api/menu` | Menú raíz |
| GET | `/api/menu?categoria=<clave>` | Una categoría |
| GET | `/api/menu/:clave` | Detalle de una opción (diagnóstico) |
| POST | `/api/chat` | Selección del menú (`opcion` o `categoria`) o consulta escrita (`message`) |
| POST | `/api/chat/documento` | Registra la apertura de un documento |
| POST | `/api/sync` | Carga el contenido de la planilla y sincroniza documentos. Protegido con `SYNC_SECRET` si está definido |
| GET | `/api/metricas` | Opciones más usadas (agregado, sin datos personales) |
| GET | `/api/metricas/exportar-mes-anterior` | Publica en la planilla de métricas el reporte del mes anterior (o de `?mes=AAAA-MM`), una pestaña por mes. Requiere `Authorization: Bearer <CRON_SECRET>`; lo llama el cron mensual de Vercel |

**Tipos de respuesta de `/api/chat`:** `nodo`, `respuesta`, `derivacion`, `aclaracion`, `no_disponible`, `error`.

**`/api/sync`** devuelve `{ ok, errores, contenido, documentos }`. Si `ok` es `false`, `errores` lista los problemas de la planilla y no se escribió nada.

## 2.6 Configuración

Las variables se leen de `.env` en la raíz del repo (plantilla: `.env.example`).

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión PostgreSQL. Vacía: la API responde 503 |
| `GOOGLE_SHEET_ID` | Para sincronizar | ID de la planilla de contenido |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | Para Google | Cuenta de servicio |
| `GOOGLE_PRIVATE_KEY` | Para Google | Clave privada de la cuenta (con `\n` escapados) |
| `GOOGLE_SHARED_FOLDER_ID` | Para Drive | Carpeta de documentos |
| `DRIVE_LINK_CACHE_TTL` | No | Segundos que se cachean los enlaces de Drive (default 3600) |
| `DRIVE_PUBLIC_LINKS` | No | Debe quedar en `false`: el alcance es de solo lectura |
| `SYNC_SECRET` | Recomendada | Secreto para `POST /api/sync` |
| `CRON_SECRET` | Para métricas | Secreto del cron de la exportación mensual (`Authorization: Bearer`). Sin él, el endpoint responde 503 |
| `GOOGLE_METRICAS_CLIENT_EMAIL`, `GOOGLE_METRICAS_PRIVATE_KEY` | Para métricas | Cuenta de servicio dedicada a las métricas (distinta de la de lectura) |
| `GOOGLE_METRICAS_SHEET_ID` | Para métricas | ID de la planilla de métricas. La cuenta tiene acceso de Editor solo a esa planilla |
| `PORT` | No | Puerto de la API (default 3000) |
| `CORS_ORIGINS`, `VITE_ALLOWED_ORIGINS`, `IFRAME_ANCESTORS` | Sí, para el widget | Orígenes permitidos y dominios que pueden embeber el widget |
| `RATE_LIMIT_WINDOW_MS`, `RATE_LIMIT_MAX` | No | Límite de peticiones por IP |
| `KB_MIN_MENSAJE`, `KB_MAX_MENSAJE` | No | Largo mínimo y máximo de la consulta escrita |
| `KB_UMBRAL_ALTO`, `KB_UMBRAL_MEDIO`, `KB_MARGEN_AMBIGUEDAD`, `KB_MAX_OPCIONES_ACLARACION` | No | Calibración del texto libre |
| `KB_UMBRAL_PASAJE` | No | Confianza mínima para mostrar un extracto del documento (por defecto `0.90`) |

## 2.7 Desarrollo local

```bash
npm install
docker compose up -d --build                  # PostgreSQL con el esquema
DATABASE_URL=postgresql://postgres:password123@localhost:5432/ifts29 \
  npm run sync --workspace backend            # carga contenido y documentos
npm run dev:api                               # API en el puerto 3000
npm run dev:web                               # Widget en desarrollo
```

Para verificar: `GET /api/health` debe responder `"estado":"ok"`, y el menú debe responder con datos.

## 2.8 Pruebas

```bash
npm test --workspace backend        # tests del backend
npm run typecheck                   # tipos de backend y frontend
```

Los tests del backend no necesitan base ni red. Ver [05-pruebas-unitarias.md](05-pruebas-unitarias.md) y [06-pruebas-integracion.md](06-pruebas-integracion.md).

## 2.9 Pendientes técnicos

- **Conjunto dorado** para medir el motor de texto libre.
- **Pruebas con fixtures más complejos** (más materias, varias comisiones y documentos) para cubrir la pregunta de comisión y la cobertura de términos.
- **Métricas en `db:reset`.** Ver [04-base-datos.md](04-base-datos.md), sección 4.5.
- **Despliegue en Neon.** Pendiente de revisión. Incluye la tabla `documento_fragmento` y la columna `documento.fragmentos_md5`: como el esquema usa `CREATE TABLE IF NOT EXISTS`, hace falta el mismo reset que en local.
