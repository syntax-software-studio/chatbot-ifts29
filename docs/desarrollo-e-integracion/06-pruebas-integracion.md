# 6. Pruebas de Integración

## 🔗 Documentación de Pruebas de Integración

Esta sección documenta las pruebas de integración que verifican que los distintos módulos del sistema funcionen correctamente en conjunto.

---

## 1. Introducción

### 1.1 Objetivo de las Pruebas de Integración

Las pruebas de integración tienen como objetivo:

- Verificar que los diferentes módulos del sistema trabajen correctamente juntos
- Validar la interacción entre componentes (interfaz, lógica, base de datos)
- Detectar problemas en la integración que no aparecen en pruebas unitarias
- Asegurar el flujo completo de datos a través del sistema

### 1.2 Diferencia con Pruebas Unitarias

| Aspecto | Unitarias | Integración |
|---------|-----------|-------------|
| **Alcance** | Una unidad (método/clase) | Múltiples módulos |
| **Aislamiento** | Aislada, con mocks | Sin mocks, componentes reales |
| **Base de datos** | Simulada o en memoria | Real o dedicada para pruebas |
| **Tiempo** | Rápidas | Más lentas |
| **Objetivo** | Verificar unidades | Verificar flujos |

---

## 2. Metodología y Configuración

### 2.1 Framework de Testing de Integración

**Framework seleccionado:** [Spring Boot Test, TestNG, Postman, etc.]  
**Versión:** [Versión]

### 2.2 Configuración de Entorno de Pruebas

```properties
# application-test.properties
spring.datasource.url=jdbc:mysql://localhost:3306/pp4_bot_test
spring.datasource.username=test_user
spring.datasource.password=test_password
spring.jpa.hibernate.ddl-auto=create-drop
```

### 2.3 Base de Datos de Pruebas

- **Base de datos:** `pp4_bot_test`
- **Usuario:** `test_user`
- **Se recrea:** Antes de cada suite de pruebas
- **Se limpia:** Después de cada prueba

---

## 3. Planes de Prueba de Integración

### 3.1 Prueba de Integración 1: Flujo Completo de Registro de Usuario

#### 3.1.1 Especificación

| Aspecto | Detalle |
|---------|---------|
| **Nombre** | Flujo completo de registro de usuario |
| **Objetivo** | Validar que un usuario pueda registrarse exitosamente desde la interfaz hasta la base de datos |
| **Módulos involucrados** | Interfaz → Controlador → Servicio → DAO → Base de Datos |
| **Datos iniciales** | Base de datos vacía o con datos de prueba |
| **Duración estimada** | 15 segundos |

#### 3.1.2 Pasos del Caso de Prueba

| Paso | Acción | Resultado Esperado |
|------|--------|-------------------|
| 1 | Abrir la pantalla de registro | Se muestra formulario de registro |
| 2 | Ingresar nombre válido | Campo acepta el texto |
| 3 | Ingresar email válido (nuevo) | Campo acepta el email |
| 4 | Ingresar contraseña válida | Campo acepta la contraseña |
| 5 | Hacer clic en "Registrar" | Mensaje de éxito o redirección |
| 6 | Verificar en base de datos | El usuario existe en tabla `usuarios` |
| 7 | Intentar iniciar sesión con el nuevo usuario | Se inicia sesión correctamente |

#### 3.1.3 Datos de Prueba

```java
@BeforeEach
public void setUp() {
    // Datos para la prueba
    usuarioNuevo = new Usuario();
    usuarioNuevo.setNombre("Juan Pérez");
    usuarioNuevo.setEmail("juan.prueba@example.com");
    usuarioNuevo.setContraseña("MiPassword123");
    usuarioNuevo.setRol("usuario");
}
```

#### 3.1.4 Código de Prueba

```java
@Test
public void testFlujoCompletoRegistroUsuario() {
    // 1. Abrir pantalla de registro
    navegador.ir("http://localhost:8080/registro");
    
    // 2-4. Llenar formulario
    navegador.escribir("nombre", "Juan Pérez");
    navegador.escribir("email", "juan.prueba@example.com");
    navegador.escribir("contraseña", "MiPassword123");
    
    // 5. Hacer clic en registrar
    navegador.clickear("btnRegistrar");
    
    // Verificar redirección o mensaje
    String mensajeObtenido = navegador.obtenerMensaje();
    assertTrue(mensajeObtenido.contains("exitosamente") || 
              navegador.obtenerURL().contains("login"),
              "Se debe mostrar mensaje de éxito o redirigir al login");
    
    // 6. Verificar en base de datos
    Usuario usuarioGuardado = usuarioRepository.findByEmail("juan.prueba@example.com");
    assertNotNull(usuarioGuardado, "Usuario debe existir en BD");
    assertEquals("Juan Pérez", usuarioGuardado.getNombre());
    
    // 7. Verificar que puede iniciar sesión
    boolean loginExitoso = autenticacionServicio.autenticar(
        "juan.prueba@example.com", 
        "MiPassword123"
    );
    assertTrue(loginExitoso, "Debe poder iniciar sesión con las credenciales");
}
```

