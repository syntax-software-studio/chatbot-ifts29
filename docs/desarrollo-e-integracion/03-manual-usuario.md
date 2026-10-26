# 3. Manual de Usuario

## 👤 Guía para Usuarios Finales

Este manual explica de forma clara y sencilla cómo utilizar la aplicación PP4 Bot IFTS29, qué funciones ofrece y cómo navegar por ella.

---

## 1. Introducción

### 1.1 ¿Qué es el Asistente Virtual IFTS N.°29?

El Asistente Virtual es un **chatbot inteligente** integrado en el campus virtual (Moodle) del IFTS N.°29. Está diseñado para responder preguntas administrativas y académicas de forma rápida y sencilla.

**Características principales:**
- Responde mediante un **menú guiado** paso a paso
- También entiende **preguntas escritas** en lenguaje natural
- Devuelve **respuestas oficiales validadas** por la institución
- Puede derivar tu consulta a contactos administrativos cuando sea necesario
- **100% anónimo** (no almacena datos personales)

### 1.2 ¿Para quién es?

Esta aplicación está dirigida a:
- **Estudiantes** del IFTS N.°29
- **Docentes** que necesitan aclarar procesos administrativos
- **Público en general** interesado en información institucional

### 1.3 ¿Qué puedo hacer con el Asistente?

Con el Asistente Virtual puedes:
- Obtener información sobre **admisiones y trámites**
- Consultar sobre **planes de estudio y materias**
- Conocer **políticas y reglamentos** institucionales
- Acceder a **documentos** (reglamentos, syllabus, formularios)
- Solicitar **derivación** a áreas específicas
- Navegar mediante un **menú amigable** o escribir preguntas libres

---

## 2. Requisitos Mínimos

### 2.1 Sistema Operativo y Navegador

- **Windows:** 10 o superior
- **macOS:** 10.13 o superior
- **Linux:** Cualquier distribución moderna
- **Navegador:** Chrome, Firefox, Safari o Edge (versión reciente)
- **JavaScript:** Debe estar habilitado

### 2.2 Conexión

- **Conexión a Internet:** No requerida (funciona offline en modo local)
- **Para producción:** Recomendado tener conexión

### 2.3 Equipamiento

- **Memoria RAM:** No hay requisito mínimo (funciona en navegadores)
- **Espacio:** Solo el que ocupe el navegador
- **Pantalla:** Cualquier resolución (interface responsive)

---

## 3. Acceso y Uso

### 3.1 Acceder al Asistente Virtual

**Opción 1: Desde el Campus Virtual (Moodle)**

El Asistente está integrado directamente en el campus:
1. Ingresa a https://aulasvirtuales.bue.edu.ar con tu usuario
2. Verás un **botón flotante** en la esquina inferior derecha
3. Haz clic para abrir el Asistente

**Opción 2: Acceso Directo**

Puedes acceder directamente desde el navegador, sin pasar por el campus:
1. Visita: https://chatbot-ifts29-jade.vercel.app/
2. Se abre automáticamente en tu navegador
3. Funciona exactamente igual que en Moodle

### 3.2 Primera Vez

1. Al abrir el Asistente, verás un **saludo de bienvenida**
2. Se mostrarán las **opciones principales** como botones
3. Puedes:
   - Hacer clic en un botón para explorar menús
   - Escribir una pregunta en el campo de texto
4. El Asistente responderá en tiempo real

### 3.3 Cierre del Asistente

- Haz clic en el **ícono X** (esquina superior derecha)
- El botón flotante permanece en Moodle para volver a abrir
- Para cerrar la conversación, cierra la ventana o pestaña del navegador

---

## 4. Pantalla Principal

### 4.1 Layout del Widget

El Asistente se abre en un panel lateral (380 x 520 píxeles aproximadamente):

```
┌──────────────────────────────┐
│  IFTS N°29          [X]      │  ← Encabezado con botón cerrar
├──────────────────────────────┤
│                              │
│  Histórico de mensajes       │
│  (burbujas del bot y tuyas)  │
│  ↓ auto-scroll               │
│                              │
├──────────────────────────────┤
│  [Opción 1]  [Opción 2]      │  ← Botones de opciones
│  [Opción 3]  [Opción 4]      │    (cambian según la pantalla)
├──────────────────────────────┤
│ Escribe tu pregunta...   [→] │  ← Campo de texto + botón enviar
└──────────────────────────────┘
```

### 4.2 Componentes de la Interfaz

