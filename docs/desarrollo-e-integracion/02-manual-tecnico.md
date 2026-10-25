# 2. Manual Técnico

## 📖 Guía Técnica para Desarrolladores

Este manual está dirigido a desarrolladores o personas con conocimientos técnicos que necesiten instalar, mantener o continuar el desarrollo de la aplicación PP4 Bot IFTS29.

---

## 1. Introducción General

### 1.1 Descripción del Sistema

**Nombre:** Asistente Virtual IFTS N.°29  
**Versión:** 1.0.0  
**Objetivo:** Proporcionar un asistente virtual institucional para consultas administrativas y académicas del IFTS N.°29, combinando un menú guiado con capacidad de interpretación de lenguaje natural (consultas escritas).  
**Alcance:** Sistema de solo lectura, anónimo, con consultas que se pueden realizar a través de un menú interactivo o mediante texto libre. El sistema devuelve respuestas validadas institucionalmente junto con documentos relevantes y contactos de derivación cuando corresponda.

### 1.2 Objetivo y Propósito

La aplicación fue diseñada para integrarse en el campus virtual (Moodle) del IFTS N.°29 mediante un widget embebible (`iframe`). El sistema proporciona:
- **Menú conversacional guiado** basado en categorías y opciones del usuario
- **Interpretación de consultas escritas** mediante similitud exacta, variantes y trigram (`pg_trgm`)
- **Respuestas institucionales validadas** con documentos sincronizados desde Google Drive
- **Derivación asincrónica** a contactos administrativos cuando corresponda
- **Funcionamiento sin LLM ni embeddings**, garantizando respuestas consistentes y predecibles

---

## 2. Arquitectura del Sistema

### 2.1 Modelo Arquitectónico

**Patrón seleccionado:** Arquitectura en capas (Frontend-Backend-Database) con Monorepo

**Justificación:** 
- Separación clara de responsabilidades: interfaz de usuario, lógica de negocio, persistencia
- Monorepo facilita el desarrollo coordinado compartiendo tipos TypeScript entre frontend y backend
- Frontend como SPA (Single Page Application) embebible permite integración en Moodle sin cambios arquitectónicos
- Backend serverless (Express en Vercel) proporciona escalabilidad y bajo costo de mantenimiento
- Catálogo semilla local permite funcionamiento sin infraestructura externa (modo demo)

### 2.2 Tecnologías Empleadas

| Aspecto | Tecnología | Versión |
|--------|-----------|---------|
| **Frontend** | React | 18+ |
| **Build Frontend** | Vite | 5.x |
| **Backend** | Express | 5.x |
| **Lenguaje** | TypeScript | 5.9.3+ |
| **Base de datos** | PostgreSQL (Neon) | 15+ |
| **Testing** | Node.js test (nativo) | 20+ |
| **Runtime** | Node.js | 20+ |
| **Deployment** | Vercel | (serverless) |
| **Control de versiones** | Git | 2.0+ |
| **Otros** | Google Drive API, pg_trgm (similitud) | - |

### 2.3 Diagrama de Capas/Componentes

```
┌─────────────────────────────────────────────────────┐
│              FRONTEND (React + Vite)                │
│  ChatWidget | ChatLauncher | MessageBubble | Cards  │
│  (embebible en Moodle mediante iframe)              │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/JSON
┌────────────────────▼────────────────────────────────┐
│     BACKEND (Express + TypeScript, Vercel)          │
├─────────────────────────────────────────────────────┤
│  Routes:        Services:           Middleware:     │
│  • /api/menu    • chat.service      • CORS          │
│  • /api/chat    • nl.service        • Rate Limit    │
│  • /api/system  • drive.service     • Error Handler │
│                 • metricas.service                  │
└────────────────────┬────────────────────────────────┘
                     │ (SQL vía pg, PostgreSQL local o Neon)
┌────────────────────▼────────────────────────────────┐
│     DATABASE (PostgreSQL - Neon)                    │
├─────────────────────────────────────────────────────┤
│ Tablas:                                             │
│ • categoria (nodos del árbol conversacional)        │
│ • opcion_menu (opciones seleccionables)             │
│ • respuesta (contenido institucional validado)      │
│ • documento (archivos de Google Drive)              │
│ • contacto (para derivaciones asincrónicas)         │
│ • conocimiento (base de intenciones/variantes)      │
└─────────────────────────────────────────────────────┘
```

