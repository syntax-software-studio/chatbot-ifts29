# 4. Base de Datos

## 🗄️ Documentación de Persistencia de Datos

Esta sección describe la estructura de la base de datos, sus tablas, relaciones y los scripts de creación necesarios para poner en funcionamiento el sistema de persistencia de datos.

---

## 1. Diagrama Entidad-Relación (DER)

### 1.1 DER Completo

![Diagrama Entidad-Relación](../analisis-y-modelado-del-diseño/screenshots/08\ -\ Diagrama\ Entidad-Relación\ \(DER\).png)

*Imagen referencia: El DER fue creado en la Etapa 1 de análisis y modelado.*

### 1.2 Descripción de Relaciones

Las relaciones del sistema son:

- **[Entidad A] → [Entidad B]:** Relación [tipo: 1:N, N:N, etc.]
- **[Entidad C] → [Entidad D]:** Relación [tipo]

---

## 2. Tablas y Campos

### 2.1 Tabla: `categoria` - Nodos del árbol conversacional

**Descripción:** Estructura jerárquica del menú (categorías y subcategorías)

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL, UNIQUE | Identificador único (ej: "RAIZ", "ADM") |
| `nombre` | TEXT | NOT NULL | Nombre visible en interfaz |
| `mensaje` | TEXT | NULL | Mensaje del bot al entrar a categoría |
| `orden` | INTEGER | NOT NULL, DEFAULT 0 | Orden de presentación |
| `es_raiz` | BOOLEAN | NOT NULL, DEFAULT FALSE | TRUE solo para categoría inicial |
| `activo` | BOOLEAN | NOT NULL, DEFAULT TRUE | Visibilidad |
| `creado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |

---

### 2.2 Tabla: `opcion_menu` - Opciones seleccionables (botones)

**Descripción:** Botones que el usuario puede tocar en cada categoría

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL, UNIQUE | Identificador (ej: "ADM_OP_ADMISIONES") |
| `categoria_id` | INTEGER | NOT NULL, FK → categoria | Categoría padre |
| `etiqueta` | TEXT | NOT NULL | Texto del botón |
| `descripcion` | TEXT | NULL | Descripción (tooltip) |
| `tipo` | TEXT | CHECK IN ('navegar', 'responder', 'derivar') | navegar: subcategoría / responder: respuesta / derivar: contactos |
| `categoria_destino_id` | INTEGER | FK → categoria | Para tipo='navegar' |
| `respuesta_id` | INTEGER | FK → respuesta | Para tipo='responder' |
| `es_volver` | BOOLEAN | DEFAULT FALSE | TRUE para "< Volver" |
| `icono` | TEXT | NULL | Código de icono SVG |
| `orden` | INTEGER | DEFAULT 0 | Orden en menú |
| `activo` | BOOLEAN | DEFAULT TRUE | Visibilidad |
| `creado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |

---

### 2.3 Tabla: `respuesta` - Contenido institucional

**Descripción:** Texto validado que devuelve el sistema (única fuente de contenido)

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL, UNIQUE | Identificador único |
| `texto` | TEXT | NOT NULL | Contenido (puede incluir markdown) |
| `orden` | INTEGER | NOT NULL, DEFAULT 0 | Orden |
| `activo` | BOOLEAN | NOT NULL, DEFAULT TRUE | Visibilidad |
| `creado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |

---

### 2.4 Tabla: `documento` - Archivos desde Google Drive

**Descripción:** Metadatos de documentos sincronizados desde Drive (solo lectura)

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL, UNIQUE | Identificador |
| `nombre` | TEXT | NOT NULL | Nombre del archivo |
| `descripcion` | TEXT | NULL | Descripción breve |
| `tipo` | TEXT | CHECK IN (...) | Categoría: 'programa', 'cronograma', 'instructivo', 'planilla', etc. |
| `drive_file_id` | TEXT | UNIQUE | ID en Google Drive |
| `drive_nombre_archivo` | TEXT | NULL | Nombre original en Drive |
| `mime_type` | TEXT | NOT NULL | MIME type (application/pdf, etc.) |
| `drive_url` | TEXT | NULL | URL de acceso |
| `drive_view_url` | TEXT | NULL | URL pública |
| `drive_md5` | TEXT | NULL | Hash para detectar cambios |
| `vigente` | BOOLEAN | NOT NULL, DEFAULT TRUE | ¿Aún válido? |
| `estado` | TEXT | CHECK IN (...) | Ciclo: 'borrador' → 'revision' → 'vigente' → 'reemplazado'/'archivado' |
| `vigencia_desde` | DATE | NULL | Fecha inicio validez |
| `vigencia_hasta` | DATE | NULL | Fecha fin validez |
| `creado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |
| `sincronizado_en` | TIMESTAMPTZ | NULL | Última sincronización |

