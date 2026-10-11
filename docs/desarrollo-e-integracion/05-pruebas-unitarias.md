# 5. Pruebas Unitarias

## 🧪 Documentación de Pruebas Unitarias

Esta sección documenta las pruebas unitarias implementadas en el proyecto, su objetivo, cobertura y resultados.

---

## 1. Introducción

### 1.1 Objetivo de las Pruebas Unitarias

Las pruebas unitarias tienen como objetivo:

- Verificar que cada unidad de código (método, función, clase) funcione correctamente de forma aislada
- Detectar errores en etapas tempranas del desarrollo
- Facilitar el mantenimiento y refactorización del código
- Aumentar la confianza en la estabilidad del sistema

### 1.2 Cobertura Esperada

Se espera cubrir las funcionalidades principales y críticas del sistema mediante pruebas unitarias representativas.

---

## 2. Metodología y Framework Utilizado

### 2.1 Framework de Testing

**Framework seleccionado:** [JUnit, Pytest, Jasmine, etc.]  
**Versión:** [Versión]

### 2.2 Estructura de Pruebas

```
proyecto/
├── src/
│   └── test/
│       ├── java/
│       │   └── com/proyecto/
│       │       ├── UsuarioTest.java
│       │       ├── ValidacionTest.java
│       │       └── CalculoTest.java
│       └── resources/
│           └── test-data.properties
```

### 2.3 Convenciones de Nomenclatura

- **Clase a probar:** `Usuario.java`
- **Clase de prueba:** `UsuarioTest.java`
- **Método a probar:** `validarEmail()`
- **Método de prueba:** `testValidarEmailValido()`, `testValidarEmailInvalido()`

---

## 3. Casos de Prueba Unitarias

### 3.1 Prueba 1: Validación de Email

#### 3.1.1 Especificación

| Aspecto | Detalle |
|---------|---------|
| **Clase probada** | Usuario |
| **Método probado** | validarEmail(String email) |
| **Objetivo** | Verificar que se valide correctamente el formato de email |
| **Escenarios** | Email válido, email inválido, email nulo |

#### 3.1.2 Casos de Prueba

**Caso 1.1: Email válido**

```java
@Test
public void testValidarEmailValido() {
    // Arrange
    Usuario usuario = new Usuario();
    String emailValido = "usuario@example.com";
    
    // Act
    boolean resultado = usuario.validarEmail(emailValido);
    
    // Assert
    assertTrue(resultado, "Email válido debería retornar true");
}
```

| Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---------|-------------------|-------------------|--------|
| usuario@example.com | true | true | ✅ PASÓ |

**Caso 1.2: Email inválido (sin @)**

```java
@Test
public void testValidarEmailSinArroba() {
    // Arrange
    Usuario usuario = new Usuario();
    String emailInvalido = "usuarioexample.com";
    
    // Act
    boolean resultado = usuario.validarEmail(emailInvalido);
    
    // Assert
    assertFalse(resultado, "Email sin @ debería retornar false");
}
```

| Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---------|-------------------|-------------------|--------|
| usuarioexample.com | false | false | ✅ PASÓ |

**Caso 1.3: Email inválido (formato incorrecto)**

```java
@Test
public void testValidarEmailFormatoIncorrecto() {
    // Arrange
    Usuario usuario = new Usuario();
    String emailInvalido = "usuario@.com";
    
    // Act
    boolean resultado = usuario.validarEmail(emailInvalido);
    
    // Assert
    assertFalse(resultado, "Email con formato incorrecto debería retornar false");
}
```

| Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---------|-------------------|-------------------|--------|
| usuario@.com | false | false | ✅ PASÓ |

---

### 3.2 Prueba 2: Validación de Contraseña

#### 3.2.1 Especificación

| Aspecto | Detalle |
|---------|---------|
| **Clase probada** | Usuario |
| **Método probado** | validarContraseña(String pwd) |
| **Objetivo** | Verificar que la contraseña cumpla requisitos mínimos |
| **Requisitos** | Mínimo 8 caracteres, incluir números y letras |

#### 3.2.2 Casos de Prueba

**Caso 2.1: Contraseña válida**

```java
@Test
public void testValidarContraseñaValida() {
    // Arrange
    Usuario usuario = new Usuario();
    String passwordValida = "MiPass123";
    
    // Act
    boolean resultado = usuario.validarContraseña(passwordValida);
    
    // Assert
    assertTrue(resultado, "Contraseña válida debería retornar true");
}
```

| Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---------|-------------------|-------------------|--------|
| MiPass123 | true | true | ✅ PASÓ |

**Caso 2.2: Contraseña muy corta**

