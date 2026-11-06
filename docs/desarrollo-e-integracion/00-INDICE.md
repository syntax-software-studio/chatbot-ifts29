# ETAPA 4: Desarrollo e Integración - Índice

## Documentación de la Etapa Final

Esta carpeta contiene toda la documentación de la cuarta y última etapa del proyecto PP4 Bot IFTS29, que corresponde al desarrollo, integración y pruebas de la aplicación completa.

---

## Contenidos

### 1. [Introducción](01-introduccion.md)
- Descripción general de la etapa
- Objetivos específicos
- Alcance del proyecto

### 2. [Manual Técnico](02-manual-tecnico.md)
- Descripción del sistema
- Arquitectura y tecnologías
- Estructura del proyecto
- Base de datos (DER y tablas)
- Configuración e instalación
- Componentes principales
- Gestión de errores y validaciones

### 3. [Manual Operacional](03-manual-operacional.md)
- **Central:** guía paso a paso para operar el sistema en local y producción
- Cargar y actualizar documentos en la base de conocimiento
- Sincronización, reindexación de fragmentos
- Gestión de la base de datos, métricas, backups y secretos
- Checklist de despliegue

### 4. [Manual de Usuario](04-manual-usuario.md)
- Introducción para usuarios finales
- Requisitos del sistema
- Guía de funcionalidades
- Flujos de uso con capturas
- Mensajes y alertas

### 5. [Base de Datos](05-base-datos.md)
- Diagrama Entidad-Relación (DER)
- Descripción de tablas
- Esquema de datos
- Scripts de creación

### 6. [Pruebas Unitarias](06-pruebas-unitarias.md)
- Metodología de testing
- Casos de prueba implementados
- Evidencias de ejecución
- Resultados obtenidos

### 7. [Pruebas de Integración](07-pruebas-integracion.md)
- Plan de pruebas de integración
- Casos de prueba
- Evidencias y resultados
- Validación de módulos

### 8. [Flujo de Contenido y Documentos](08-flujo-contenido-y-documentos.md)
- Sistema de claves y referencias
- Convención de nombres de documentos
- Esquema visual del flujo completo (Drive → Planilla → Sync → BD)
- Estructura de las pestañas
- Ejemplo completo de agregar un documento
- Validación y checklist

### 9. [Extractos de documentos](09-extractos-de-documentos.md) (implementada, en validación)
- Respuesta con extracto literal del PDF vigente
- Búsqueda de pasajes sobre los documentos de cada intención
- Flujo y requisitos técnicos
- Preguntas abiertas

### 10. [Contenido y decisiones](10-contenido-y-decisiones.md)
- Fuentes de contenido (planilla y Drive)
- Sincronización y convención de nombres
- Flujo de derivación
- Decisiones y pendientes

### 11. [Pendientes post-MVP](11-pendientes-post-mvp.md)
- Despliegue, extractos, contenido, pruebas, base de datos y operación

---

## Estructura de Carpetas

```
desarrollo-e-integracion/
├── 00-INDICE.md
├── 01-introduccion.md
├── 02-manual-tecnico.md
├── 03-manual-operacional.md
├── 04-manual-usuario.md
├── 05-base-datos.md
├── 06-pruebas-unitarias.md
├── 07-pruebas-integracion.md
├── 08-flujo-contenido-y-documentos.md
├── 09-extractos-de-documentos.md
├── 10-contenido-y-decisiones.md
├── 11-pendientes-post-mvp.md
└── screenshots/
    ├── manual-usuario/
    ├── pruebas-unitarias/
    └── pruebas-integracion/
```

---

## Requisitos de Entrega

- [x] Documentación técnica completa
- [x] Manual de usuario
- [x] Base de datos funcional (CRUD implementado)
- [x] Pruebas unitarias documentadas
- [x] Pruebas de integración documentadas
- [x] Evidencias de ejecución
- [x] Instrucciones de instalación y despliegue
