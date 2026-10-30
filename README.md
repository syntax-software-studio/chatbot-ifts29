# Asistente Virtual IFTS N.°29

Asistente virtual institucional para consultas administrativas y académicas del
IFTS N.°29. Combina un **menú guiado** con un **campo de consulta escrita** y está
pensado para embeberse en el campus virtual de Moodle mediante un `iframe`.

La consulta escrita no genera respuestas: la API interpreta la intención y
devuelve **la misma respuesta institucional** —con sus documentos y contactos— que
la opción equivalente del menú. Ante una consulta ambigua pide precisión con
opciones reales del menú; si no hay información autorizada, lo informa.

- **Frontend:** React 18 + TypeScript + Vite
- **Backend:** Express 5 + TypeScript, ejecutado como función *serverless* de Vercel
- **Datos:** PostgreSQL (Neon en producción, Docker en desarrollo). El contenido se
  carga desde una planilla de Google y la carpeta de Drive
- **Interpretación:** coincidencia exacta + cobertura de términos (FTS en
  español) + similitud trigram por término (`pg_trgm`). Sin LLM, sin
  embeddings, sin acceso a Internet
- **Documentos:** sincronización con Google Drive mediante *Service Account*
  (modo solo lectura)

---

## 1. Requisitos

| Herramienta | Versión |
| --- | --- |
| Node.js | 20 o superior (probado con 24) |
| npm | 10 o superior |

Para la base local hace falta Docker (o una `DATABASE_URL` de Neon).

## 2. Puesta en marcha rápida

```bash
npm install
docker compose up -d --build
npm run sync --workspace backend   # carga el contenido (requiere DATABASE_URL en .env)

# Terminal 1: API
npm run dev:api

# Terminal 2: interfaz
npm run dev:web
```

- Interfaz: <http://localhost:5173>
- API: <http://localhost:3000/api/health>

Sin `DATABASE_URL` la API responde 503 (`BASE_NO_CONFIGURADA`): no hay modo demo.
Para la base local, agregá al `.env`:

```
DATABASE_URL=postgresql://postgres:password123@localhost:5432/ifts29
```

Ver la sección 4 para el resto de la configuración.

## 3. Estructura del proyecto

```
.
├── .env.example             # Plantilla de configuración (copiar a .env)
├── api/index.ts             # Entry point de la función serverless de Vercel
├── db/
│   ├── 001_schema.sql       # DDL: menú, base de conocimiento, triggers y vistas
│   └── 003_verificacion.sql # Comprueba contra PostgreSQL real que todo responde
├── backend/
│   ├── src/
│   │   ├── db/              # pool.ts (PostgreSQL), catalogo.ts, conocimiento.ts, push.ts
│   │   ├── routes/          # menu, chat, system (health / metricas / sync)
│   │   ├── services/        # chat, nl (intérprete), drive, metricas
│   │   ├── middleware/      # CORS + cabeceras, rate limit, errores
│   │   └── utils/           # env.ts, normalizar.ts, errors.ts
│   └── test/                # 58 tests con node:test (sin dependencias extra)
├── frontend/
│   ├── public/widget.js     # Script inyector para Moodle
│   └── src/                 # ChatWidget + compositor, tarjetas, burbujas, estilos
└── vercel.json              # Frontend estático + API en un mismo proyecto
```

## 4. Configuración

Copiar `.env.example` a `.env` y completar lo necesario:

```bash
cp .env.example .env
```

**Un solo archivo para todo el proyecto**: tanto el backend como el build del
frontend leen ese `.env` de la raíz (Vite usa `envDir: '..'`). No hace falta
`dotenv` ni flags por script. Si el archivo no existe, todo funciona con los
defaults; sin `DATABASE_URL` la API responde 503.

El `.env` está en `.gitignore` y **no se despliega**: en Vercel las mismas
variables se cargan en *Project Settings → Environment Variables*.