**Índices:**
```sql
CREATE INDEX documento_vigente_idx ON documento(vigente, estado);
CREATE INDEX documento_tipo_idx ON documento(tipo);
```

---

### 2.5 Tabla: `respuesta_documento` - Relación M:N

**Descripción:** Documentos adjuntos a cada respuesta

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `respuesta_id` | INTEGER | PK + FK → respuesta (CASCADE) |
| `documento_id` | INTEGER | PK + FK → documento (CASCADE) |
| `orden` | INTEGER | DEFAULT 0 |

---

### 2.6 Tabla: `contacto` - Derivación asincrónica

**Descripción:** Personas/áreas a las que derivar consultas

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL, UNIQUE | Identificador |
| `nombre` | TEXT | NOT NULL | Nombre del contacto |
| `rol` | TEXT | NULL | Cargo (ej: "Secretario de Admisiones") |
| `area` | TEXT | NULL | Departamento |
| `email` | TEXT | NULL | Email de contacto |
| `telefono` | TEXT | NULL | Teléfono |
| `url_perfil` | TEXT | NULL | Enlace a perfil |
| `motivo` | TEXT | NULL | Por qué contactar (mostrado al usuario) |
| `horario` | TEXT | NULL | Horario de atención |
| `orden` | INTEGER | DEFAULT 0 | Orden |
| `activo` | BOOLEAN | DEFAULT TRUE | Visibilidad |
| `creado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |

---

### 2.7 Tabla: `opcion_contacto` - Relación M:N

**Descripción:** Contactos asociados a cada opción

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `opcion_id` | INTEGER | PK + FK → opcion_menu (CASCADE) |
| `contacto_id` | INTEGER | PK + FK → contacto (CASCADE) |
| `orden` | INTEGER | DEFAULT 0 |

---

### 2.8 Tabla: `contexto` - Datos contextuales

**Descripción:** Valores que varían por materia, comisión, cuatrimestre, etc.

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id` | SERIAL | PRIMARY KEY | ID único |
| `clave` | TEXT | NOT NULL | Identificador (ej: "dias_cursada") |
| `nombre` | TEXT | NOT NULL | Nombre visible |
| `valor` | TEXT | NULL | Valor (ej: "Lunes y Miércoles 18:00-21:00") |
| `ambito_tipo` | TEXT | CHECK IN (...) | Alcance: global / materia / comision / cuatrimestre / area |
| `ambito_clave` | TEXT | NULL | Clave del ámbito |
| `grupo` | TEXT | NULL | Agrupamiento |
| `orden` | INTEGER | DEFAULT 0 | Orden |
| `activo` | BOOLEAN | DEFAULT TRUE | Visibilidad |
| `actualizado_en` | TIMESTAMPTZ | DEFAULT now() | Auditoría |

---

### 2.9 Tabla: `opcion_contexto` - Relación M:N

**Descripción:** Contextos que aplican a cada opción

| Campo | Tipo | Restricciones |
|-------|------|---------------|
| `opcion_id` | INTEGER | PK + FK → opcion_menu (CASCADE) |
| `contexto_id` | INTEGER | PK + FK → contexto (CASCADE) |

---

### 2.10 Tabla: `conocimiento` - Base de conocimiento (Knowledge Base)

**Descripción:** Preguntas, variantes y texto normalizado para búsqueda por similitud

Tabla derivada/generada automáticamente. Contiene:
- Preguntas base (de `respuesta.texto` normalizado)
- Variantes (preguntas alternativas que mapean a respuestas)
- `normalized_text`: sin acentos, minúsculas, para búsqueda exacta y trigram

---

## 3. Relaciones entre Tablas

### 3.1 Jerarquía del menú

```
categoria (raíz)
  ├── opcion_menu (tipo='navegar')
  │   └── categoria (destino)
  │       └── opcion_menu
  │           └── categoria
  │
  ├── opcion_menu (tipo='responder')
  │   └── respuesta
  │       └── respuesta_documento
  │           └── documento
  │
  └── opcion_menu (tipo='derivar')
      └── opcion_contacto
          └── contacto
```