**Flujo de datos:**
1. Usuario interactúa con widget en Moodle
2. Frontend envía opción seleccionada o consulta escrita
3. Backend interpreta la consulta y busca coincidencias
4. Backend recupera respuesta, documentos y contactos
5. Frontend renderiza la respuesta con componentes React

---

## 3. Estructura del Proyecto

### 3.1 Árbol de Directorios

```
asistente-virtual-ifts29/
├── .env.example                    # Plantilla de variables de entorno
├── .gitignore                      # Exclusiones de Git
├── package.json                    # Dependencias del monorepo
├── vercel.json                     # Configuración de despliegue
│
├── api/                            # Entry point serverless de Vercel
│   └── index.ts                    # Wrapper para función serverless
│
├── backend/                        # API REST (Express + TypeScript)
│   ├── package.json                # Dependencias del backend
│   ├── tsconfig.json               # Configuración TypeScript
│   ├── src/
│   │   ├── index.ts                # Entry point (servidor)
│   │   ├── app.ts                  # Configuración Express
│   │   ├── db/                     # Capa de datos
│   │   │   ├── pool.ts             # Conexión a Neon PostgreSQL
│   │   │   ├── catalogo.ts         # Modelos de datos del menú
│   │   │   ├── conocimiento.ts     # Modelos de la base de conocimiento
│   │   │   ├── types.ts            # Interfaces TypeScript compartidas
│   │   │   ├── push.ts             # Migraciones de BD
│   │   │   ├── generar-kb-seed.ts  # Generador de semilla KB
│   │   │   └── sql/                # [Queries SQL]
│   │   ├── routes/                 # Endpoints HTTP
│   │   │   ├── menu.routes.ts      # GET /api/menu (árbol conversacional)
│   │   │   ├── chat.routes.ts      # POST /api/chat (opciones + consultas)
│   │   │   └── system.routes.ts    # /health, /metricas, /sync
│   │   ├── services/               # Lógica de negocio
│   │   │   ├── chat.service.ts     # Procesamiento de turnos
│   │   │   ├── nl.service.ts       # Interpretación (NL controlado)
│   │   │   ├── drive.service.ts    # Sincronización Google Drive
│   │   │   └── metricas.service.ts # Recopilación de estadísticas
│   │   ├── middleware/             # Middlewares Express
│   │   │   ├── cors.ts             # CORS + Headers de seguridad
│   │   │   ├── error.ts            # Manejo de errores
│   │   │   └── rateLimit.ts        # Rate limiting por IP
│   │   ├── seed/                   # Catálogo semilla (para modo demo)
│   │   │   ├── catalogo.ts         # Datos del menú en memoria
│   │   │   └── conocimiento.ts     # KB en memoria
│   │   └── utils/
│   │       ├── env.ts              # Lectura de variables de entorno
│   │       ├── normalizar.ts       # Normalización de texto
│   │       └── errors.ts           # Clases de error personalizadas
│   └── test/                       # Suite de tests (Node.js test)
│       ├── api.test.ts             # Tests de endpoints HTTP
│       ├── nl.service.test.ts      # Tests del motor NL
│       ├── conocimiento.test.ts    # Tests de búsqueda KB
│       ├── normalizar.test.ts      # Tests de normalización
│       └── [otros tests]
│
├── frontend/                       # SPA React (embebible)
│   ├── package.json                # Dependencias del frontend
│   ├── vite.config.ts              # Configuración Vite
│   ├── tsconfig.json               # Configuración TypeScript
│   ├── public/
│   │   └── widget.js               # Script inyector para Moodle
│   ├── index.html                  # HTML principal
│   └── src/
│       ├── main.tsx                # Entry point React
│       ├── App.tsx                 # Componente raíz
│       ├── api/
│       │   └── client.ts           # Cliente HTTP
│       ├── components/             # Componentes React
│       │   ├── ChatWidget.tsx      # Widget principal embebible
│       │   ├── ChatLauncher.tsx    # Botón flotante
│       │   ├── ChatHeader.tsx      # Encabezado del chat
│       │   ├── MessageBubble.tsx   # Burbuja de mensaje
│       │   ├── OptionList.tsx      # Lista de opciones
│       │   ├── DocumentCard.tsx    # Tarjeta de documento
│       │   ├── ContactCard.tsx     # Tarjeta de contacto
│       │   └── icons.tsx           # Iconos SVG
│       ├── hooks/
│       │   └── useChat.ts          # Hook para manejo de chat
│       ├── types.ts                # Interfaces TypeScript (replica de backend)
│       ├── config.ts               # Configuración del widget
│       └── styles/                 # Estilos CSS/SCSS
│
├── db/                             # Scripts SQL (versión histórica)
│   ├── 001_schema.sql              # DDL (tablas, índices, triggers)
│   ├── 002_seed.sql                # DML (datos iniciales del menú)
│   ├── 003_verificacion.sql        # Scripts de verificación
│   └── 005_kb_seed.sql             # Datos de base de conocimiento
│
├── docs/                           # Documentación
│   ├── analisis-y-modelado-del-diseño/  # Etapa 1
│   └── desarrollo-e-integracion/        # Etapa 4 (esta)
│
└── README.md                       # Documentación general del proyecto
```