| Variable | Para | Default |
| --- | --- | --- |
| `DATABASE_URL` | API | vacío → la API responde 503 (sin base) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | API | vacío → Drive deshabilitado |
| `GOOGLE_PRIVATE_KEY` | API | vacío |
| `GOOGLE_SHARED_FOLDER_ID` | API | vacío |
| `DRIVE_PUBLIC_LINKS` | API | `false` |
| `CORS_ORIGINS` | API | Moodle + app + localhost |
| `IFRAME_ANCESTORS` | API | mismos orígenes que CORS |
| `SYNC_SECRET` | API | vacío |
| `RATE_LIMIT_MAX` | API | `120` req/min por IP |
| `KB_UMBRAL_ALTO` / `KB_UMBRAL_MEDIO` | API | `0.90` / `0.70` |
| `KB_MAX_MENSAJE` | API | `800` |
| `VITE_API_BASE_URL` | Build | vacío → mismo origen |
| `VITE_ALLOWED_ORIGINS` | Build | Moodle + app |
| `VITE_INSTITUTO_NOMBRE` | Build | `IFTS N°29` |

> Las variables `VITE_*` se incrustan en el bundle **en tiempo de build**. En
> Vercel hay que definirlas en *Project Settings → Environment Variables*; si
> se cambian hay que volver a desplegar.

### Nombre de la base

La aplicación **no depende del nombre**: lo único que lee es `DATABASE_URL`. El
proyecto usa `ifts29` como nombre de base, que es la convención que aparece en
`.env.example` y en `db/003_verificacion.sql`:

```
postgresql://USUARIO:PASSWORD@ep-xxxx-pooler.REGION.neon.tech/ifts29?sslmode=require
                                                                   ^^^^^^ base
```

La misma `DATABASE_URL` sirve para Neon y para el PostgreSQL de Docker. El driver
es `pg` (node-postgres), que soporta SCRAM-SHA-256 y SSL, así que no hay un
driver distinto por entorno. El nombre de la rama (`main`, `dev`, …) es
indistinto.

Para Docker local:

```
postgresql://postgres:password123@localhost:5432/ifts29
```

## 5. Base de datos

Con `DATABASE_URL` en el `.env`:

```bash
npm run db:push     # aplica esquema + contenido (idempotente)
npm run db:reset    # borra el esquema public y lo vuelve a crear
```

`db:push` aplica sólo `001_schema.sql` (el esquema) y es idempotente. El contenido
(menú, base de conocimiento, contactos y documentos) no sale del repo: se carga desde la
planilla de Google con `npm run sync --workspace backend`, que también sincroniza los
documentos de Drive. Para cambiar un texto o agregar una variante se edita la planilla y
se vuelve a sincronizar.

`db/001_schema.sql` define el esquema completo, las dos mitades del sistema:

- `categoria`, `opcion_menu`, `respuesta`, `documento`, `contacto`
- Tablas de relación: `opcion_contacto`, `respuesta_documento`
- `metrica_opcion` (métricas agregadas, sin datos personales)
- La base de conocimiento de las consultas escritas: `kb_intencion` (qué
  intención corresponde a qué opción del menú), `kb_pregunta` (la formulación
  canónica) y `kb_pregunta_variante` (las redacciones alternativas ya
  normalizadas)
- Índices: B-tree para la coincidencia exacta, GIN sobre `search_vector` para la
  búsqueda de palabras y GIN `gin_trgm_ops` para la similitud; extensiones
  `pgcrypto` y `pg_trgm`
- Trigger `touch_actualizado_en` y vistas `v_arbol_menu` y `v_kb_resolucion`
  para control

Cada intención apunta a una opción de `opcion_menu` y a una `respuesta` ya
validada (`ON DELETE RESTRICT`): el contenido no se duplica ni se genera, se
reutiliza.

### Ampliar la base de conocimiento

El contenido vive en la planilla de Google "Bot IFTS29 - Contenido", no en el código. Para sumar una redacción nueva:

1. Agregar la fila en la pestaña `variantes` (y, si hace falta, en `preguntas` o `intenciones`).
2. Ejecutar `npm run sync --workspace backend`. Valida la planilla antes de escribir: si hay un error, lo muestra y no cambia nada.

```bash
npm run sync --workspace backend   # carga el contenido y sincroniza los documentos
npm test --workspace backend       # valida el código
```

### Verificación contra PostgreSQL real

`db/003_verificacion.sql` ejecuta las mismas consultas que usa la aplicación, más
las de la base de conocimiento:

```bash
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f db/003_verificacion.sql
```

Debe terminar con `VERIFICACION COMPLETA` y sin errores. Las secciones 15 a 22
son las de la KB: volumen, integridad referencial (todo en 0), qué intención
reutiliza qué opción, en qué casos la coincidencia exacta exige **aclaración**,
qué tan cerca queda una consulta mal escrita, la cobertura por intención y los
textos genéricos compartidos. Esa última lista es la que sirve para calibrar
`KB_UMBRAL_MEDIO`.

