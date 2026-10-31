# 1. Introducción - Etapa 4: Desarrollo e Integración

## Descripción general

Esta es la cuarta y última etapa del proyecto **Asistente Virtual IFTS N.°29**. Integra los componentes del sistema en una aplicación funcional, coherente con las etapas anteriores.

## Objetivo

- **Desarrollar e integrar** una aplicación SPA (React) y una API REST (Express), conectadas a PostgreSQL.
- **Garantizar la coherencia** con los diagramas y prototipos de las etapas previas.
- **Gestionar el contenido** desde herramientas que usa el equipo institucional: una planilla de Google para menú y respuestas, y una carpeta de Drive para los documentos.
- **Verificar el sistema** con pruebas automatizadas, sin dependencias externas.
- **Documentar** el sistema para su uso, mantenimiento y despliegue.

## Alcance

### Componentes

1. **Frontend (React + Vite).** Widget embebible en el campus virtual mediante `iframe`. Muestra el menú guiado, el texto libre, las respuestas con sus documentos y las tarjetas de contacto.
2. **Backend (Express + TypeScript).** API REST con el menú, el motor de texto libre, la sincronización de contenido y las métricas anónimas. Ver [02-manual-tecnico.md](02-manual-tecnico.md).
3. **Base de datos (PostgreSQL).** Neon en producción y Docker en desarrollo. Ver [04-base-datos.md](04-base-datos.md).
4. **Contenido.** Planilla de Google y carpeta de Drive, sincronizadas con la base. Ver [07-contenido-y-decisiones.md](07-contenido-y-decisiones.md).

### Características principales

- **Menú guiado:** categorías y opciones. Las preguntas y sub-preguntas son pantallas de botones.
- **Texto libre:** consultas escritas que se ubican en la base de conocimiento, con aclaración cuando hay ambigüedad.
- **Derivación:** por motivo y, cuando corresponde, por comisión, con el contacto asociado.
- **Documentos:** enlazados a Google Drive, con su vigencia.
- **Sin modelos de lenguaje:** las respuestas son siempre texto validado institucionalmente.

## Tecnologías

| Componente | Tecnología |
|---|---|
| Frontend | React, Vite, TypeScript |
| Backend | Express 5, TypeScript |
| Base de datos | PostgreSQL 16 (Neon en producción, Docker en desarrollo) |
| Integraciones | Google Sheets y Drive (cuenta de servicio, solo lectura) |
| Tests | `node:test` con `tsx` |
| Despliegue | Vercel (serverless) para la API, con base en Neon |

## Entregables de esta etapa

1. Aplicación funcional (frontend y backend).
2. Manual técnico.
3. Manual de usuario, con capturas.
4. Documentación de base de datos y de contenido.
5. Documentación de pruebas unitarias e integración, con evidencias.
6. Repositorio Git actualizado.

## Estado actual

- Menú guiado, texto libre y derivación funcionando contra la base local de Docker.
- Contenido cargado desde la planilla y los documentos sincronizados con Drive.
- Tests del backend pasando.

## Fechas clave

- **Inicio de etapa:** 27 de octubre de 2026
- **Fecha de entrega:** 19 de noviembre de 2026