### 3.2 Descripción de Carpetas Principales

| Carpeta | Descripción |
|---------|-------------|
| `backend/src/db` | Capa de acceso a datos y modelos |
| `backend/src/routes` | Definición de endpoints HTTP |
| `backend/src/services` | Lógica de negocio (chat, NL, Drive) |
| `backend/test` | Tests de integración y unitarios |
| `frontend/src/components` | Componentes React reutilizables |
| `frontend/src/hooks` | Hooks personalizados (state management) |
| `db/` | Scripts SQL para inicialización de BD |
| `docs/` | Documentación de todas las etapas |

### 3.3 Componentes y Servicios Principales

**Backend (Express):**

- **ChatService** - Procesa turnos de chat (menú, respuesta, derivación)
- **NLService** - Motor de interpretación: normaliza texto, busca coincidencias, calcula similitud trigram
- **DriveService** - Sincronización de documentos desde Google Drive
- **MetricasService** - Recopila estadísticas de uso
- **ChatRoutes** - Endpoint POST /api/chat (procesa opciones y consultas)
- **MenuRoutes** - Endpoint GET /api/menu (árbol conversacional)
- **SystemRoutes** - Endpoints de healthcheck, metricas, sincronización

**Frontend (React):**

- **ChatWidget** - Componente principal embebible, maneja la interfaz completa
- **ChatLauncher** - Botón flotante para activar/desactivar el widget
- **ChatHeader** - Encabezado con nombre de institución
- **MessageBubble** - Renderiza burbujas de mensaje (bot y usuario)
- **OptionList** - Lista de opciones interactivas
- **DocumentCard** - Tarjeta para mostrar documentos adjuntos
- **ContactCard** - Tarjeta para mostrar contactos de derivación
- **useChat Hook** - Gestiona estado y lógica de chat

---

## 4. Base de Datos

### 4.1 Resumen de BD

**Sistema:** PostgreSQL: Neon en producción, Postgres local con Docker en desarrollo (driver `pg`)  
**Modo demo:** Catálogo semilla en memoria (Node.js, idéntico a BD). *Deprecado en propuesta: ver [base-conocimiento/04-base-como-fuente-unica.md](../base-conocimiento/04-base-como-fuente-unica.md).*  
**Esquema:** 6 tablas principales + vistas + triggers + índices

### 4.2 Tablas Principales

#### Tabla: `categoria` - Nodos del árbol conversacional

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL, UNIQUE | Identificador único alfanumérico (ej: "RAIZ") |
| `nombre` | TEXT | NOT NULL | Nombre visible (ej: "Inicio") |
| `mensaje` | TEXT | NULL | Mensaje del bot al entrar a esta categoría |
| `orden` | INTEGER | NOT NULL, DEFAULT 0 | Orden de presentación |
| `es_raiz` | BOOLEAN | NOT NULL, DEFAULT FALSE | TRUE solo para la categoría inicial |
| `activo` | BOOLEAN | NOT NULL, DEFAULT TRUE | Estado del registro |
| `creado_en` | TIMESTAMPTZ | DEFAULT now() | Timestamp de creación |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Timestamp de última actualización |