## 6. API

| Método | Ruta | Descripción |
| --- | --- | --- |
| `GET` | `/api/menu` | Menú raíz. `?mapa=1` devuelve el árbol completo |
| `GET` | `/api/menu/:clave` | Un nodo del menú |
| `POST` | `/api/chat` | `{ "opcion": "RAIZ_OP_ADMIN" }` o `{ "message": "¿cuándo empiezan las clases?" }` → turno |
| `POST` | `/api/chat/documento` | Registra la apertura de un documento |
| `GET` | `/api/metricas` | Métricas agregadas de los últimos N días |
| `POST` | `/api/sync` | Sincroniza fichas con Google Drive |
| `GET` | `/api/health` | Estado de la API, la base y Drive |

`POST /api/chat` devuelve siempre un discriminante `tipo`:

- `nodo` → un nuevo menú (`nodo`)
- `respuesta` → texto y, si corresponde, `respuesta.documentos`
- `derivacion` → orientación a la persona-humana adecuada
- `aclaracion` → la consulta era ambigua: `aclaracion.opciones` son opciones
  reales del menú, para responder con un toque
- `no_disponible` → no hay información autorizada para esa consulta

Los turnos que provienen de una consulta escrita incluyen `meta` con el origen
(`kb_question`, `kb_variant`, `rule`), el tipo de coincidencia (`exacto`,
`similar`, `regla`) y la confianza. Sirve para trazabilidad y para medir en qué
casos hay que ampliar la base de conocimiento; no se muestra al estudiante.

Ejemplos:

```bash
curl localhost:3000/api/menu
curl localhost:3000/api/chat -H 'Content-Type: application/json' \
     -d '{"opcion":"ACA_OP_TP"}'
curl localhost:3000/api/chat -H 'Content-Type: application/json' \
     -d '{"message":"¿cuándo empiezan las clases de Técnicas de Programación?"}'
curl localhost:3000/api/chat -H 'Content-Type: application/json' \
     -d '{"message":"¿cuándo empiezan las clases?"}'   # → aclaración entre 4 materias
```

`opcion`/`categoria` y `message` son excluyentes: enviar ambos se rechaza. El
campo opcional `conversationId` se acepta y se ignora (la memoria conversacional
está postergada).

### Errores

Formato uniforme: `{ "error": { "code": "...", "message": "..." } }`.
Códigos: `VALIDATION_ERROR`, `NOT_FOUND`, `RATE_LIMITED`,
`DRIVE_NO_CONFIGURADO`, `INTERNAL_ERROR`.

### Cómo se interpreta una consulta escrita

1. **Normalización**: minúsculas, sin tildes ni puntuación, espacios colapsados,
   letras repetidas recortadas (`normalizar`, el mismo código que carga las
   variantes).
2. **Regla de saludos**: `hola`, `buen día`… devuelven el menú raíz.
3. **Coincidencia exacta** sobre `normalized_text` (índice B-tree). Si el texto
   coincide con variantes de varias intenciones, se devuelven **todas**: es el
   caso que dispara la aclaración.
4. **Cobertura de términos (FTS)**: cada término de la consulta (sin las palabras
   de la pestaña `ignorados`) cubre 1 si coincide con stemming, o su similitud si
   es un error de tipeo. La confianza es el promedio.
5. **Trigramas por término** (`pg_trgm`, `word_similarity`) para los errores de
   tipeo que FTS no resuelve.
6. **Umbrales**: confianza alta → respuesta; media → aclaración con opciones del
   menú; baja → `no_disponible`. Si la opción tiene documentos de varias
   comisiones, pregunta la comisión antes de mostrarlos.

Los umbrales se configuran por entorno (`KB_UMBRAL_ALTO`, `KB_UMBRAL_MEDIO`,
`KB_MARGEN_AMBIGUEDAD`, `KB_MAX_MENSAJE`, `KB_MAX_OPCIONES_ACLARACION`). Son
valores iniciales, pensados para calibrarse con consultas reales.

### Comportamiento esperado

| Consulta del estudiante | Resultado |
| --- | --- |
| `¿Cómo accedo al SIU Guaraní?` | Respuesta con su enlace |
| `programa de técnicas de programación` | Respuesta del programa correcto |
| `programa` | **Aclaración** entre las 4 materias |
| `¿cuándo empiezan las clases?` | **Aclaración** entre las 4 materias |
| `como puedo accder al siu guarani` | Respuesta por similitud (tolerante a errores) |
| `quiero cambiarme de comisión` | `no_disponible`: no está cargado |
| `hola` | Menú raíz |

