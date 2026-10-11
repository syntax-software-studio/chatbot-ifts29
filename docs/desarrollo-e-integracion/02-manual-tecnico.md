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
│  ChatWidget | ChatLauncher | MessageBubble | Cards │
│  (embebible en Moodle mediante iframe)              │
└────────────────────┬────────────────────────────────┘
                     │ HTTP/JSON
┌────────────────────▼────────────────────────────────┐
│     BACKEND (Express + TypeScript, Vercel)          │
├──────────────────────────────────────────────────────┤
│  Routes:        Services:           Middleware:      │
│  • /api/menu    • chat.service      • CORS          │
│  • /api/chat    • nl.service        • Rate Limit    │
│  • /api/system  • drive.service     • Error Handler │
│                 • metricas.service                   │
└────────────────────┬────────────────────────────────┘
                     │ (SQL vía @neondatabase/serverless)
┌────────────────────▼────────────────────────────────┐
│     DATABASE (PostgreSQL - Neon)                    │
├──────────────────────────────────────────────────────┤
│ Tablas:                                              │
│ • categoria (nodos del árbol conversacional)         │
│ • opcion_menu (opciones seleccionables)             │
│ • respuesta (contenido institucional validado)       │
│ • documento (archivos de Google Drive)               │
│ • contacto (para derivaciones asincrónicas)          │
│ • conocimiento (base de intenciones/variantes)       │
└──────────────────────────────────────────────────────┘
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

**Sistema:** PostgreSQL en Neon (serverless, HTTP pooler)  
**Modo demo:** Catálogo semilla en memoria (Node.js, idéntico a BD)  
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

-- Agregar más scripts según corresponda
```

---

## 5. Configuración e Instalación

### 5.1 Requisitos Previos

- **Sistema Operativo:** Windows 10/11, Linux, macOS
- **Java/Runtime:** [Versión requerida]
- **Base de Datos:** [Sistema requerido y versión]
- **Conexión a Internet:** [Sí/No, para qué]

### 5.2 Tecnologías Utilizadas

| Componente | Versión |
|-----------|---------|
| [Software 1] | [Versión] |
| [Software 2] | [Versión] |
| [Dependencias] | [Versión] |

### 5.3 Dependencias Necesarias

```
[Listar todas las dependencias del proyecto]
- Dependencia 1: [versión]
- Dependencia 2: [versión]
```

### 5.4 Configuración Inicial

1. **Clonar el repositorio**
   ```bash
   git clone [URL del repositorio]
   cd bot-ifts29
   ```

2. **Instalar dependencias**
   ```bash
   [Comando específico para el proyecto]
   ```

3. **Configurar variables de entorno**
   ```
   [Crear archivo .env con las siguientes variables]
   DATABASE_URL=[URL de conexión]
   API_KEY=[Si aplica]
   ```

### 5.5 Pasos para Importar/Abrir el Proyecto

1. Abrir IDE [especificar: VS Code, IntelliJ IDEA, Android Studio, etc.]
2. File → Open → Seleccionar carpeta del proyecto
3. Esperar a que se resuelvan las dependencias
4. [Pasos adicionales específicos de la tecnología]

### 5.6 Pasos para Ejecutar la Aplicación

```bash
# Opción 1: Desde línea de comandos
[Comando de ejecución]

# Opción 2: Desde IDE
[Instrucciones específicas]
```

**Acceso:** La aplicación estará disponible en `[URL/puerto]`

### 5.7 Pasos para Crear/Restaurar la Base de Datos

1. **Crear base de datos**
   ```bash
   [Comando específico]
   ```

2. **Ejecutar scripts SQL**
   ```bash
   [Comando para importar scripts]
   ```

3. **Verificar creación**
   ```bash
   [Comando para verificar tablas]
   ```

### 5.8 Credenciales de Prueba

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin | 123456 | Administrador |
| user1 | password | Usuario normal |
| [Usuario 3] | [Contraseña] | [Rol] |

---

## 6. Componentes Principales

### 6.1 Descripción Técnica de Módulos Clave

#### Módulo: [Nombre del módulo]

**Responsabilidades:**
- [Responsabilidad 1]
- [Responsabilidad 2]

**Métodos principales:**
```java
// Ejemplo de método
public void metodo(String parametro) {
    // Descripción de implementación
}
```

**Interacciones:**
- Se comunica con: [Otros módulos]
- Es utilizado por: [Qué componentes lo usan]

*(Repetir para cada módulo principal)*

---

## 7. Gestión de Errores y Validaciones

### 7.1 Manejo de Errores de Conexión

- **Error de base de datos:** [Cómo se maneja]
- **Error de conexión a Internet:** [Cómo se maneja]
- **Timeout:** [Cómo se maneja]

### 7.2 Validaciones de Datos

- **Campo vacío:** Se valida antes de procesar
- **Formato inválido:** Se valida contra patrones específicos
- **Duplicados:** Se verifica en [dónde]

### 7.3 Situaciones Excepcionales

- **Usuario no autenticado:** [Comportamiento]
- **Recurso no encontrado:** [Comportamiento]
- **Permisos insuficientes:** [Comportamiento]

---

## 8. Pruebas Implementadas

### 8.1 Pruebas Unitarias

**Resumen:**
- Total de pruebas: [Número]
- Casos cubiertos: [Descripción general]

Para más detalles: Ver documento [05-pruebas-unitarias.md](05-pruebas-unitarias.md)

### 8.2 Pruebas de Integración

**Resumen:**
- Total de pruebas: [Número]
- Módulos validados: [Lista]

Para más detalles: Ver documento [06-pruebas-integracion.md](06-pruebas-integracion.md)

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