| Componente | Descripción |
|-----------|-------------|
| **Encabezado** | Muestra "IFTS N°29" y botón [X] para cerrar |
| **Área de mensajes** | Histórico de conversación (auto-scroll) |
| **Burbujas** | Texto del bot (izquierda, fondo color) / tuyo (derecha, blanco) |
| **Botones de opción** | Alternativas ofrecidas por el bot (toca para continuar) |
| **Campo de texto** | Escribe preguntas en lenguaje natural |
| **Botón enviar** | Flecha (→) para enviar tu pregunta |
| **Botón reiniciar** | Icono (↻) para volver al inicio |

### 4.3 Interacción Básica

**Dos formas de usar el Asistente:**

1. **Menú guiado (más fácil):**
   - Toca un botón de opción
   - Se muestra el siguiente nivel o la respuesta
   - Continúa tocando botones

2. **Pregunta escrita (más rápido):**
   - Escribe tu pregunta en el campo
   - Toca la flecha (→) o presiona Enter
   - El Asistente interpreta tu pregunta y responde

---

## 5. Flujos de Uso Principales

### 5.1 Flujo 1: Consulta por Menú Guiado

**Objetivo:** Navegar por categorías hasta encontrar la respuesta

**Pasos:**

1. Abre el Asistente (botón flotante en Moodle)
2. Se muestra el **menú principal** con opciones como:
   - "Admisiones"
   - "Planes de estudio"
   - "Trámites administrativos"
3. Toca una opción (ej: "Admisiones")
4. Se abre un **subnivel** con opciones más específicas (ej: "Requisitos", "Fecha de inicio")
5. Sigue tocando hasta llegar a la **respuesta final**
6. Recibirás el **texto institucional** validado
7. Si hay **documentos** (PDF, reglamentos), aparecerán como tarjetas con enlace

**Resultado esperado:**
- Información clara y oficial
- Posibilidad de descargar documentos relacionados
- Botón "< Volver" para regresar

---

### 5.2 Flujo 2: Consulta Escrita (Lenguaje Natural)

**Objetivo:** Obtener respuesta escribiendo tu pregunta

**Pasos:**

1. Abre el Asistente
2. En el **campo de texto** inferior, escribe tu pregunta (ej: "¿Cómo accedo a SIU Guaraní?")
3. Toca la **flecha (→)** o presiona **Enter**
4. El Asistente interpreta tu pregunta (1-2 segundos)
5. **Resultado:**
   - Si la pregunta es **clara**: devuelve la respuesta directamente
   - Si es **ambigua**: muestra 3-4 opciones para que elijas la correcta
   - Si **no hay información**: te informa que no está disponible

**Resultado esperado:**
- Respuesta rápida sin navegar menús
- Documentos relacionados si existen
- Opción de reformular si no es lo que buscabas

---

### 5.3 Flujo 3: Derivación a un área

**Objetivo:** Hablar con el área que puede resolver tu consulta.

**Pasos:**

1. En el menú principal, elige **"No encontré lo que busco"**.
2. Elige el motivo de tu consulta: **Orientación cursada**, **Trámites, certificados, etc.** o **Entrega de documentación**.
3. Si elegiste *Orientación cursada*, elige tu **comisión** (A o B).
4. Se muestra el contacto del área: nombre, área, motivo y email.
5. Escribe a esa persona o área con tu consulta.

**Resultado esperado:**
- Contacto con el área competente.

---

## 6. Capturas de Pantalla

### 6.1 Pantalla Principal

![Pantalla Principal](screenshots/manual-usuario/01-pantalla-principal.png)

*Descripción: Vista general de la pantalla de inicio con el menú principal y opciones disponibles.*

---

### 6.2 Pantalla de [Funcionalidad]

![Pantalla de Funcionalidad](screenshots/manual-usuario/02-funcionalidad.png)

*Descripción: Pantalla donde se realiza la operación de [X].*

---

### 6.3 Pantalla de [Otra Funcionalidad]

![Pantalla de Otra Funcionalidad](screenshots/manual-usuario/03-otra-funcionalidad.png)

*Descripción: Pantalla de confirmación o resultado.*

---

## 7. Mensajes y Alertas Frecuentes

### 7.1 Mensajes de Éxito

| Mensaje | Significado | Acción |
|---------|-------------|--------|
| "Operación realizada exitosamente" | La acción se completó sin problemas | Puedes continuar |
| "Datos guardados" | Los datos fueron almacenados correctamente | Continuará automáticamente |

### 7.2 Mensajes de Error

| Mensaje | Significado | Solución |
|---------|-------------|----------|
| "Campo obligatorio vacío" | Falta completar un campo requerido | Completa todos los campos marcados con * |
| "Email inválido" | El formato del email no es correcto | Revisa e ingresa un email válido (ejemplo@dominio.com) |
| "Registro duplicado" | Ya existe un registro con esos datos | Cambia los datos e intenta nuevamente |
| "Error de conexión" | No se puede conectar a la base de datos | Verifica tu conexión a Internet |

