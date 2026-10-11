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

### 2.1 Tabla: `usuarios`

**Descripción:** Almacena información de los usuarios del sistema

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id_usuario` | INT | PRIMARY KEY, AUTO_INCREMENT | Identificador único del usuario |
| `nombre` | VARCHAR(100) | NOT NULL | Nombre completo del usuario |
| `email` | VARCHAR(100) | NOT NULL, UNIQUE | Correo electrónico único |
| `contraseña` | VARCHAR(255) | NOT NULL | Contraseña encriptada |
| `rol` | VARCHAR(20) | DEFAULT 'usuario' | Rol: admin, usuario, moderador |
| `estado` | ENUM('activo','inactivo') | DEFAULT 'activo' | Estado del usuario |
| `fecha_registro` | DATETIME | DEFAULT CURRENT_TIMESTAMP | Fecha de creación de cuenta |
| `fecha_ultima_conexion` | DATETIME | NULL | Última conexión del usuario |

**Índices:**
```sql
CREATE INDEX idx_email ON usuarios(email);
CREATE INDEX idx_estado ON usuarios(estado);
```

---

### 2.2 Tabla: `[nombre_tabla_2]`

**Descripción:** [Descripción de la tabla]

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id_[tabla]` | INT | PRIMARY KEY, AUTO_INCREMENT | Identificador único |
| `campo1` | VARCHAR(100) | NOT NULL | [Descripción] |
| `campo2` | DATETIME | DEFAULT CURRENT_TIMESTAMP | [Descripción] |
| `id_usuario` | INT | FOREIGN KEY | Referencia a tabla usuarios |

---

### 2.3 Tabla: `[nombre_tabla_3]`

**Descripción:** [Descripción de la tabla]

| Campo | Tipo | Restricciones | Descripción |
|-------|------|---------------|-------------|
| `id_[tabla]` | INT | PRIMARY KEY, AUTO_INCREMENT | Identificador único |
| [Agregar campos específicos] | | | |

---

## 3. Relaciones entre Tablas

### 3.1 Relación: Usuarios → [Tabla relacionada]

- **Tabla padre:** `usuarios`
- **Tabla hijo:** `[tabla_relacionada]`
- **Campo de referencia:** `id_usuario`
- **Tipo de relación:** 1:N (Un usuario a muchos registros)
- **ON DELETE:** CASCADE / RESTRICT / SET NULL
- **ON UPDATE:** CASCADE

---

### 3.2 Relación: [Tabla A] → [Tabla B]

- **Tabla padre:** `[tabla_a]`
- **Tabla hijo:** `[tabla_b]`
- **Campo de referencia:** `id_[tabla]`
- **Tipo de relación:** [Especificar]
- **ON DELETE:** [Especificar]
- **ON UPDATE:** [Especificar]

---

## 4. Scripts de Creación

### 4.1 Script Completo de Creación

```sql
-- ============================================
-- Script de Creación de Base de Datos
-- Proyecto: PP4 Bot IFTS29
-- Fecha: [Fecha]
-- ============================================

-- Crear base de datos
CREATE DATABASE IF NOT EXISTS pp4_bot_ifts29;
USE pp4_bot_ifts29;

-- ============================================
-- Tabla: usuarios
-- ============================================
CREATE TABLE usuarios (
    id_usuario INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    contraseña VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'usuario',
    estado ENUM('activo', 'inactivo') DEFAULT 'activo',
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_ultima_conexion DATETIME NULL
);

-- Índices para usuarios
CREATE INDEX idx_email ON usuarios(email);
CREATE INDEX idx_estado ON usuarios(estado);

-- ============================================
-- Tabla: [nombre_tabla_2]
-- ============================================
CREATE TABLE [nombre_tabla_2] (
    id_[tabla] INT PRIMARY KEY AUTO_INCREMENT,
    campo1 VARCHAR(100) NOT NULL,
    campo2 DATETIME DEFAULT CURRENT_TIMESTAMP,
    id_usuario INT NOT NULL,
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario) ON DELETE CASCADE
);

-- Índices
CREATE INDEX idx_[tabla]_usuario ON [nombre_tabla_2](id_usuario);

-- ============================================
-- Tabla: [nombre_tabla_3]
-- ============================================
CREATE TABLE [nombre_tabla_3] (
    id_[tabla] INT PRIMARY KEY AUTO_INCREMENT,
    -- Campos específicos
    id_[referencia] INT,
    FOREIGN KEY (id_[referencia]) REFERENCES [tabla_referenciada](id)
);

-- ============================================
-- Agregar más tablas según sea necesario
-- ============================================

```

### 4.2 Scripts de Inserción de Datos Iniciales

```sql
-- ============================================
-- Datos iniciales para pruebas
-- ============================================

-- Usuarios de prueba
INSERT INTO usuarios (nombre, email, contraseña, rol, estado) VALUES
('Admin User', 'admin@example.com', 'hashed_password_123', 'admin', 'activo'),
('Usuario Prueba 1', 'usuario1@example.com', 'hashed_password_456', 'usuario', 'activo'),
('Usuario Prueba 2', 'usuario2@example.com', 'hashed_password_789', 'usuario', 'activo');

-- Otros datos iniciales
-- [Agregar INSERT según las otras tablas]

```

### 4.3 Scripts de Configuración Adicional

```sql
-- Configurar colación por defecto
ALTER DATABASE pp4_bot_ifts29 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- [Agregar otras configuraciones necesarias]

```

---

## 5. Operaciones CRUD

### 5.1 Create (Crear)

**Insertar un nuevo usuario:**

```sql
INSERT INTO usuarios (nombre, email, contraseña, rol, estado)
VALUES ('Juan Pérez', 'juan@example.com', 'hashed_pwd', 'usuario', 'activo');
```

### 5.2 Read (Leer)

**Obtener todos los usuarios:**

```sql
SELECT * FROM usuarios;
```

**Obtener un usuario específico:**

```sql
SELECT * FROM usuarios WHERE id_usuario = 1;
```

**Obtener usuarios por criterio:**

```sql
SELECT * FROM usuarios WHERE estado = 'activo' ORDER BY fecha_registro DESC;
```

### 5.3 Update (Actualizar)

**Actualizar datos de un usuario:**

```sql
UPDATE usuarios 
SET nombre = 'Juan Pérez Actualizado', 
    email = 'juan.nuevo@example.com'
WHERE id_usuario = 1;
```

### 5.4 Delete (Eliminar)

**Eliminar un usuario:**

```sql
DELETE FROM usuarios WHERE id_usuario = 1;
```

⚠️ **Advertencia:** Esta operación eliminará el registro y potencialmente registros relacionados según la configuración ON DELETE.

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