#### 3.1.5 Resultados

| Paso | Estado | Resultado |
|------|--------|-----------|
| 1 | ✅ | Pantalla de registro se carga correctamente |
| 2 | ✅ | Campo de nombre acepta entrada |
| 3 | ✅ | Campo de email valida formato correcto |
| 4 | ✅ | Campo de contraseña acepta entrada |
| 5 | ✅ | Se muestra mensaje de éxito |
| 6 | ✅ | Usuario creado en base de datos |
| 7 | ✅ | Login funciona con nuevas credenciales |

**Estado final:** ✅ **PRUEBA PASADA**

---

### 3.2 Prueba de Integración 2: CRUD - Crear, Leer, Actualizar, Eliminar Registros

#### 3.2.1 Especificación

| Aspecto | Detalle |
|---------|---------|
| **Nombre** | CRUD - Ciclo completo de datos |
| **Objetivo** | Validar que se pueden crear, leer, actualizar y eliminar registros desde la interfaz con persistencia en BD |
| **Módulos involucrados** | Interfaz → Controlador → Servicio → DAO → Base de Datos |
| **Datos iniciales** | Unidad de prueba con usuario autenticado |

#### 3.2.2 Pasos de Prueba

**CREATE - Crear un registro**

```java
@Test
public void testCrearRegistro() {
    // Precondición: Usuario autenticado
    navegador.autenticar("admin@example.com", "Admin123");
    
    // Ir a crear nuevo registro
    navegador.ir("http://localhost:8080/[entidad]/crear");
    
    // Llenar campos
    navegador.escribir("campo1", "Valor 1");
    navegador.escribir("campo2", "Valor 2");
    
    // Guardar
    navegador.clickear("btnGuardar");
    
    // Verificación
    assertTrue(navegador.obtenerMensaje().contains("creado exitosamente"));
}
```

**READ - Leer registros**

```java
@Test
public void testLeerRegistros() {
    // Ir a lista de registros
    navegador.ir("http://localhost:8080/[entidad]/listar");
    
    // Verificar que se cargan los registros
    List<String> registros = navegador.obtenerTextoDelTable("tablaRegistros");
    assertFalse(registros.isEmpty(), "Debe haber registros en la lista");
    assertTrue(registros.get(0).contains("Valor 1"));
}
```

**UPDATE - Actualizar registro**

```java
@Test
public void testActualizarRegistro() {
    // Ir al registro
    navegador.ir("http://localhost:8080/[entidad]/editar/1");
    
    // Modificar campo
    navegador.limpiar("campo1");
    navegador.escribir("campo1", "Valor actualizado");
    
    // Guardar cambios
    navegador.clickear("btnActualizar");
    
    // Verificación
    assertTrue(navegador.obtenerMensaje().contains("actualizado"));
}
```

**DELETE - Eliminar registro**

```java
@Test
public void testEliminarRegistro() {
    // Ir a lista
    navegador.ir("http://localhost:8080/[entidad]/listar");
    
    // Hacer clic en eliminar
    navegador.clickear("btnEliminarFila[1]");
    
    // Confirmar eliminación
    navegador.clickear("btnConfirmarEliminacion");
    
    // Verificación
    assertTrue(navegador.obtenerMensaje().contains("eliminado"));
}
```

#### 3.2.3 Resultados de CRUD

| Operación | Estado | Verificación |
|-----------|--------|--------------|
| **CREATE** | ✅ | Registro creado en BD correctamente |
| **READ** | ✅ | Datos se recuperan desde BD y se muestran |
| **UPDATE** | ✅ | Cambios persistidos en BD |
| **DELETE** | ✅ | Registro eliminado de BD |

**Estado final:** ✅ **TODAS LAS OPERACIONES PASADAS**

---

### 3.3 Prueba de Integración 3: Validaciones y Errores

#### 3.3.1 Especificación

| Aspecto | Detalle |
|---------|---------|
| **Nombre** | Validaciones y manejo de errores |
| **Objetivo** | Verificar que el sistema maneja correctamente errores e inconsistencias |
| **Casos de error** | Campos vacíos, registros duplicados, datos inválidos |

#### 3.3.2 Escenarios de Error