---

#### Tabla: `opcion_menu` - Opciones seleccionables

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL, UNIQUE | Identificador único (ej: "ADM_OP_SIU") |
| `categoria_id` | INTEGER | NOT NULL, FK → categoria | Categoría padre |
| `etiqueta` | TEXT | NOT NULL | Texto del botón |
| `descripcion` | TEXT | NULL | Descripción (para tooltips) |
| `tipo` | TEXT | CHECK('navegar', 'responder', 'derivar') | Tipo de acción |
| `categoria_destino_id` | INTEGER | FK → categoria, NULL si no navega | Para tipo 'navegar' |
| `respuesta_id` | INTEGER | FK → respuesta, NULL si no responde | Para tipo 'responder' |
| `es_volver` | BOOLEAN | DEFAULT FALSE | TRUE para opción "< Volver" |
| `icono` | TEXT | NULL | Nombre de icono (ej: "question-circle") |
| `orden` | INTEGER | DEFAULT 0 | Orden en el menú |
| `activo` | BOOLEAN | DEFAULT TRUE | Estado |
| `creado_en` | TIMESTAMPTZ | DEFAULT now() | Timestamp |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Timestamp |

---

#### Tabla: `respuesta` - Contenido institucional validado

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `clave` | TEXT | Identificador único |
| `titulo` | TEXT | Título de la respuesta |
| `texto` | TEXT | Contenido (markdown permitido) |
| `activo` | BOOLEAN | Estado |
| `creado_en` / `actualizado_en` | TIMESTAMPTZ | Auditoría |

---

#### Tabla: `documento` - Archivos desde Google Drive

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `clave` | TEXT | Identificador único |
| `nombre` | TEXT | Nombre del archivo |
| `descripcion` | TEXT | Descripción |
| `tipo` | TEXT | Categoría (ej: "reglamento", "programa") |
| `mimeType` | TEXT | MIME type (application/pdf, etc.) |
| `url` | TEXT | URL de descarga/acceso |
| `vigente` | BOOLEAN | Indica si aún es válido |
| `estado` | ENUM | 'borrador', 'revision', 'vigente', 'reemplazado', 'archivado' |
| `fechaActualizacion` | TIMESTAMPTZ | Última actualización desde Drive |
| `sincronizado` | BOOLEAN | Si fue sincronizado exitosamente |

---

#### Tabla: `contacto` - Para derivaciones asincrónicas

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `clave` | TEXT | Identificador único |
| `nombre` | TEXT | Nombre del contacto |
| `rol` | TEXT | Cargo/rol (ej: "Secretario") |
| `area` | TEXT | Área/departamento |
| `email` | TEXT | Email de contacto |
| `telefono` | TEXT | Teléfono |
| `urlPerfil` | TEXT | Enlace a perfil institucional |
| `motivo` | TEXT | Descripción de cuándo contactar |
| `horario` | TEXT | Horario de atención |

---

#### Tabla: `conocimiento` - Base de intenciones (Knowledge Base)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | PRIMARY KEY |
| `opcion_clave` | TEXT | FK a opcion_menu.clave |
| `normalized_text` | TEXT | Texto normalizado (indexado para búsqueda) |
| `tipo` | ENUM | 'pregunta_base', 'variante' |
| `fuente` | TEXT | Origen (menú, web, usuarios) |
| `confidence_override` | NUMERIC | Confianza manual si existe |

### 4.3 Índices Principales

```sql
-- Para búsqueda exacta
CREATE INDEX categoria_idx ON categoria(clave);
CREATE INDEX opcion_menu_idx ON opcion_menu(clave, activo);

-- Para búsqueda de similitud (trigram)
CREATE INDEX conocimiento_normalized_idx 
  ON conocimiento USING gin(normalized_text gin_trgm_ops);

-- Para asociaciones
CREATE INDEX opcion_menu_categoria_idx 
  ON opcion_menu(categoria_id, orden);
```

### 4.4 Relaciones entre Tablas

- **categoria** → **opcion_menu**: 1:N (una categoría tiene muchas opciones)
- **opcion_menu** → **respuesta**: M:1 (muchas opciones pueden linkear una respuesta)
- **opcion_menu** → **categoria** (destino): 1:1 (navegación entre niveles)
- **respuesta** → **documento**: M:N (respuesta puede tener muchos docs; doc puede usarse en varias)
- **opcion_menu** → **contacto**: M:N (derivación: opción puede tener varios contactos)
- **conocimiento** → **opcion_menu**: M:1 (variantes y preguntas mapean a opciones)

