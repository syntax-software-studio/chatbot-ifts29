# 1. Introducción - Etapa 4: Desarrollo e Integración

## Descripción General

Esta es la cuarta y última etapa del proyecto **Asistente Virtual IFTS N.°29**. En esta etapa se integran todos los componentes del sistema en una aplicación completamente funcional que cumple con los requerimientos establecidos en las etapas anteriores.

## Objetivo

El objetivo principal de esta etapa es:

- **Desarrollar e integrar** una aplicación SPA (React) + API REST (Express) funcional y coherente
- **Garantizar coherencia** con los diagramas, prototipos y documentación de las etapas previas
- **Implementar la persistencia de datos** mediante PostgreSQL (Neon) con catálogo semilla local
- **Realizar pruebas exhaustivas** mediante tests de integración (Node.js test, sin dependencias externas)
- **Documentar completamente** el sistema para facilitar su uso, mantenimiento y despliegue

## Alcance

### Componentes Implementados

1. **Frontend (React + Vite)**
   - Widget embebible en Moodle mediante iframe
   - Componentes: ChatWidget, ChatLauncher, MessageBubble, OptionList, DocumentCard, ContactCard
   - Estados gestionados con hook useChat
   - Estilos responsive y accesibles

2. **Backend (Express + TypeScript)**
   - Endpoints: GET /api/menu, POST /api/chat, GET /api/system/*
   - Motor NL (lenguaje natural controlado): exacto, variantes, similitud trigram
   - Servicios: chat, nl (interpretación), drive (sincronización), metricas
   - Middleware: CORS, rate limiting, manejo de errores
   - Dos modos: semilla (demo) y PostgreSQL (producción)

3. **Persistencia de Datos**
   - PostgreSQL: Neon en producción y Postgres local con Docker en desarrollo
   - 6 tablas: categoria, opcion_menu, respuesta, documento, contacto, conocimiento
   - Índices B-tree y GIN trigram para búsqueda
   - Catálogo semilla en memoria (idéntico a BD)

4. **Gestión de Errores**
   - Validación de entrada (longitud, formato)
   - Rate limiting (120 req/min por IP)
   - Manejo de excepciones con códigos HTTP
   - Mensajes claros al cliente

## Tecnologías Utilizadas

| Componente | Tecnología | Versión |
|-----------|-----------|---------|
| Frontend | React | 18+ |
| Build | Vite | 5.x |
| Backend | Express | 5.x |
| Lenguaje | TypeScript | 5.9.3+ |
| Base de datos | PostgreSQL (Neon) | 15+ |
| Runtime | Node.js | 20+ |
| Testing | node:test (nativo) | - |
| Deployment | Vercel | serverless |
| Control de versiones | Git | 2.0+ |

## Entregables de Esta Etapa

1. Aplicación completamente funcional (frontend + backend)
2. Manual Técnico detallado
3. Manual de Usuario con capturas
4. Scripts SQL de creación y seed
5. Pruebas documentadas (6 test files, 40+ casos)
6. Evidencias de ejecución
7. Repositorio Git actualizado
8. Proyecto comprimido (.zip)
9. Documentación compilada en PDF

## Estado Actual

- Desarrollo completado
- Aplicación ejecutándose en modo demo (sin BD) y producción (Neon)
- Tests implementados y pasando
- Faltaría: capturas, documentación final, evidencias

## Fechas Clave

- **Inicio de etapa:** 27 de octubre de 2026
- **Fecha de entrega:** 19 de noviembre de 2026
- **Duración:** 3 semanas