### 7.3 Mensajes de Advertencia

| Mensaje | Significado | Acción |
|---------|------------|--------|
| "¿Confirmar eliminación?" | Se solicita confirmación antes de borrar | Haz clic en "Sí" para confirmar o "No" para cancelar |
| "Esta acción no se puede deshacer" | Advertencia sobre una acción irreversible | Procede con cuidado |

---

## 8. Preguntas Frecuentes (FAQ)

### P: ¿El Asistente entiende todas mis preguntas?

**R:** No perfectamente. Si escribes preguntas simples y claras, el Asistente las entiende muy bien. Si tu pregunta es ambigua, te pedirá que aclares eligiendo entre opciones. El Asistente está entrenado con las preguntas más comunes del IFTS.

---

### P: ¿Puedo usar el Asistente sin conectarme a Internet?

**R:** Necesitas conexión a Internet, tanto en el acceso directo (https://chatbot-ifts29-jade.vercel.app/) como en Moodle. El Asistente usa muy poco ancho de banda.

---

### P: ¿Mis preguntas se guardan en algún lugar?

**R:** **No.** El Asistente es completamente anónimo. No almacena nombres, emails, ni historial de preguntas. Cada conversación es privada y temporal.

---

### P: ¿Qué hago si el Asistente no responde mi pregunta?

**R:** 
1. Intenta reformularla de otra forma
2. Usa el menú guiado en lugar de escribir
3. Si nada funciona, contacta directamente al área correspondiente (el Asistente puede darte datos de contacto)

---

### P: ¿El Asistente me puede ayudar con un problema urgente?

**R:** El Asistente solo devuelve información. Si tu consulta es urgente, elige "No encontré lo que busco" en el menú para ver el contacto del área y comunícate por email.

---

## 9. Solución de Problemas

### Problema: El Asistente no aparece en Moodle

**Causa posible:** Navegador antiguo, JavaScript deshabilitado o problema de conexión  
**Solución:**
1. Actualiza tu navegador a la versión más reciente
2. Verifica que JavaScript esté habilitado (Configuración → Privacidad y seguridad)
3. Recarga la página (Ctrl+F5 o Cmd+Shift+R)
4. Si sigue sin aparecer, intenta con otro navegador (Chrome, Firefox, Edge)

---

### Problema: El widget se abre pero está vacío o lento

**Causa posible:** Conexión lenta o servidor ocupado  
**Solución:**
1. Espera 5 segundos a que cargue completamente
2. Recarga la página
3. Si está muy lento, intenta acceder desde el acceso directo: https://chatbot-ifts29-jade.vercel.app/
4. Verifica tu velocidad de conexión

---

### Problema: El Asistente no responde a mi pregunta escrita

**Causa posible:** Pregunta poco clara, tema no en la BD, o pregunta incompleta  
**Solución:**
1. Reformula tu pregunta con palabras más específicas
2. Intenta preguntas más cortas (ej: "Admisiones" en lugar de "Quiero saber todo sobre cómo entrar")
3. Usa el menú guiado para explorar manualmente
4. Si el tema no existe, contacta al departamento correspondiente

---

### Problema: Los documentos no descargan

**Causa posible:** Problema con Google Drive o conexión lenta  
**Solución:**
1. Verifica tu conexión a Internet
2. Intenta descargar después de 1-2 minutos
3. Si sigue sin funcionar, contacta a: [email de soporte]

---

## 10. Consejos para Aprovechar el Asistente

- **Sé específico:** Cuanto más clara sea tu pregunta, mejor respuesta obtendrás
- **Intenta ambas formas:** Experimenta con menú guiado y preguntas escritas
- **Lee documentos completos:** Si descarga un PDF, léelo completamente antes de hacer otras preguntas
- **Guarda contactos útiles:** Anota los emails que el Asistente te muestra
- **Explora el menú:** Familiarízate con la estructura para futuras consultas
- **No es urgente:** Para asuntos urgentes, llama directamente al área correspondiente

---

## 11. Contacto y Soporte

**Para problemas con el Asistente:**

- **Email:** [A definir con el IFTS N.°29]
- **Teléfono:** [A definir]
- **Horario:** [A definir]

**Para preguntas académicas/administrativas:**

- Usa la opción "No encontré lo que busco" dentro del Asistente para llegar al área correcta
- O accede directamente a: https://www.ifts29.edu.ar (sitio oficial)