### 4.4 Scripts de Creación

```sql
-- Ejemplo de script de creación
CREATE TABLE usuarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);

```

---

## 5. Configuración e Instalación

### 5.1 Requisitos Previos

- **Sistema Operativo:** Windows 10/11, Linux, macOS
- **Node.js:** Versión 20 o superior (probado hasta v24)
- **npm:** Versión 10 o superior (o yarn como alternativa)
- **Git:** Versión 2.0 o superior
- **Conexión a Internet:** Opcional (modo demo funciona sin conexión)
- **Base de Datos:** Opcional (catálogo semilla en memoria para demo)

### 5.2 Dependencias principales

**Backend:**
```
express@5.x                    - Framework HTTP
pg@8.x                         - Cliente PostgreSQL (local y Neon)
typescript@5.9.3               - Compilador TypeScript
zod@3.24.1                     - Validación de esquemas
googleapis@144.x               - Sincronización Google Drive
```

**Frontend:**
```
react@18.x                     - Biblioteca de UI
vite@5.x                       - Build tool y dev server
typescript@5.9.3               - Compilador TypeScript
```

### 5.3 Configuración Inicial

#### Paso 1: Clonar el repositorio

```bash
git clone <URL-del-repositorio>
cd asistente-virtual-ifts29
```

#### Paso 2: Instalar dependencias (monorepo)

```bash
npm install
# Se instalan automáticamente las dependencias de backend/ y frontend/
```

#### Paso 3: Configurar variables de entorno

```bash
# Copiar plantilla a .env
cp .env.example .env

# Editar .env con las variables necesarias:
# - VITE_API_BASE_URL (opcional, default = mismo origen)
# - DATABASE_URL (opcional, sin esto usa modo semilla)
# - GOOGLE_SERVICE_ACCOUNT_EMAIL (opcional, si no viene = Drive deshabilitado)
# - Otros parámetros según .env.example
```

### 5.4 Pasos para Ejecutar la Aplicación

#### Modo desarrollo (simultáneo):

```bash
# Terminal única: API + Frontend concurrentemente
npm run dev

# O por separado en dos terminales:
# Terminal 1 - Backend (API):
npm run dev:api
# Resultado: http://localhost:3000/api/health

# Terminal 2 - Frontend (SPA):
npm run dev:web
# Resultado: http://localhost:5173
```

#### Modo producción:

```bash
# Compilar TypeScript
npm run build

# Ejecutar API (backend)
npm start
# o
NODE_ENV=production PORT=3000 npm start
```

### 5.5 Acceso a la Aplicación

| Componente | URL | Descripción |
|-----------|-----|-------------|
| Frontend | http://localhost:5173 | SPA React (Vite) |
| API | http://localhost:3000 | Endpoints REST |
| Health Check | http://localhost:3000/api/health | Verificar API activa |
| Menú | http://localhost:3000/api/menu | GET árbol conversacional |
| Chat | http://localhost:3000/api/chat | POST consultas/opciones |

### 5.6 Variables de Entorno Disponibles

Ver `.env.example` para documentación completa. Variables principales:

**Frontend (Vite, build-time):**
```
VITE_API_BASE_URL=               # URL base de API (vacío = mismo origen)
VITE_INSTITUTO_NOMBRE=IFTS N°29
VITE_INSTITUTO_SUBTITULO=En linea
VITE_ALLOWED_ORIGINS=            # CORS origins (separado por coma)
```

**Backend (runtime):**
```
DATABASE_URL=                    # PostgreSQL Neon (vacío = catálogo semilla)
GOOGLE_SERVICE_ACCOUNT_EMAIL=    # Service account (vacío = Drive deshabilitado)
GOOGLE_PRIVATE_KEY=              # Clave privada de Service Account
GOOGLE_SHARED_FOLDER_ID=         # ID carpeta Google Drive institucional
NODE_ENV=production              # development | production
PORT=3000                        # Puerto API
RATE_LIMIT_MAX=120               # Req máximas por ventana
RATE_LIMIT_WINDOW_MS=60000       # Ventana rate limit (ms)
```

