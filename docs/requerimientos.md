# Requerimientos y trazabilidad
Numeración alineada con el informe (SaludPlus.docx, A.3). Incluye las respuestas del cliente del 15/10/2026: el sistema interviene desde que el paciente llega y verifica su turno en el tótem, no gestiona reservas ni recordatorios, y aplica una tolerancia de 15 minutos.

| ID | Necesidad | Prioridad |
|---|---|---|
| RF-01 | Autoanuncio en el tótem con DNI o número de afiliado | Must |
| RF-02 | Registro de llegada y estado "presente" en tiempo real | Must |
| RF-03 | Número llamado, consultorio y espera estimada en pantalla, legible a 8 m | Must |
| RF-04 | Llamar al siguiente con una acción | Must |
| RF-05 | Demanda espontánea en la cola digital | Must |
| RF-06 | Aviso de demora cuando el profesional supera 15 minutos | Should |
| RF-07 | Tolerancia de 15 minutos: después, el turno queda cancelado; sin llegada, ausente | Must |
| RF-08 | Indicadores de espera por centro y franja horaria | Should |
| RF-09 | Registro de accesos a datos sensibles | Must |
| RF-10 | Verificación del turno en la API de solo lectura del proveedor | Must |
| RF-11 | Registro de contraturno por secretaría para turnos cancelados por tolerancia | Should |
| RF-12 | Vías alternativas para pacientes sin smartphone | Must |
| RNF-01 | Autoanuncio en menos de 5 segundos durante el pico | Should |
| RNF-02 | Concurrencia en el pico de 7 a 11 con respuestas de cola menores a 2 segundos | Should |
| RNF-03 | Continuidad local y sincronización posterior | Must |
| RNF-04 | Cifrado y acceso por rol | Must |
| RNF-05 | Accesibilidad: legibilidad a 8 m y contraste 4,5:1 | Must |
| RNF-08 | Usabilidad para secretarias de 24 a 61 años | Must |
| RNF-09 | Mantenibilidad por un equipo de dos personas | Should |
| RNF-10 | Escalabilidad por configuración de centros y especialidades | Could |
| RNF-11 | Cumplimiento normativo: consentimiento, retención y registro de accesos | Must |

RNF-06 y RNF-07 no se usan, para conservar la numeración del informe.

## Reglas de negocio confirmadas por el cliente
- Tolerancia de llegada: 15 minutos desde el horario del turno. Pasado ese plazo, el turno queda cancelado y el paciente solo puede atenderse con un contraturno asignado por secretaría.
- La reserva, reprogramación y cancelación de turnos se hacen solo en el sistema del proveedor.
- No se envían recordatorios ni notificaciones de turno.

## Entregables académicos
A1: problema, actores, procesos, objetivos y supuestos.
A2: comparación de al menos tres metodologías, selección, descartes, roles y cadencia.
A3: requerimientos priorizados, reglas, casos de uso/procesos y modelo conceptual.
A4: stack, fundamentación, alternativas y arquitectura.
B1: contrato de alcance con incluidos, excluidos, hitos, aceptación y cambios.
B2: tablero real, épicas, historias, tareas, spikes, criterios, responsables y definición de terminado.
B3: demo, código, instrucciones y video de respaldo de 2–3 minutos.
B4: manual de marca y aplicación efectiva de UX/accesibilidad.
B5: manual de usuario con capturas reales.
B6: estrategia comercial, criterio de precio, objeciones y siguiente paso.
C: presentación propia, reparto de exposición, ensayo de 25 minutos más 15 de preguntas.
IA: declaración de herramientas, propósito, correcciones y aportes propios.

El cliente indicó que no se evalúan riesgos (sin apartado A.5).
