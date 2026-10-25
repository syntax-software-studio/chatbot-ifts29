# Checklist de Entrega - Etapa 4

**Estado:** actualizado con la implementación vigente. Lo que sigue sin hacer se marca con `[ ]`.

---

## 1. Documentación

- [x] `01-introduccion.md` - alcance, tecnologías y estado actual
- [x] `02-manual-tecnico.md` - arquitectura, estructura del código, API, configuración, desarrollo local
- [x] `03-manual-usuario.md` - recorridos del menú, texto libre y derivación por pantallas
- [x] `04-base-datos.md` - tablas, relaciones (DER en Mermaid), carga, reset y configuración
- [x] `05-pruebas-unitarias.md` - 34 pruebas, todas pasando
- [x] `06-pruebas-integracion.md` - 24 pruebas contra la base de prueba, todas pasando
- [x] `07-contenido-y-decisiones.md` - fuentes de contenido, planilla, convención de nombres, decisiones y pendientes
- [ ] PDF integrado con toda la documentación
- [ ] Capturas del manual de usuario (5 a 8 imágenes de la interfaz actual)

---

## 2. Base de datos

- [x] Esquema completo en `db/001_schema.sql`, sin sentencias `ALTER`
- [x] Índices: B-tree sobre el texto normalizado y GIN trigram para la similitud
- [x] Carga de contenido desde la planilla de Google, con validación previa (si hay errores, no se escribe nada)
- [x] Reset del esquema preservando las métricas (`metrica_opcion`)
- [x] Contenedor local con PostgreSQL (`docker compose up`)
- [ ] Migración del esquema y del contenido a Neon (producción), con revisión

---

## 3. Pruebas

- [x] **58 pruebas** en 7 archivos de `backend/test/`: 34 unitarias y 24 de integración
- [x] Las pruebas de integración usan una base de prueba (`ifts29_test`) y fixtures propios; no llaman a Google ni a Neon
- [x] Ejecución: `npm test --workspace backend` (corre de a un archivo, porque comparten la base de prueba)
- [x] Evidencias documentadas en `05` y `06`
- [ ] Conjunto dorado de consultas para medir el texto libre y calibrar los umbrales
- [ ] Capturas de la salida de los tests

---

## 4. Aplicación

- [x] Widget (React + Vite): menú, texto libre, respuestas con documentos, derivación por pantallas
- [x] API (Express + TypeScript): menú, chat, sincronización, métricas, health
- [x] Derivación por motivo y comisión, con el contacto asociado a cada opción
- [x] Documentos enlazados a Google Drive, con sincronización de enlaces e IDs
- [x] Validación de entrada, límite de peticiones por IP y CORS para el embebido
- [x] Sin datos personales: las métricas son agregados anónimos
- [x] Retiro del catálogo semilla y del modo demo: sin base de datos, la API responde 503

---

## 5. Contenido y Google

- [x] Planilla "Bot IFTS29 - Contenido" con las pestañas del esquema
- [x] Convención de nombres de documentos, aplicada en Drive (ver `07`)
- [x] Cuenta de servicio con acceso de solo lectura a la planilla y a la carpeta
- [ ] Revisar el texto de las respuestas y de la derivación con el equipo institucional
- [ ] `EAM_condiciones`: el documento no existe en Drive; el bot no le muestra enlace hasta que se suba
- [ ] Submenú por comisión para los documentos de materia (ver `07`, pendientes)
- [ ] Informe de métricas exportado a Drive (requiere permisos de escritura, hoy no están)

---

## 6. Configuración e instalación

- [x] `.env.example` documentado, con `GOOGLE_SHEET_ID` incluido
- [x] Instalación con `npm install` desde la raíz (monorepo con workspaces)
- [x] Desarrollo local: base con `docker compose up`, carga con `npm run sync --workspace backend`, API y widget con `npm run dev:api` y `npm run dev:web`

---

## 7. Repositorio y entrega

- [x] Repositorio Git con la rama de trabajo `feat/base-fuente-unica`
- [x] `.gitignore`: excluye `node_modules`, `.env`, la carpeta de ejemplo de Drive y los CSV temporales de carga
- [ ] Commits de los cambios del último tramo, con descripción clara
- [ ] Proyecto comprimido (`.zip`), sin `node_modules`, `.env` ni `.git`

---

## 8. Verificación antes de entregar

- [ ] Clonar el repositorio y seguir los pasos de `02-manual-tecnico.md` sin ayuda
- [ ] `npm test --workspace backend` pasa en una máquina limpia
- [ ] La base local se crea y se carga desde cero
- [ ] Las capturas son claras y muestran el flujo actual
- [ ] Documentación revisada por ortografía y coherencia con las etapas anteriores