**Parámetros del motor NL:**
```
KB_MIN_MENSAJE=2                 # Mínimo caracteres consulta
KB_MAX_MENSAJE=800               # Máximo caracteres consulta
KB_UMBRAL_ALTO=0.90              # Confianza para responder directo
KB_UMBRAL_MEDIO=0.70             # Confianza para pedir aclaración
KB_MARGEN_AMBIGUEDAD=0.05        # Margen para desempate
KB_MAX_OPCIONES_ACLARACION=4     # Máx opciones en aclaración
```

### 5.7 Sin Credenciales: Sistema Completamente Funcional

**Importante:** El sistema funciona SIN variables opcionales:
- Sin `DATABASE_URL` → usa catálogo semilla en memoria (demo perfecto)
- Sin `GOOGLE_SERVICE_ACCOUNT_*` → Drive deshabilitado (respuestas sin documentos)
- Sin credenciales → 100% funcional para desarrollo y demostración

### 5.8 Verificación de la Instalación

```bash
# 1. Verificar API activa
curl http://localhost:3000/api/health

# 2. Obtener menú raíz
curl http://localhost:3000/api/menu

# 3. Enviar consulta escrita
curl -X POST http://localhost:3000/api/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "¿Cómo accedo a SIU Guaraní?"}'
```

---

## 6. Componentes Principales

### 6.1 Backend - Servicios clave

#### ChatService (`backend/src/services/chat.service.ts`)

**Responsabilidades:**
- Procesar turnos de chat (opción del menú vs. consulta escrita)
- Interpretar intención del usuario
- Obtener respuesta institucional validada
- Manejar contexto conversacional
- Generar derivaciones a contactos

**Flujo principal:**
```typescript
// POST /api/chat recibe:
// - opcion: string (clave de opción menú) O
// - message: string (consulta escrita)
//
// Retorna TurnoChat:
// { tipo: 'nodo' | 'respuesta' | 'derivacion' | 'contexto' | 'aclaracion' | 'no_disponible' | 'error' }
```

---

#### NLService (`backend/src/services/nl.service.ts`)

**Responsabilidades:**
- **Normalizar texto:** lleva a minúsculas, elimina acentos, caracteres especiales
- **Búsqueda exacta:** B-tree en `conocimiento.normalized_text`
- **Búsqueda por similitud:** trigram (`pg_trgm`) para variantes
- **Cálculo de confianza:** basado en distancia editorial
- **Desambiguación:** si hay empate, pide aclaración con opciones reales

**Algoritmo:**
```
1. Normalizar consulta del usuario
2. Buscar coincidencia exacta (nivel A)
   Si encontrada con confianza >= KB_UMBRAL_ALTO → responder
3. Buscar similitud trigram (nivel B)
   Si una opción >= KB_UMBRAL_ALTO → responder
   Si una opción >= KB_UMBRAL_MEDIO → pedir aclaración
4. Si ninguna >= KB_UMBRAL_MEDIO → "No disponible"
```

---

#### DriveService (`backend/src/services/drive.service.ts`)

**Responsabilidades:**
- Sincronización de documentos desde Google Drive
- Descarga de archivos institucionales
- Generación de enlaces públicos (si DRIVE_PUBLIC_LINKS=true)
- Caching de enlaces (TTL configurable)
- Manejo de errores de conectividad

**Endpoints afectados:**
- POST `/api/system/sync` - Fuerza sincronización manual
- Automático en startup (si `DATABASE_URL` configurado)

---

#### MetricasService (`backend/src/services/metricas.service.ts`)

**Responsabilidades:**
- Recopilación de estadísticas de uso
- Conteo de consultas por tipo (menú vs. escrita)
- Tracking de intenciones frecuentes
- Análisis de hit rate del motor NL

**Exposición:**
- GET `/api/system/metricas` - Devuelve estadísticas

---

### 6.2 Backend - Rutas (Endpoints)

#### GET `/api/menu`

