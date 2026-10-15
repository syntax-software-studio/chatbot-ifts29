# 03 · Estructura del menú (propuesta acordada)

**Estado:** acordado con el equipo, pendiente de implementar en el seed y en Neon.

**Para quién:** equipo del proyecto.

## Decisiones

1. **Materias** es un ítem de primer nivel. Lista las cuatro materias del cuatrimestre; al elegir una, muestra sus opciones (programa, cronograma, horarios, condiciones).
2. **Plan de estudios** y **Correlatividades** van bajo **Normativa**, porque son generales a la carrera y no de una materia.

## Estructura

Leyenda de estado: **existe** = ya está en el seed y en Neon; **nuevo** = hay que crearlo; **contenido pendiente** = la opción existe, pero el texto o el documento todavía no es el definitivo.

```
RAIZ
├── Trámites
│   ├── Inscripción a materias            [existe]
│   ├── Inscripción a exámenes            [existe]
│   ├── Entrega de documentación          [nuevo · documento pendiente]
│   ├── Certificado de examen             [existe · texto con formulario de Google Forms]
│   └── Equivalencias                     [nuevo · documento disponible en Simulación]
├── Normativa
│   ├── Plan de estudios                  [nuevo · documento en ejemplo]
│   ├── Correlatividades                  [nuevo · documento en ejemplo]
│   ├── Carga horaria                     [nuevo · documento en ejemplo]
│   └── Reglamento y protocolos           [nuevo · escaneo, requiere OCR o carga manual]
├── SIU y campus
│   ├── Acceso al SIU                     [existe]
│   ├── Diferencias SIU y campus          [existe]
│   ├── Acceso al campus                  [nuevo · texto con URL, sin documento]
│   └── Foros y mensajería                [nuevo · documentos en Simulación]
├── Materias
│   ├── Administración de Bases de Datos
│   │   ├── Programa                      [existe · contenido pendiente]
│   │   ├── Cronograma                    [existe · contenido pendiente]
│   │   ├── Horarios por comisión         [existe]
│   │   └── Condiciones de aprobación     [existe]
│   ├── Elementos de Análisis Matemático
│   │   ├── Programa                      [existe · contenido pendiente]
│   │   ├── Cronograma                    [existe · contenido pendiente]
│   │   ├── Horarios por comisión         [existe]
│   │   └── Condiciones de aprobación     [pendiente · sin archivo: muestra aviso para consultar a tutoría o bedelía]
│   ├── Lógica Computacional
│   │   └── (mismas cuatro opciones)
│   └── Técnicas de Programación
│       └── (mismas cuatro opciones)
└── No encontré lo que busco              [existe]
```

## Notas

- Hoy el menú académico es "Consultas académicas" con las cuatro materias adentro. El cambio es subir "Materias" a primer nivel y dejar "Normativa" como ítem hermano.
- "Materias" reemplaza a "Consultas académicas" como nombre de la categoría. Hay que decidir si se mantiene el nombre viejo como alias, o si se renombra del todo.
- Los documentos marcados como "pendiente" o "en ejemplo" se validan con el equipo antes de publicarse como fuente.

## Próximo paso

Implementar la estructura en el seed (`catalogo.ts` y `002_seed.sql`) y en Neon, con las claves nuevas siguiendo el patrón existente. Antes de hacerlo conviene confirmar dos cosas: si "Materias" reemplaza del todo a "Consultas académicas", y si "Carga horaria" va bajo Normativa, como está en el árbol.