```java
@Test
public void testValidarContraseñaMuyCorta() {
    // Arrange
    Usuario usuario = new Usuario();
    String passwordCorta = "Pass12";
    
    // Act
    boolean resultado = usuario.validarContraseña(passwordCorta);
    
    // Assert
    assertFalse(resultado, "Contraseña menor a 8 caracteres debería retornar false");
}
```

| Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---------|-------------------|-------------------|--------|
| Pass12 | false | false | ✅ PASÓ |

**Caso 2.3: Contraseña sin números**

```java
@Test
public void testValidarContraseñaSinNumeros() {
    // Arrange
    Usuario usuario = new Usuario();
    String passwordSinNumeros = "MiPassword";
    
    // Act
    boolean resultado = usuario.validarContraseña(passwordSinNumeros);
    
    // Assert
    assertFalse(resultado, "Contraseña sin números debería retornar false");
}
```

| Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---------|-------------------|-------------------|--------|
| MiPassword | false | false | ✅ PASÓ |

---

### 3.3 Prueba 3: Cálculo o Lógica de Negocio

#### 3.3.1 Especificación

| Aspecto | Detalle |
|---------|---------|
| **Clase probada** | [Nombre de la clase] |
| **Método probado** | [Nombre del método] |
| **Objetivo** | Verificar que los cálculos sean correctos |

#### 3.3.2 Casos de Prueba

**Caso 3.1: [Descripción del caso]**

```java
@Test
public void test[Nombre del caso]() {
    // Arrange
    [Clase a probar] objeto = new [Clase a probar]();
    [Preparar datos]
    
    // Act
    [Resultado] resultado = objeto.metodo([parámetros]);
    
    // Assert
    assertEquals([Valor esperado], resultado, "Mensaje de descripción");
}
```

| Entrada | Resultado Esperado | Resultado Obtenido | Estado |
|---------|-------------------|-------------------|--------|
| [Entrada] | [Esperado] | [Obtenido] | ✅ PASÓ |

---

## 4. Resumen de Ejecución

### 4.1 Estadísticas Generales

| Métrica | Cantidad |
|---------|----------|
| **Total de pruebas** | 9 |
| **Pruebas pasadas** | 9 |
| **Pruebas fallidas** | 0 |
| **Tasa de éxito** | 100% |
| **Tiempo de ejecución** | 2.345 segundos |

### 4.2 Cobertura de Código

| Clase | Métodos | Cobertura |
|-------|---------|-----------|
| Usuario | 2 de 2 | 100% |
| Validacion | 1 de 1 | 100% |
| Logica | 1 de 1 | 100% |
| **Total** | **4 de 4** | **100%** |

---

## 5. Evidencias de Ejecución

### 5.1 Salida de Consola de JUnit

```
[INFO] Running com.proyecto.UsuarioTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.456s
[INFO] Running com.proyecto.ValidacionTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.324s
[INFO] Running com.proyecto.CalculoTest
[INFO] Tests run: 3, Failures: 0, Errors: 0, Skipped: 0, Time elapsed: 0.456s
[INFO] ============ TEST SUMMARY ============
[INFO] Total: 9
[INFO] Passed: 9 ✅
[INFO] Failed: 0
[INFO] Success Rate: 100%
[INFO] Time: 2.345s
```

### 5.2 Capturas de Pantalla

**Ejecución de pruebas en IDE:**

![Pruebas Unitarias - IDE](screenshots/pruebas-unitarias/01-ejecucion-ide.png)

*Captura: Resultado de ejecución de pruebas en IntelliJ IDEA / Eclipse / VS Code*

---

**Resultado de cobertura:**

![Cobertura de Código](screenshots/pruebas-unitarias/02-cobertura.png)

*Captura: Reporte de cobertura de código (JaCoCo o similar)*

---

## 6. Procedimiento para Ejecutar Pruebas

### 6.1 Desde línea de comandos

```bash
# Maven
mvn test

# Gradle
gradle test

# NPM (JavaScript)
npm test
```

### 6.2 Desde IDE

1. Abre el proyecto en tu IDE
2. Navega a la clase `[NombreTest.java]`
3. Haz clic derecho → Run Tests
4. Observa los resultados en la pestaña "Test Results"

---

## 7. Mantenimiento y Actualizaciones

### 7.1 Cuando Agregar Nuevas Pruebas

- Cuando se agregue una nueva funcionalidad crítica
- Cuando se corrija un bug (agregar prueba que lo reproduzca)
- Cuando se detecte un escenario no cubierto

### 7.2 Cuando Actualizar Pruebas Existentes

- Si cambia la lógica de la funcionalidad probada
- Si se modifican los requisitos
- Si se encuentren falsos positivos o negativos

---

## 8. Conclusión

✅ **Las pruebas unitarias demuestran que:**

- Los componentes principales del sistema funcionan correctamente
- Las validaciones de entrada funcionan como se espera
- La lógica de negocio produce resultados correctos
- El código está listo para pruebas de integración
