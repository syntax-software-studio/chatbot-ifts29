# 01 · Estructura del menú

**Estado:** implementada en el seed (`backend/src/seed/catalogo.ts`, `db/002_seed.sql`) y en Neon. Pendiente de commit en `feat/estructura-menu`.

**Para quién:** equipo del proyecto.

## Decisiones

| Decisión | Estado |
|---|---|
| Orden del primer nivel: Materias, SIU y campus, Trámites, Normativa, No encontré lo que busco. | Confirmada |
| "Materias" es un ítem de primer nivel con las cuatro materias. Reemplaza a "Consultas académicas". | Confirmada |
| "Trámites" es un ítem de primer nivel. | Confirmada |
| El ítem de normativa se llama "Normativa". | Confirmada |
| Plan de estudios y correlatividades van bajo Normativa, porque son generales a la carrera. | Confirmada |
| Carga horaria va bajo Normativa. | **Pendiente de confirmar** |

## Estructura implementada

Leyenda: **doc** = respuesta con documento de Drive vinculado; **texto** = respuesta solo de texto; **contenido pendiente** = el texto o el documento todavía no es el definitivo.

```
RAIZ
├── Materias
│   ├── Administración de Bases de Datos
│   │   ├── Programa                      [doc · contenido pendiente]
│   │   ├── Cronograma                    [doc · contenido pendiente, revisar vigencia]
│   │   ├── Días de cursada por comisión  [texto · comisiones sin confirmar]
│   │   └── Condiciones de aprobación     [doc]
│   ├── Elementos de Análisis Matemático
│   │   ├── Programa                      [doc · contenido pendiente]
│   │   ├── Cronograma                    [doc · contenido pendiente]
│   │   ├── Días de cursada por comisión  [texto · comisiones sin confirmar]
│   │   └── Condiciones de aprobación     [sin archivo · muestra aviso para consultar a tutoría o bedelía]
│   ├── Lógica Computacional
│   │   └── (mismas cuatro opciones)
│   └── Técnicas de Programación
│       └── (mismas cuatro opciones)
├── SIU y campus
│   ├── Acceso al SIU                     [texto · URL de SIU]
│   ├── Diferencias SIU y campus          [texto · URLs de campus y SIU]
│   ├── Acceso al campus virtual          [texto · URL y contacto de Asesoría Pedagógica]
│   └── Foros y mensajería                [doc × 2]
├── Trámites
│   ├── Inscripción a materias            [texto · URL de SIU]
│   ├── Inscripción a exámenes            [texto · URL de SIU]
│   ├── Certificado de examen             [texto · formulario de Google Forms]
│   ├── Entrega de documentación          [doc]
│   └── Equivalencias                     [doc]
├── Normativa
│   ├── Plan de estudios                  [doc]
│   ├── Correlatividades                  [doc]
│   ├── Carga horaria                     [doc · pendiente de confirmar ubicación]
│   └── Reglamento y protocolos           [doc × 2 · escaneos, sin texto extraíble]
└── No encontré lo que busco              [derivación]
```

Nota: el documento general de horarios (`horarios__general.pdf`) está en la base y en el sync, pero no está vinculado a ninguna respuesta. Las opciones de "Días de cursada" usan un texto con comisiones A, B y C que no coincide con la grilla del Drive, así que no conviene mostrar los dos a la vez hasta confirmar las comisiones.

## Pendientes

- Confirmar que "Carga horaria" va bajo Normativa.
- Confirmar las comisiones vigentes de primer año y reemplazar el texto de "Días de cursada".
- Revisar los textos de presentación de Normativa y de "Acceso al campus", que los redactó el equipo de desarrollo y no pasaron por revisión institucional.
- Cargar variantes de texto libre para las opciones nuevas. Hoy una consulta escrita sobre reglamento, foros o certificado no encuentra la opción.
- Hacer commit de `feat/estructura-menu`.