```
Retorna: NodoMenu {
  categoria: Categoria        // Nodo actual (raíz al inicio)
  mensaje: string            // Mensaje del bot
  opciones: OpcionMenu[]     // Botones disponibles
  esRaiz: boolean            // TRUE solo para raíz
}

Ejemplo respuesta:
{
  "categoria": {
    "id": 1,
    "clave": "RAIZ",
    "nombre": "Inicio",
    "mensaje": "Hola, soy el asistente virtual del IFTS N.29",
    "esRaiz": true
  },
  "opciones": [
    {
      "clave": "ADM_OP_ADMISIONES",
      "etiqueta": "Admisiones",
      "tipo": "navegar",
      "categoria_destino_id": 2
    }
  ]
}
```

---

#### POST `/api/chat`

```
Entrada:
{
  "opcion"?: string      // Clave de opción (si navega por menú)
  "message"?: string     // Consulta escrita (si lenguaje natural)
  "contexto"?: any       // [Opcional] contexto conversacional
}

Salida: TurnoChat (discriminada union):
- { tipo: 'nodo', nodo: NodoMenu }
- { tipo: 'respuesta', respuesta: Respuesta, documentos: [] }
- { tipo: 'derivacion', derivacion: Derivacion, contactos: [] }
- { tipo: 'contexto', pregunta: PreguntaContexto }
- { tipo: 'aclaracion', aclaracion: Aclaracion, opciones: [] }
- { tipo: 'no_disponible', mensaje: string }
- { tipo: 'error', mensaje: string }

Meta (solo para consultas escritas):
{
  "intent": string           // Intención detectada
  "confidence": number       // 0 a 1
  "source": "menu" | "kb_question" | "kb_variant" | ...
  "matchType": "exacto" | "similar" | "regla" | "ninguno"
}
```

---

#### System Routes (`/api/system/*`)

```
GET  /api/health           → { status: 'ok' }
GET  /api/metricas         → Estadísticas de uso
POST /api/system/sync      → Fuerza sincronización Drive (requiere SYNC_SECRET)
```

---

### 6.3 Frontend - Componentes React

#### ChatWidget (componente principal)

**Props/State:**
- `isOpen: boolean` - Widget expandido/colapsado
- `messages: Message[]` - Historial de chat
- `currentNode: NodoMenu` - Categoría actual
- `isLoading: boolean` - Esperando respuesta API

**Responsabilidades:**
- Renderizar conversación completa
- Manejar entrada de usuario (botones + campo de texto)
- Comunicarse con API
- Persistir histórico en sessionStorage

**Estilo:**
- Responsive (mobile first)
- Embebible en iframe (sin conflictos CSS)
- Accesible (ARIA labels, contrast)

---

#### useChat Hook

**Estado:**
```typescript
const [
  messages,       // Historial
  currentNode,    // Nodo del menú
  isLoading,      // Cargando
  handleSend,     // Envía mensaje/opción
  reset           // Vuelve al raíz
] = useChat()
```

**Lógica:**
- Gestiona estado del chat
- Realiza fetch a `/api/menu` y `/api/chat`
- Interpreta TurnoChat y actualiza estado
- Maneja errores de API

---

#### Componentes auxiliares

- **MessageBubble** - Renderiza mensaje (bot o usuario)
- **OptionList** - Lista de opciones interactivas (botones)
- **DocumentCard** - Tarjeta de documento con enlace
- **ContactCard** - Tarjeta de contacto (nombre, email, teléfono)
- **ChatHeader** - Encabezado con nombre institución
- **ChatLauncher** - Botón flotante para abrir/cerrar widget

---

## 7. Gestión de Errores y Validaciones

### 7.1 Middleware de Errores

**Ubicación:** `backend/src/middleware/error.ts`

**Códigos HTTP retornados:**
```
400 Bad Request        - Validación de entrada (mensaje muy corto/largo)
401 Unauthorized       - SYNC_SECRET inválido (POST /api/system/sync)
404 Not Found          - Opción o categoría no existe
429 Too Many Requests  - Rate limit excedido
500 Internal Server    - Error del servidor
```

**Respuesta de error (formato estándar):**
```json
{
  "tipo": "error",
  "mensaje": "Descripción del error",
  "codigo": "ERROR_CODE_INTERNO"
}
```

### 7.2 Validaciones de Entrada

