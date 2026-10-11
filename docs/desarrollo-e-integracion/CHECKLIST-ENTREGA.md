# Checklist de Entrega - Etapa 4

## Documentación

### Documentos Principales
- [x] **01-introduccion.md** - Estructura base creada
- [ ] **02-manual-tecnico.md** - En progreso (arquitectura y BD iniciado)
- [ ] **03-manual-usuario.md** - Estructura base creada, sin capturas aún
- [ ] **04-base-datos.md** - Estructura base creada, sin scripts reales aún
- [ ] **05-pruebas-unitarias.md** - Estructura base creada, sin ejecución aún
- [ ] **06-pruebas-integracion.md** - Estructura base creada, sin ejecución aún

### Screenshots
- [ ] **manual-usuario/** - Mínimo 5-8 capturas de pantallas principales
- [ ] **pruebas-unitarias/** - Evidencias de ejecución y cobertura
- [ ] **pruebas-integracion/** - Evidencias de flujos y CRUD

---

## Base de Datos

### Implementación
- [x] Base de datos PostgreSQL (Neon) creada y funcional
- [x] Todas las tablas creadas correctamente (categoria, opcion_menu, respuesta, documento, contacto, conocimiento)
- [x] Relaciones y claves foráneas establecidas
- [x] Índices creados (B-tree y GIN trigram para búsqueda)

### CRUD
- [x] **Create (Crear)** - Funciona desde API (/api/chat con opciones del menú)
- [x] **Read (Leer)** - GET /api/menu y búsquedas en conocimiento funcionan
- [ ] **Update (Actualizar)** - Sistema es de solo lectura (por diseño)
- [ ] **Delete (Eliminar)** - Sistema es de solo lectura (por diseño)

### Scripts
- [x] Script de creación de tablas (`db/001_schema.sql`)
- [x] Script de datos iniciales (`db/002_seed.sql`)
- [x] Script de base de conocimiento (`db/005_kb_seed.sql`)
- [x] Catálogo semilla en memoria para modo demo (sin BD)

---

## Pruebas

### Pruebas Implementadas
- [x] **6 test files** implementados en `backend/test/`:
  - `api.test.ts` - Tests HTTP de endpoints (menú, chat, opciones)
  - `nl.service.test.ts` - Tests del motor NL (interpretación)
  - `conocimiento.test.ts` - Tests de búsqueda en KB
  - `normalizar.test.ts` - Tests de normalización de texto
  - `sql-coincide.test.ts` - Tests de coincidencia SQL
  - `kb-seed.test.ts` - Tests de generación de semilla

### Pruebas Unitarias
- [x] Mínimo 6+ pruebas unitarias implementadas
- [x] Tests ejecutan contra catálogo semilla (sin BD requerida)
- [ ] Resultados de ejecución documentados en 05-pruebas-unitarias.md
- [ ] Evidencias de ejecución (ejecutar `npm test` en backend)

### Pruebas de Integración
- [x] Tests de endpoints HTTP (api.test.ts): menú raíz, opciones, consultas escritas
- [x] Tests de flujo completo: opción menú → respuesta institucional
- [x] Tests de consultas ambiguas con aclaraciones
- [ ] Documentación de resultados en 06-pruebas-integracion.md
- [ ] Evidencias de ejecución capturadas

### Cómo Ejecutar Tests
```bash
cd backend
npm test
```

---

## Aplicación Funcional

### Funcionalidades Principales
- [x] **Frontend:** React + Vite - ChatWidget embebible en Moodle
- [x] **Backend:** Express + TypeScript - API REST con /api/menu y /api/chat
- [x] **Menú conversacional:** Árbol de categorías y opciones funcional
- [x] **Lenguaje natural:** Motor de interpretación (exacto, similitud trigram, variantes)
- [x] **Documentos:** Sincronización con Google Drive integrada
- [x] **Derivaciones:** Contactos para derivación asincrónica

### Modos de Operación
- [x] **Modo demo:** Catálogo semilla en memoria (sin BD)
- [x] **Modo producción:** PostgreSQL Neon (con DATABASE_URL)
- [x] **Ambos modos funcionan con el mismo contenido**

### Validaciones
- [x] Validación de entrada (longitud mínima/máxima de consultas)
- [x] Rate limiting por IP (120 req/min)
- [x] CORS configurado para Moodle
- [x] Manejo de errores con códigos HTTP apropiadosBasado

### Características de Seguridad
- [x] Sistema de solo lectura (anónimo, privacidad preservada)
- [x] Sin almacenamiento de datos personales
- [x] Google Drive: acceso de solo lectura (RO)
- [x] Rate limiting implementado
- [x] CORS y headers de seguridad configurados

---

## Configuración e Instalación

### Requisitos
- [x] Node.js 20+ (probado hasta v24)
- [x] npm 10+ (o yarn)
- [x] Git 2.0+
- [x] No requiere Docker ni BD para modo demo

### Pasos de Instalación Implementados
```bash
# 1. Clonar repositorio
git clone <url>
cd asistente-virtual-ifts29

# 2. Instalar dependencias (monorepo)
npm install

# 3. Copiar configuración
cp .env.example .env

# 4. Ejecutar en modo desarrollo
npm run dev          # API + Frontend simultáneamente
# o por separado:
npm run dev:api      # Terminal 1: API en :3000
npm run dev:web      # Terminal 2: Frontend en :5173
```

### Variables de Entorno
- [x] `.env.example` completamente documentado
- [x] Variables para frontend (Vite): VITE_API_BASE_URL, VITE_INSTITUTO_*
- [x] Variables para backend: DATABASE_URL, GOOGLE_SERVICE_ACCOUNT_*, RATE_LIMIT_*
- [x] Variables para chat: KB_UMBRAL_ALTO, KB_UMBRAL_MEDIO, KB_MAX_MENSAJE

### Sin Credenciales Requeridas
- [x] Sistema funciona sin DATABASE_URL (modo semilla local)
- [x] Google Drive opcional (GOOGLE_SERVICE_ACCOUNT_EMAIL vacío = deshabilitado)
- [x] Perfecto para demostración y desarrollo sin infraestructura

---

## Entregables Finales

### Repositorio Git
- [x] Repositorio Git actualizado (branch: main)
- [x] `.gitignore` configurado (excluye node_modules, .env, etc.)
- [x] `package-lock.json` y `yarn.lock` en control de versiones
- [ ] Últimos commits documentados con descripción clara

### Empaquetado
- [ ] Proyecto comprimido (`.zip`)
- [ ] Incluye: backend/, frontend/, db/, docs/, package.json
- [ ] Excluye: node_modules/, .env, .git/, capturas de pruebas

### Documentación
- [ ] README.md completo (ya existe en raíz)
- [ ] Manual Técnico completo (02-manual-tecnico.md)
- [ ] Manual de Usuario con capturas (03-manual-usuario.md)
- [ ] Documentación de BD (04-base-datos.md)
- [ ] Evidencias de pruebas (05 y 06)
- [ ] PDF integrado con toda la documentación

### Aplicación Funcional
- [x] Frontend ejecutable: `npm run dev:web` → http://localhost:5173
- [x] Backend ejecutable: `npm run dev:api` → http://localhost:3000
- [x] O deployment en Vercel (producción)
- [x] Funciona en ambos modos: demo (semilla) y producción (Neon)

---

## Validación Final

### Presentación Profesional
- [ ] Documentación clara y bien organizada
- [ ] Sin errores ortográficos ni gramaticales
- [ ] Lenguaje técnico apropiad para cada sección
- [ ] Coherencia visual en diagramas y capturas

### Completitud
- [ ] Todas las secciones solicitadas incluidas
- [ ] Documentación coherente con trabajo anterior (Etapas 1-3)
- [ ] Referencias entre documentos funcionales

### Funcionalidad
- [ ] Aplicación ejecuta sin errores críticos
- [ ] CRUD completamente funcional
- [ ] Pruebas documentadas y pasadas
- [ ] Base de datos persiste datos correctamente

---

## Verificación Final Antes de Entregar

```
DOCUMENTACIÓN:
☑ 01-introduccion.md              (estructura base)
~ 02-manual-tecnico.md            (en actualización con datos reales)
☐ 03-manual-usuario.md            (estructura base, sin capturas)
☐ 04-base-datos.md                (estructura base)
☐ 05-pruebas-unitarias.md         (estructura base, ejecutar tests)
☐ 06-pruebas-integracion.md       (estructura base, ejecutar tests)
☑ CHECKLIST-ENTREGA.md            (este archivo, actualizado)

CARPETAS SCREENSHOTS:
☐ screenshots/manual-usuario/     (5-8 imágenes de la UI)
☐ screenshots/pruebas-unitarias/  (output de `npm test`)
☐ screenshots/pruebas-integracion/(resultados de test api.test.ts)

BASE DE DATOS:
☑ Scripts SQL en /db/
  ☑ db/001_schema.sql             (DDL completo)
  ☑ db/002_seed.sql               (datos menú)
  ☑ db/005_kb_seed.sql            (base conocimiento)
☑ Catálogo semilla en memoria funcionando

PRUEBAS:
☑ Pruebas unitarias/integración: 6 archivos .test.ts en backend/test/
☐ Ejecutar: cd backend && npm test
☐ Documentar resultados en 05 y 06

APLICACIÓN:
☑ Frontend (React + Vite): `npm run dev:web` → :5173
☑ Backend (Express + TS): `npm run dev:api` → :3000
☑ Código en repositorio Git (main branch)
☐ Proyecto .zip comprimido para entrega

ENTREGA:
☐ PDF con documentación integrada
☑ Repositorio actualizado en Git
☐ Proyecto comprimido (.zip)
☐ Listo para presentar ante docentes
```

---

## Criterios de Evaluación

La entrega será evaluada en base a:

| Criterio | Excelente | Bueno | Aceptable | Insuficiente |
|----------|-----------|-------|-----------|--------------|
| **Documentación** | Completa, clara y coherente | Completa, sin errores | Presenta la mayoría | Incompleta |
| **Funcionalidad** | Todas las características, sin errores | Características principales funcionan | Funciona con errores menores | No funciona |
| **Pruebas** | 3+ unitarias y 2+ integración, 100% pasadas | 2+ unitarias y 1+ integración, 90%+ pasadas | 1+ pruebas, 80%+ pasadas | Sin pruebas |
| **BD y CRUD** | CRUD completo, bien documentado | CRUD completo, funcionando | CRUD parcial | Sin BD |
| **Presentación** | Profesional, visual, coherente | Buena presentación | Presentable | Deficiente |

---

## Consejos Finales

1. **Revisa la documentación de etapas anteriores** - Asegúrate de mantener coherencia
2. **Prueba todo antes de entregar** - Ejecuta la aplicación, pruebas, y verifica la BD
3. **Captura pantallas claras** - Que muestren el funcionamiento real
4. **Documenta con claridad** - Para que un evaluador pueda comprender y ejecutar
5. **Sé específico** - Incluye versiones, configuraciones, pasos exactos
6. **Presenta evidencias** - No solo afirmes, demuestra con capturas y logs

---

## Últimas Verificaciones

Antes de hacer clic en enviar:

- [ ] ¿Puedo clonar el proyecto y ejecutarlo siguiendo las instrucciones?
- [ ] ¿Todas las pruebas pasan correctamente?
- [ ] ¿La BD se crea y funciona sin problemas?
- [ ] ¿Las capturas son claras y pertinentes?
- [ ] ¿La documentación está completa y sin faltas?
- [ ] ¿El PDF abre correctamente y tiene estructura?