### 3.2 Relación específica: categoria ↔ opcion_menu

- **Tipo:** 1:N (una categoría tiene muchas opciones)
- **Campos:** `categoria.id` ← `opcion_menu.categoria_id`
- **ON DELETE:** CASCADE (si borra categoría, borra opciones)
- **Índices:** `opcion_menu(categoria_id, orden)`

### 3.3 Relación: opcion_menu ↔ respuesta

- **Tipo:** M:1 (muchas opciones pueden linkear una respuesta)
- **Campos:** `respuesta.id` ← `opcion_menu.respuesta_id`
- **ON DELETE:** SET NULL (si borra respuesta, la opción queda sin respuesta)
- **Restricción:** Solo si `tipo='responder'`

### 3.4 Relación: respuesta ↔ documento

- **Tipo:** M:N (muchos documentos por respuesta)
- **Tabla junction:** `respuesta_documento`
- **ON DELETE:** CASCADE (si borra respuesta o documento, se limpia la relación)
- **Índices:** `respuesta_documento(respuesta_id, documento_id)`

### 3.5 Relación: opcion_menu ↔ contacto

- **Tipo:** M:N (una opción puede derivar a varios contactos)
- **Tabla junction:** `opcion_contacto`
- **ON DELETE:** CASCADE
- **Restricción:** Solo si `tipo='derivar'`

### 3.6 Relación: opcion_menu ↔ contexto

- **Tipo:** M:N (una opción puede tener múltiples contextos)
- **Tabla junction:** `opcion_contexto`
- **ON DELETE:** CASCADE
- **Uso:** Para submenús que dependen de comisión, cuatrimestre, etc.

---

## 4. Scripts de Creación

### 4.1 Scripts en el Repositorio

Los scripts SQL están en `/db/`:

| Archivo | Propósito |
|---------|-----------|
| **001_schema.sql** | DDL: creación de tablas, índices, constraints, triggers, vistas |
| **002_seed.sql** | DML: datos iniciales del menú (idempotente) |
| **003_verificacion.sql** | Scripts de verificación (para testing) |
| **005_kb_seed.sql** | Base de conocimiento: preguntas, variantes, intenciones |

### 4.2 Cómo Ejecutar Scripts en Neon

**Opción 1: Desde CLI SQL (pgAdmin o psql):**

```bash
# Conectar a Neon
psql "postgresql://usuario:password@ep-xxxx-pooler.region.neon.tech/ifts29?sslmode=require"

# Ejecutar scripts
\i db/001_schema.sql
\i db/002_seed.sql
\i db/005_kb_seed.sql
```

**Opción 2: Desde Node.js (usando @neondatabase/serverless):**

```bash
cd backend
npm run db:push     # Ejecuta 001_schema.sql + 002_seed.sql
npm run db:kb       # Regenera 005_kb_seed.sql desde datos
```

### 4.3 Extensiones PostgreSQL Requeridas

```sql
-- Requeridas por 001_schema.sql:
CREATE EXTENSION IF NOT EXISTS pgcrypto;    -- Para UUIDs y encriptación
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- Para búsqueda por similitud (trigram)
```

### 4.4 Catálogo Semilla (Alternativa a BD)

Si no hay `DATABASE_URL`:
- Backend usa catálogo en memoria (`backend/src/seed/catalogo.ts`)
- Contenido idéntico a `db/002_seed.sql` + `db/005_kb_seed.sql`
- Perfecto para desarrollo y demostración sin infraestructura

**Ubicación:**
```
backend/src/seed/
├── catalogo.ts       # Menú, respuestas, documentos, contactos
└── conocimiento.ts   # Base de intenciones (preguntas)
```

---

## 5. Operaciones CRUD

**IMPORTANTE:** El sistema es **de solo lectura** desde la perspectiva del usuario final. No hay creación, actualización o eliminación de datos por parte de los usuarios.

### 5.1 Read (Leer) - Única operación soportada

**Obtener menú raíz:**

```sql
SELECT * FROM categoria WHERE es_raiz = TRUE;
```

**Obtener opciones de una categoría:**

```sql
SELECT * FROM opcion_menu 
WHERE categoria_id = 1 AND activo = TRUE
ORDER BY orden;
```

**Obtener respuesta para una opción:**

```sql
SELECT r.* FROM respuesta r
INNER JOIN opcion_menu om ON r.id = om.respuesta_id
WHERE om.clave = 'ADM_OP_ADMISIONES' AND r.activo = TRUE;
```