La diferencia entre las filas de aclaración y la de respuesta directa con materia
es intencional: cuando la consulta dice **qué materia** se resuelve sola; cuando
es **genérica** se pregunta, porque cada materia puede tener una respuesta
distinta.

### En la interfaz

El compositor está debajo de las opciones: `Enter` envía, `Shift+Enter` hace una
línea nueva, acepta entre 2 y 800 caracteres (la API los revalida) y el botón de
enviar se habilita solo cuando hay texto válido. Al resolver una consulta
escrita, el menú **no se borra**: el estudiante puede seguir explorando sin
reiniciar.

## 7. Sincronización con Google Drive

1. Crear una *Service Account* en Google Cloud y descargar la clave JSON.
2. **Compartir la carpeta institucional** con el `client_email` de la cuenta
   como **lector**. También funciona con un *Shared Drive*.
3. Cargar los archivos respetando la convención de nombres:
   `<Materia>_<Tipo>.pdf`, por ejemplo `Tecnicas de Programacion_Programa.pdf`.
   La comparación ignora mayúsculas, acentos y signos.
4. Configurar las variables `GOOGLE_*`.
5. Ejecutar la sincronización:

```bash
curl -X POST https://<deploy>/api/sync \
     -H "X-Sync-Secret: $SYNC_SECRET" \
     -H 'Content-Type: application/json' -d '{"dryRun": false}'
```

Usar `dryRun: true` para ver qué se emparejaría y qué quedaría sin coincidencia,
sin escribir nada.

**El emparejamiento es exacto, por diseño.** Se compara el `fileId` conocido o
el nombre normalizado completo. No hay coincidencia aproximada por prefijo: en
una misma materia, "Programa" y "Cronograma" comparten prefijo, así que un
match laxo podría adjuntar el PDF equivocado al estudiante. Un enlace
incorrecto es peor que un enlace ausente, así que lo que no coincide se
reporta en `sinMatch` para que el equipo renombre el archivo.

- La sincronización **recorre subcarpetas**.
- La Service Account opera en **solo lectura**: `DRIVE_PUBLIC_LINKS` está en
  `false` porque crear el permiso "cualquiera con el enlace" es una escritura
  que el alcance `drive.readonly` rechaza con 403. Si la carpeta ya es pública,
  funciona sin tocar nada.
- Un documento sin archivo en Drive **no recibe una URL inventada**: la tarjeta
  se muestra sin enlace y con un aviso para consultar a tutoría o Bedelía.

## 8. Despliegue en Vercel

Frontend y API conviven en un mismo proyecto, por lo que el widget se sirve en
el mismo origen que consume la API y **no hay CORS que configurar**:

```bash
npm i -g vercel
vercel link
vercel env add DATABASE_URL production
vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL production
vercel env add GOOGLE_PRIVATE_KEY production
vercel env add GOOGLE_SHARED_FOLDER_ID production
vercel env add SYNC_SECRET production
vercel --prod
```

También hay que cargar las `VITE_*`, que se incrustan en el bundle en tiempo de
build (`VITE_API_BASE_URL`, `VITE_ALLOWED_ORIGINS`, `VITE_INSTITUTO_NOMBRE`,
`VITE_INSTITUTO_SUBTITULO`); si se cambian, hay que volver a desplegar.

`vercel.json` ya define el build (`frontend/dist`), la función `api/index.ts` y
los *rewrites*.

### Cabeceras de seguridad

- `Content-Security-Policy` con `frame-ancestors` limitado al Moodle y al propio
  sitio. Sin `X-Frame-Options`, que no admite listas y rompería el embebido.
- El CORS de la API es una **allowlist** estricta (nunca `*`) resuelta en
  `backend/src/middleware/cors.ts`; `vercel.json` no agrega cabeceras CORS a
  `/api` para no sobrescribirla.
- `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` en todo el
  sitio.

## 9. Insertar en Moodle

En *Administración del sitio → Ajustes → HTML adicional*, pegar:

```html
<script src="https://chatbot-ifts29-jade.vercel.app/widget.js" defer></script>
```

Opciones por atributos del `<script>`:

