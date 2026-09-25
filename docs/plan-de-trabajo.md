# Plan de trabajo
## Calendario relativo
| Hito | Semanas | Resultado esperado |
|---|---|---|
| S1 Análisis y decisiones | 1–2 | Alcance, relevamiento, metodología, riesgos y pruebas de viabilidad |
| S2 Diseño y base técnica | 3–4 | Prototipos, modelo de datos, autenticación y estructura inicial |
| S3 Admisión y colas | 5–6 | Autoanuncio y operación de secretaría integrados |
| S4 Atención y continuidad | 7–8 | Llamado, pantalla y continuidad local probada |
| S5 Recordatorios e indicadores | 9–10 | Notificaciones, métricas y recuperación |
| S6 Validación y entrega | 11–12 | Pruebas, documentación y demostración verificadas |
| P1 Capacitación | 13 | Una semana por perfiles y preparación operativa |
| P2 Prueba del piloto | Desde semana 14, durante 30 días | Incidencias corregidas y aceptación del piloto |
| P3 Extensión a centros restantes | Después de aceptación del piloto | Despliegue progresivo con reversión |
Las semanas son una estimación; no se fija una fecha calendario sin fecha de inicio confirmada. Tres meses es la estimación de desarrollo; capacitación, prueba y extensión no se ocultan dentro de ese plazo.

## Cadencia
Sprints de dos semanas; planificación al inicio; sincronización diaria breve; revisión y retrospectiva al cierre. El Product Owner ordena las prioridades; el equipo estima y decide cómo implementar. Los usuarios participan en pruebas y aportan feedback.

## Tablero
Estados: Backlog → Por hacer → En progreso → En revisión → Pruebas → Finalizado. Bloqueado se registra con motivo y dependencia, sin marcarlo como terminado.
La planificación inicial no equivale a actividad sostenida: registrar avances reales durante el cuatrimestre, sin inventar fechas o evidencias.

## Estimación y capacidad
Las estimaciones de issues son preliminares, en horas de esfuerzo, no duración calendario. Equipo confirmado de dos integrantes. Las 36 tareas de desarrollo suman 364 horas; las cuatro de capacitación/piloto/extensión, 50 horas adicionales. Como hipótesis de capacidad, 20 horas semanales por integrante durante 12 semanas aportan 480 horas: quedan 116 horas para revisión, correcciones e incertidumbre. La dedicación es un supuesto a confirmar, no un compromiso ya acordado. Una épica agrupa trabajo; su esfuerzo no se suma otra vez a sus tareas.
Reservar capacidad para revisión, correcciones e incertidumbre. Ante falta de capacidad, negociar alcance antes de prometer fechas.

## Roles y asignación
Equipo de dos integrantes. Rol A: coordinación/análisis y UX/frontend. Rol B: backend/datos e infraestructura. QA y revisión son responsabilidades compartidas; quien no implementa revisa. Propuesta inicial: zaymaite lidera el rol A y oKriM-Bitt el rol B. Se ajustará según habilidades y disponibilidad; no se presupone experiencia. Las tareas compartidas tendrán un responsable principal y revisión del otro integrante.
Las issues se asignan a oKriM-Bitt para coordinación provisional mientras zaymaite no tenga acceso confirmado al repositorio. Cada tarjeta identifica el responsable de ejecución propuesto. No significa que oKriM-Bitt ejecute todo.

## Criterios de salida
- Desarrollo: circuito completo probado, controles de acceso, datos persistentes, documentación y demo accesible.
- Piloto: capacitación realizada, reversión ensayada y contingencia disponible.
- Extensión: aceptación del piloto y ausencia de fallas críticas; no basta con cumplir una fecha.