**POST `/api/chat` - Validación de mensaje:**
```typescript
// Validada con Zod (backend/src/utils/env.ts)
- Mínimo: KB_MIN_MENSAJE caracteres (default: 2)
- Máximo: KB_MAX_MENSAJE caracteres (default: 800)
- Si incumple: retorna 400 Bad Request

Ej: "?" (1 char) → rechazado
    "Consulta válida de 20 caracteres" → aceptado
```

**Rate Limiting:**
```
- 120 peticiones por ventana (default: 60 segundos)
- Por IP source
- Si excede: 429 Too Many Requests
- Middleware: `backend/src/middleware/rateLimit.ts`
```

### 7.3 Recuperación ante Errores

**Si BD cae (DATABASE_URL pero Neon no disponible):**
- API responde con error 500
- Nota en logs: "Fallback to seed catalog"
- Si `DATABASE_URL` estaba configurado pero falló:
  - NO cae a modo semilla automáticamente
  - Retorna error al cliente

**Si Google Drive falla:**
- Respuesta devuelta sin documentos
- Campo `documentos: []` en respuesta
- Mensaje al usuario no se ve afectado
- El sistema continúa funcionando

**Si consulta escrita sin coincidencia:**
- No retorna error
- Retorna `{ tipo: 'no_disponible', mensaje: '...' }`
- Sugiere volver a menú guiado

### 7.4 Situaciones por Diseño (no son errores)

- **Sistema anónimo:** No hay autenticación
- **Solo lectura:** No hay creación/edición/borrado de contenido
- **Sin LLM:** Interpretación determinística (misma consulta = misma respuesta)

---

## 8. Pruebas Implementadas

**Framework:** Node.js `test` nativo (sin dependencias externas)  
**Ejecutar:** `cd backend && npm test`

### 8.1 Suite de Tests

| Archivo | Casos | Objetivo |
|---------|-------|----------|
| **api.test.ts** | 8+ | Tests HTTP end-to-end de endpoints |
| **nl.service.test.ts** | 10+ | Tests del motor NL (interpretación, similitud) |
| **conocimiento.test.ts** | 6+ | Tests de búsqueda en KB (exacta, variantes) |
| **normalizar.test.ts** | 5+ | Tests de normalización de texto |
| **sql-coincide.test.ts** | 4+ | Tests de coincidencia con SQL |
| **kb-seed.test.ts** | 3+ | Tests de generación de semilla KB |

**Total aproximado:** 40+ casos de prueba

### 8.2 Pruebas HTTP de Endpoints (api.test.ts)

```typescript
test('el menú raíz sigue funcionando')
  → GET /api/menu retorna categoría RAIZ + opciones

test('una opción del menú se procesa como siempre')
  → POST /api/chat { opcion: 'ADM_OP_SIU' }
  → Retorna respuesta tipo "respuesta"

test('una consulta escrita devuelve la respuesta institucional')
  → POST /api/chat { message: '¿Cómo accedo al SIU Guaraní?' }
  → Retorna respuesta tipo "respuesta" con meta.matchType = "exacto"

test('una consulta ambigua devuelve aclaración con opciones')
  → POST /api/chat { message: '¿Cuándo empiezan las clases?' }
  → Retorna respuesta tipo "aclaracion" con opciones
```

### 8.3 Cómo Ejecutar

```bash
# Ejecutar todos los tests
cd backend
npm test

# Ejecutar un archivo específico
npm test -- --grep "api.test.ts"

# Modo watch (reinicia en cambios)
npm test -- --watch
```

### 8.4 Modo de Ejecución

- Tests corren contra **catálogo semilla** (sin DATABASE_URL)
- Contenido idéntico al que está en `db/002_seed.sql` y `db/005_kb_seed.sql`
- No requieren BD externa, ni Internet, ni Google Drive
- Perfectos para CI/CD y desarrollo local

Para más detalles: Ver documentos [05-pruebas-unitarias.md](05-pruebas-unitarias.md) y [06-pruebas-integracion.md](06-pruebas-integracion.md)

---

## 9. Solución de Problemas

### Problemas Comunes

**Problema:** [Descripción]  
**Causa:** [Razón]  
**Solución:** [Pasos para resolver]

---

## 10. Contacto y Soporte

- **Desarrollador:** [Nombre y contacto]
- **Repositorio:** [URL]
- **Documentación:** [Enlace a wiki o documentación adicional]