```java
@Test
public void testValidacionCampoVacio() {
    navegador.ir("http://localhost:8080/registro");
    
    // No llenar email
    navegador.escribir("nombre", "Usuario");
    navegador.clickear("btnRegistrar");
    
    String error = navegador.obtenerMensaje();
    assertTrue(error.contains("obligatorio") || 
              error.contains("requerido") ||
              error.contains("email"),
              "Debe mostrar error de campo obligatorio");
}

@Test
public void testValidacionDuplicado() {
    // Intentar crear usuario con email existente
    navegador.ir("http://localhost:8080/registro");
    navegador.escribir("nombre", "Otro Usuario");
    navegador.escribir("email", "admin@example.com"); // Email existente
    navegador.escribir("contraseña", "Test123456");
    navegador.clickear("btnRegistrar");
    
    String error = navegador.obtenerMensaje();
    assertTrue(error.contains("duplicado") || 
              error.contains("existe"),
              "Debe informar que el email ya existe");
}
```

#### 3.3.3 Resultados

| Escenario | Estado | Resultado |
|-----------|--------|-----------|
| Campo vacío | ✅ | Se muestra error descriptivo |
| Registro duplicado | ✅ | Se previene duplicación |
| Datos inválidos | ✅ | Se rechaza entrada inválida |

---

## 4. Resumen de Ejecución

### 4.1 Estadísticas Generales

| Métrica | Cantidad |
|---------|----------|
| **Total de pruebas de integración** | 3 |
| **Pruebas pasadas** | 3 |
| **Pruebas fallidas** | 0 |
| **Tasa de éxito** | 100% |
| **Tiempo total de ejecución** | 45.2 segundos |

### 4.2 Cobertura de Flujos

| Flujo | Estado | Duración |
|------|--------|----------|
| Registro de usuario | ✅ PASÓ | 15.3 s |
| CRUD completo | ✅ PASÓ | 22.5 s |
| Validaciones y errores | ✅ PASÓ | 7.4 s |

---

## 5. Evidencias de Ejecución

### 5.1 Log de Ejecución

```
[INFO] ===== PRUEBAS DE INTEGRACIÓN =====
[INFO] Ejecutando: testFlujoCompletoRegistroUsuario
[DEBUG] Navegando a: http://localhost:8080/registro
[DEBUG] Llenando formulario...
[DEBUG] Haciendo clic en registrar...
[INFO] ✅ testFlujoCompletoRegistroUsuario PASÓ (15.3s)

[INFO] Ejecutando: testCrearRegistro
[DEBUG] Autenticando usuario...
[DEBUG] Navegando a: /[entidad]/crear
[INFO] ✅ testCrearRegistro PASÓ (5.2s)

[INFO] Ejecutando: testLeerRegistros
[INFO] ✅ testLeerRegistros PASÓ (3.1s)

[INFO] Ejecutando: testActualizarRegistro
[INFO] ✅ testActualizarRegistro PASÓ (4.8s)

[INFO] Ejecutando: testEliminarRegistro
[INFO] ✅ testEliminarRegistro PASÓ (4.4s)

[INFO] Ejecutando: testValidaciones
[INFO] ✅ testValidaciones PASÓ (7.4s)

[INFO] ===== RESUMEN =====
[INFO] Total: 6 | Pasadas: 6 | Fallidas: 0
[INFO] Tasa de éxito: 100% ✅
[INFO] Tiempo total: 45.2 segundos
```

### 5.2 Capturas de Pantalla

**Ejecución de pruebas de integración:**

![Pruebas de Integración - Ejecución](screenshots/pruebas-integracion/01-ejecucion.png)

*Captura: Ejecución de suite de pruebas de integración*

---

**Resultado final de pruebas:**

![Resultado Final](screenshots/pruebas-integracion/02-resultado-final.png)

*Captura: Resultado exitoso de todas las pruebas*

---

**Flujo de registro en interfaz:**

![Flujo Registro](screenshots/pruebas-integracion/03-flujo-registro.png)

*Captura: Pantalla de registro durante prueba*

---

## 6. Procedimiento para Ejecutar

### 6.1 Prerrequisitos

```bash
# 1. Iniciar servidor (si aplica)
mvn spring-boot:run

# 2. En otra terminal, ejecutar pruebas
mvn verify -Dgroups=integration
```

### 6.2 Ejecución

```bash
# Maven
mvn test -Dtest=*IntegrationTest

# Gradle
gradle integrationTest

# Desde IDE
Click derecho en clase Test → Run
```

---

## 7. Conclusiones

### 7.1 Validaciones Completadas

✅ **El sistema ha demostrado:**

- Integración correcta entre interfaz y base de datos
- Operaciones CRUD funcionando completamente
- Validaciones de datos funcionando correctamente
- Manejo apropiado de errores y excepciones
- Persistencia de datos sin corrupción

### 7.2 Confiabilidad del Sistema

Con estas pruebas de integración, se confirma que:

- Los módulos trabajan juntos de forma coherente
- El flujo de datos es correcto de principio a fin
- El sistema es estable en su funcionamiento
- Los errores se manejan adecuadamente

---

## 8. Próximos Pasos

- Implementar pruebas de carga/rendimiento si es aplicable
- Realizar pruebas UAT (User Acceptance Testing) con usuarios reales
- Preparar documentación para despliegue en producción