**Obtener documentos de una respuesta:**

```sql
SELECT d.* FROM documento d
INNER JOIN respuesta_documento rd ON d.id = rd.documento_id
WHERE rd.respuesta_id = 1 AND d.vigente = TRUE AND d.estado = 'vigente'
ORDER BY rd.orden;
```

**Buscar en base de conocimiento (similitud trigram):**

```sql
SELECT * FROM conocimiento
WHERE normalized_text % 'acceso siu'    -- % es operador trigram
ORDER BY similarity(normalized_text, 'acceso siu') DESC
LIMIT 5;
```

### 5.2 Create / Update / Delete - NO DISPONIBLES

Estas operaciones **no existen** en el API público:

- ❌ POST /api/categorias (no existe)
- ❌ PUT /api/respuesta/123 (no existe)  
- ❌ DELETE /api/contacto/5 (no existe)

**Razón:** El sistema es anónimo y de solo lectura por diseño (RF05, RNF05)

### 5.3 Administración de Datos (interno)

La institución administra datos a través de:
- **Google Drive:** Sincronización de documentos
- **BD PostgreSQL:** Scripts SQL directos o herramientas admin (pgAdmin)
- **No hay UI de administración:** Se asume que personal técnico gestiona la BD

**Cómo actualizar contenido:**
1. Modificar datos en PostgreSQL (Neon dashboard)
2. O modificar semilla en `backend/src/seed/` y regenerar
3. Reiniciar API para aplicar cambios

---

## 6. Validaciones y Restricciones

### 6.1 Validaciones a Nivel de Base de Datos

| Campo | Validación | Descripción |
|-------|-----------|-------------|
| `email` | UNIQUE | No puede haber emails duplicados |
| `nombre` | NOT NULL | El nombre es obligatorio |
| `contraseña` | NOT NULL | La contraseña es obligatoria |
| `estado` | ENUM | Solo valores específicos permitidos |

### 6.2 Validaciones a Nivel de Aplicación

- **Email válido:** Verificar formato de correo electrónico
- **Contraseña:** Mínimo 8 caracteres, incluir números y caracteres especiales
- **Registros duplicados:** Verificar antes de insertar
- **Campos requeridos:** Validar antes de guardar

---

## 7. Copia de Seguridad y Recuperación

### 7.1 Crear Respaldo (Backup)

```bash
# En MySQL
mysqldump -u root -p pp4_bot_ifts29 > backup_pp4_$(date +%Y%m%d).sql
```

### 7.2 Restaurar desde Respaldo

```bash
# En MySQL
mysql -u root -p pp4_bot_ifts29 < backup_pp4_YYYYMMDD.sql
```

---

## 8. Consideraciones de Seguridad

- **Contraseñas:** Siempre almacenar encriptadas (bcrypt, scrypt o similar)
- **SQL Injection:** Usar prepared statements en consultas parametrizadas
- **Integridad referencial:** Mantener ON DELETE/UPDATE configuradas correctamente
- **Auditoría:** Registrar cambios importantes en tablas críticas
- **Acceso:** Limitar permisos de base de datos según roles

---

## 9. Optimización

### 9.1 Índices Creados

| Tabla | Campo | Razón |
|-------|-------|-------|
| usuarios | email | Búsquedas frecuentes por email |
| usuarios | estado | Filtrados frecuentes por estado |
| [tabla] | [campo] | [Razón] |

### 9.2 Consultas Optimizadas

Usar índices en:
- Búsquedas por email o ID de usuario
- Filtros por estado o rol
- Ordenamientos frecuentes

---

## 10. Herramientas de Gestión

### 10.1 Software Recomendado

- **MySQL Workbench:** Para visualizar y administrar la BD
- **DBeaver:** Administrador universal de bases de datos
- **PhpMyAdmin:** Interfaz web (si aplica)
- **HeidiSQL:** Cliente ligero para MySQL

### 10.2 Conexiones de Prueba

```
Host: localhost
Puerto: 3306
Usuario: [usuario_bd]
Contraseña: [contraseña]
Base de datos: pp4_bot_ifts29
```

---

## 11. Soporte y Mantenimiento

Para consultas sobre la base de datos:
- Revisar los scripts en `/database/scripts/`
- Consultar el Manual Técnico (02-manual-tecnico.md)
- Contactar con los desarrolladores