| Atributo | Default | Uso |
| --- | --- | --- |
| `data-ifts-src` | `https://chatbot-ifts29-jade.vercel.app` | Otro despliegue |
| `data-ifts-title` | `Asistente IFTS 29` | Título del panel |
| `data-ifts-height` | `520` | Alto en píxeles |
| `data-ifts-container` | — | Selector del contenedor (modo inline) |
| `data-ifts-debug` | `false` | Doble clic para abrir y ver el pie |

Si `data-ifts-container` apunta a un elemento, el widget se dibuja **inline**
(panel de `380×520`) en vez de usar el lanzador flotante.

### API de control

```js
window.IFTS29Asistente.abrir();
window.IFTS29Asistente.cerrar();
window.IFTS29Asistente.alternar();
window.IFTS29Asistente.reiniciar();
window.IFTS29Asistente.destruir();
```

Los mensajes entre el iframe y la página padre usan un `targetOrigin` explícito
(`https://aulasvirtuales.bue.edu.ar`), no `'*'`.

## 10. Scripts

| Comando | Qué hace |
| --- | --- |
| `npm run dev:api` | API en modo desarrollo (puerto 3000) |
| `npm run dev:web` | Interfaz con HMR (puerto 5173) |
| `npm run build` | Compila backend y frontend |
| `npm run typecheck` | Chequeo de tipos de ambos workspaces |
| `npm test --workspace backend` | Tests del backend (`node --test`, sin dependencias extra) |
| `npm run db:push` | Aplica sólo `001_schema.sql` (esquema) |
| `npm run sync --workspace backend` | Carga el contenido de la planilla y sincroniza los documentos de Drive |
| `npm run db:reset` | Borra el esquema y lo vuelve a crear |

### Qué cubren los tests

`npm test --workspace backend` corre 58 tests con `node:test`. Las pruebas de
integración usan una base de prueba (`ifts29_test`) en el PostgreSQL de Docker, con
fixtures propios: nunca se conectan a Neon ni a Google.

| Archivo | Qué verifica |
| --- | --- |
| `normalizar.test.ts` | Normalización y el coeficiente trigram, contra los casos del código de `pg_trgm` |
| `conocimiento.test.ts` | Matching exacto y por similitud, y que la ambigüedad se preserve |
| `nl.service.test.ts` | Desenlaces del intérprete: respuesta, aclaración, `no_disponible`, saludo, cobertura de términos y errores de tipeo |
| `comisiones.test.ts` | Lectura de la comisión desde el nombre del documento, pregunta de comisión y filtrado del documento elegido |
| `fuente-contenido.test.ts` | Validación de la planilla: encabezados, pestañas y filas |
| `api.test.ts` | Contrato HTTP de `/api/chat` sobre la app real (Express en un puerto efímero) |
| `sql-coincide.test.ts` | Que cada columna usada por el SQL exista en los DDL |

Este último evita una falla difícil de detectar: que el SQL de la aplicación use una
columna que no existe en el esquema. Se verifica en `npm test`, sin base de datos.

## 11. Privacidad

- **No se guardan datos personales.** No hay nombres, correos ni matrícula del
  estudiante en el backend.
- El historial de conversación vive **solo en la pestaña** del navegador y se
  descarta al recargar o reiniciar. El texto que el estudiante escribe tampoco
  se persiste: se usa para resolver la consulta en el momento y la base solo
  guarda las variantes institutionales.
- Las métricas son **agregadas y anónimas**: qué opción se elige y cuántas
  veces, sin identidad ni marca de tiempo. Las del flujo escrito registran el
  desenlace (`texto_exacto`, `texto_similar`, `texto_regla`, `aclaracion`,
  `no_disponible`), nunca la consulta.
- La clave privada de Google Drive nunca llega al frontend.

## 12. Límites conocidos

- La derivación cubre los motivos y comisiones cargados en la planilla. Los cambios se
  hacen en la planilla y sincronizan sin tocar código.
- El texto libre cubre únicamente lo que ya está en el menú: si la base de
  conocimiento no tiene una variante parecida, la respuesta es
  `no_disponible`. Ampliar cobertura es agregar variantes en la
  pestaña `variantes` de la planilla y sincronizar.
- Los umbrales de similitud son valores iniciales. Conviene revisarlos con
  consultas reales antes de dar por cerrada la calibración.
- No hay memoria conversacional: `conversationId` se acepta y se ignora.
- La capa de `documento` (metadatos + `fileId` + enlace real) es la base para
  sumar RAG más adelante sin cambiar el contrato del menú.
