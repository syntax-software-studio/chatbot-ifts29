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
- Guía paso a paso para operar el sistema en local y producción
- Cargar y actualizar documentos en la base de conocimiento
- Sincronización, reindexación de fragmentos
- Gestión de la base de datos, métricas, backups y secretos
- Checklist de despliegue

### 4. [Manual de Usuario](04-manual-usuario.md)
- Introducción para usuarios finales
- Requisitos del sistema
- Guía de funcionalidades
- Flujos de uso con capturas

### 5. [Base de Datos](05-base-datos.md)
- Diagrama Entidad-Relación (DER)
- Descripción de tablas
- Esquema de datos

### 6. [Pruebas](06-pruebas.md)
- Pruebas unitarias (80) y de integración (16): 96 en total
- Casos cubiertos por archivo
- Evidencia de ejecución (GIF)
- Evaluación del texto libre

### 7. [Flujo de Contenido y Documentos](07-flujo-contenido-y-documentos.md)
- Sistema de claves y referencias
- Convención de nombres de documentos
- Esquema visual del flujo completo (Drive → Planilla → Sync → BD)
- Estructura de las pestañas
- Ejemplo completo de agregar un documento
- Validación y checklist

### 8. [Extractos de Documentos](08-extractos-de-documentos.md)
- Respuesta con extracto literal del PDF vigente
- Búsqueda de pasajes sobre los documentos de cada intención
- Flujo y requisitos técnicos

### 9. [Contenido y Decisiones](09-contenido-y-decisiones.md)
- Fuentes de contenido (planilla y Drive)
- Sincronización y convención de nombres
- Flujo de derivación
- Decisiones de diseño

### 10. [Pendientes Post-MVP](10-pendientes-post-mvp.md)
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
├── 06-pruebas.md
├── 07-flujo-contenido-y-documentos.md
├── 08-extractos-de-documentos.md
├── 09-contenido-y-decisiones.md
├── 10-pendientes-post-mvp.md
└── screenshots/
    ├── 00-pruebas.gif
    ├── 01-pantalla-principal.png
    ├── 02-navegacion-menu.png
    ├── 03-respuesta-documento.png
    ├── 04-consulta-directa.png
    ├── 05-aclaracion.png
    └── 06-derivacion.png
```

---

## Requisitos de Entrega

- [x] Documentación técnica completa
- [x] Manual de usuario con capturas
- [x] Base de datos funcional
- [x] Pruebas unitarias y de integración documentadas
- [x] Evidencias de ejecución
- [x] Instrucciones de instalación y despliegue
