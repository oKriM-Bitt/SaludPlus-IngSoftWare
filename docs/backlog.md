# Backlog de SaludPlus

Estimaciones preliminares de esfuerzo. Estado inicial: pendiente. Roles: A = zaymaite (análisis/UX/frontend), B = oKriM-Bitt (backend/infraestructura); reparto propuesto sujeto a revisión.

## SP-1 · Relevar problema, actores y proceso actual

Construir diagnóstico propio y separar hechos del caso de supuestos.

- Etapa: S1 · Tipo: DOC · Prioridad: P0 · Esfuerzo: 6 h · Rol: A
- Trazabilidad: A1
- Dependencias: Ninguna

- [ ] Mapa del proceso actual con cuellos de botella
- [ ] matriz de actores e intereses
- [ ] preguntas abiertas sobre equipos, horarios y atención espontánea.

## SP-2 · Definir alcance comercial y abono mensual

Como cliente, quiero conocer qué cubren los USD 2.000 mensuales para evitar compromisos ambiguos.

- Etapa: S1 · Tipo: DOC · Prioridad: P0 · Esfuerzo: 8 h · Rol: A
- Trazabilidad: B1
- Dependencias: SP-1

- [ ] Contrato simulado con incluidos/excluidos
- [ ] facturación desde primer centro
- [ ] una semana de capacitación y 30 días de ajustes
- [ ] consumo de Meta, infraestructura y desarrollo inicial definidos como incluidos o adicionales.

## SP-3 · Normalizar requerimientos, objetivos y reglas de negocio

Construir una base trazable sin inconsistencias de numeración.

- Etapa: S1 · Tipo: DOC · Prioridad: P0 · Esfuerzo: 8 h · Rol: A
- Trazabilidad: A1,A3,RF-01:12,RNF-01:09
- Dependencias: SP-1

- [ ] RF/RNF numerados y medibles
- [ ] prioridades MoSCoW por valor y riesgo
- [ ] reglas de prioridad/ausencias/duplicados aprobadas
- [ ] metas identificadas como propuestas, no datos observados.

## SP-4 · Investigar API del proveedor y límites de integración

Investigar durante un máximo de ocho horas cómo consultar turnos sin modificar el módulo externo.

- Etapa: S1 · Tipo: SPIKE · Prioridad: P0 · Esfuerzo: 8 h · Rol: B
- Trazabilidad: RF-10,RF-11
- Dependencias: SP-1

- [ ] Contrato de consulta y autenticación documentado
- [ ] respuestas de error y límites registrados
- [ ] decisión sobre cancelación/reprogramación
- [ ] si falta acceso, simulador y limitación explícitos.

## SP-5 · Validar arquitectura para cortes de internet

Verificar con una prueba acotada si tótem, médico y pantalla pueden compartir estado por la red local sin internet.

- Etapa: S1 · Tipo: SPIKE · Prioridad: P0 · Esfuerzo: 12 h · Rol: B
- Trazabilidad: RNF-03,A4
- Dependencias: SP-3

- [ ] Prueba entre al menos dos clientes y nodo local
- [ ] escenario de caída/recuperación
- [ ] conflictos, permisos offline y turnos no descargados tratados
- [ ] decisión con evidencia y esfuerzo estimado.

## SP-6 · Fundamentar metodología y registrar riesgos iniciales

Definir organización incremental con Scrum y respuestas a incertidumbres.

- Etapa: S1 · Tipo: DOC · Prioridad: P0 · Esfuerzo: 8 h · Rol: A+B
- Trazabilidad: A2,A4,A5
- Dependencias: SP-2, SP-4, SP-5

- [ ] Tres metodologías comparadas sin afirmaciones absolutas
- [ ] seis sprints y roles
- [ ] al menos ocho riesgos con escala, exposición, responsable por rol, disparador y contingencia
- [ ] ADR de stack y arquitectura.

## SP-7 · Diseñar manual de marca y prototipos por perfil

Como usuario, quiero interfaces coherentes y adaptadas a mi tarea.

- Etapa: S2 · Tipo: UX · Prioridad: P0 · Esfuerzo: 14 h · Rol: A
- Trazabilidad: B4,RF-01,RF-03,RF-04,RNF-05
- Dependencias: SP-3

- [ ] Tótem, panel, médico y pantalla prototipados
- [ ] logo y variantes, HEX/RGB, tipografía, grilla, componentes/estados, iconos y tono documentados
- [ ] origen de assets declarado.

## SP-8 · Validar prototipos con perfiles representativos

Comprobar comprensión y accesibilidad antes de programar todas las pantallas.

- Etapa: S2 · Tipo: UX · Prioridad: P0 · Esfuerzo: 8 h · Rol: A
- Trazabilidad: RNF-05,RNF-06,B4
- Dependencias: SP-7

- [ ] Guion de pruebas, participantes y resultados reales documentados
- [ ] teclado/contraste y legibilidad revisados
- [ ] si no hay participantes, registrar evaluación interna sin inventar entrevistas
- [ ] mejoras priorizadas.

## SP-9 · Preparar estructura React y NestJS y controles de calidad

Crear estructura reproducible para frontend y backend.

- Etapa: S2 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: A4,RNF-07
- Dependencias: SP-6

- [ ] Instalación documentada
- [ ] .env.example sin secretos
- [ ] lint y comprobación de tipos en CI
- [ ] datos ficticios
- [ ] flujo de rama y PR funcional.

## SP-10 · Diseñar modelo conceptual y migraciones PostgreSQL

Representar entidades y proteger integridad de atención.

- Etapa: S2 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: A3,RF-02,RF-05,RNF-02
- Dependencias: SP-3, SP-9

- [ ] Modelo conceptual con relaciones
- [ ] migraciones reproducibles
- [ ] centros/profesionales/turnos/llegadas/cola/auditoría/notificaciones
- [ ] restricciones contra duplicados y seed ficticio.

## SP-11 · Implementar autenticación, roles y sesiones

Como personal autorizado, quiero acceder solo a la información y operaciones de mi rol y centro.

- Etapa: S2 · Tipo: HU · Prioridad: P0 · Esfuerzo: 12 h · Rol: B
- Trazabilidad: RNF-04,RF-09
- Dependencias: SP-9, SP-10

- [ ] Dado usuario sin permiso, cuando llama API ajena, entonces se rechaza
- [ ] cierre/expiración probados
- [ ] rutas públicas con datos mínimos
- [ ] pruebas negativas de autorización.

## SP-12 · Documentar arquitectura, casos de uso y decisiones

Explicar componentes, datos e integraciones de manera defendible.

- Etapa: S2 · Tipo: DOC · Prioridad: P1 · Esfuerzo: 6 h · Rol: A
- Trazabilidad: A3,A4
- Dependencias: SP-5, SP-6, SP-10

- [ ] Diagrama de alto nivel con nube/nodo local según spike
- [ ] mapa de procesos o casos de uso
- [ ] alternativas justificadas
- [ ] costos de licencia separados de hosting
- [ ] versión inicial A4 completa.

## SP-13 · Construir adaptador de consulta de turnos

Consultar turnos aislando la dependencia del tercero.

- Etapa: S3 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: RF-10
- Dependencias: SP-4, SP-9

- [ ] Interfaz con timeout y errores
- [ ] datos validados
- [ ] pruebas de contrato
- [ ] simulador claramente identificado si API no disponible
- [ ] no guardar credenciales en frontend.

## SP-14 · Registrar llegada del paciente desde el tótem

Como paciente, quiero anunciar mi llegada y recibir un número de orden sin depender de mi celular.

- Etapa: S3 · Tipo: HU · Prioridad: P0 · Esfuerzo: 14 h · Rol: A+B
- Trazabilidad: RF-01,RF-02,RF-12
- Dependencias: SP-8, SP-10, SP-11, SP-13

- [ ] Dado turno vigente, al identificarse se registra una sola llegada
- [ ] reiterar no duplica
- [ ] se entrega número
- [ ] manejo de turno inexistente y privacidad al finalizar sesión.

## SP-15 · Implementar panel de admisión y consulta de cola

Como secretaria, quiero ver quién llegó y asistir al paciente que no usa el tótem.

- Etapa: S3 · Tipo: HU · Prioridad: P0 · Esfuerzo: 14 h · Rol: A+B
- Trazabilidad: RF-02,RF-12
- Dependencias: SP-11, SP-14

- [ ] Cola filtrada por centro/profesional
- [ ] admisión asistida
- [ ] estados vacío/carga/error/datos
- [ ] otra sesión ve el cambio
- [ ] acceso restringido por centro.

## SP-16 · Gestionar demanda espontánea y prioridades

Como secretaria, quiero incorporar pacientes sin turno según reglas acordadas.

- Etapa: S3 · Tipo: HU · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: RF-05
- Dependencias: SP-3, SP-15

- [ ] Prioridad con motivo y auditoría
- [ ] orden determinista
- [ ] no modificar silenciosamente turnos del proveedor
- [ ] pruebas de empate y concurrencia
- [ ] criterios aprobados con cliente simulado.

## SP-17 · Definir flujo autorizado de reprogramación y cancelación

Como secretaria, quiero resolver cambios de turno sin prometer operaciones que la API no admite.

- Etapa: S3 · Tipo: HU · Prioridad: P1 · Esfuerzo: 6 h · Rol: A
- Trazabilidad: RF-11
- Dependencias: SP-4, SP-13, SP-15

- [ ] Interfaz deriva al circuito permitido o registra solicitud local pendiente
- [ ] diferencia entre cambio solicitado y confirmado
- [ ] no informa éxito ficticio al paciente.

## SP-18 · Probar admisión y concurrencia de colas

Verificar consistencia entre operaciones simultáneas.

- Etapa: S3 · Tipo: TEST · Prioridad: P0 · Esfuerzo: 8 h · Rol: A+B
- Trazabilidad: RF-01,RF-02,RF-05,RNF-02
- Dependencias: SP-14, SP-15, SP-16

- [ ] Casos de llegada duplicada, prioridad y dos operadores
- [ ] errores reproducibles registrados como bugs
- [ ] evidencias y resultados, sin marcar pruebas pendientes como aprobadas.

## SP-19 · Llamar al siguiente paciente con una acción

Como médico, quiero llamar al siguiente presente sin cargar datos adicionales.

- Etapa: S4 · Tipo: HU · Prioridad: P0 · Esfuerzo: 12 h · Rol: A+B
- Trazabilidad: RF-04,RNF-02
- Dependencias: SP-11, SP-16, SP-18

- [ ] Un clic llama solo un paciente presente
- [ ] dos solicitudes simultáneas no duplican llamado
- [ ] reintento idempotente
- [ ] registro persistente antes de notificar.

## SP-20 · Implementar pantalla pública de sala de espera

Como paciente, quiero reconocer mi número y consultorio a distancia.

- Etapa: S4 · Tipo: HU · Prioridad: P0 · Esfuerzo: 10 h · Rol: A
- Trazabilidad: RF-03,RNF-05
- Dependencias: SP-7, SP-19

- [ ] Solo número y consultorio, sin datos sensibles
- [ ] llamado visual y apoyo sonoro
- [ ] prueba de legibilidad a ocho metros
- [ ] estados sin datos y desconectado visibles.

## SP-21 · Sincronizar vistas con Socket.IO y reconexión

Mantener las pantallas consistentes y recuperar mensajes perdidos.

- Etapa: S4 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: RF-02,RF-03,RF-04,RNF-02
- Dependencias: SP-15, SP-19, SP-20

- [ ] Canales autorizados por centro
- [ ] tras reconexión se consulta estado actual
- [ ] backend persiste fuente de verdad
- [ ] reconexión probada sin obligar a relogin si la sesión sigue válida.

## SP-22 · Mostrar demoras y estimación de espera

Como paciente, quiero conocer la demora sin consultar continuamente al mostrador.

- Etapa: S4 · Tipo: HU · Prioridad: P1 · Esfuerzo: 8 h · Rol: A+B
- Trazabilidad: RF-03,RF-06
- Dependencias: SP-19, SP-21

- [ ] Algoritmo y umbral de aviso aprobados
- [ ] estimación identificada como aproximada
- [ ] falta de datos no inventa minutos
- [ ] actualización visible en secretaría y sala.

## SP-23 · Implementar continuidad local y reconciliación

Mantener la cola del centro durante cortes según arquitectura validada.

- Etapa: S4 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 20 h · Rol: B
- Trazabilidad: RNF-03
- Dependencias: SP-5, SP-19, SP-21

- [ ] Corte de internet mantiene circuito entre equipos locales
- [ ] evento único y orden definidos
- [ ] restauración sin duplicar
- [ ] autenticación offline acotada
- [ ] caso de turno no descargado resuelto
- [ ] límites eléctricos/red local documentados.

## SP-24 · Probar circuito completo y corte de conectividad

Verificar paciente anunciado, cola, llamado y pantalla con y sin internet.

- Etapa: S4 · Tipo: TEST · Prioridad: P0 · Esfuerzo: 10 h · Rol: A+B
- Trazabilidad: RF-01,RF-02,RF-03,RF-04,RNF-03
- Dependencias: SP-14, SP-19, SP-20, SP-21, SP-23

- [ ] Evidencia del flujo E2E
- [ ] pérdida y recuperación de red
- [ ] no confundir PWA cacheada con cola compartida
- [ ] revisar inicio y cierre de atención para futuros indicadores.

## SP-25 · Integrar plantillas y credenciales de WhatsApp Meta

Enviar recordatorios mediante integración oficial directa sin Twilio ni n8n.

- Etapa: S5 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 12 h · Rol: B
- Trazabilidad: RF-07,RNF-04
- Dependencias: SP-11, SP-13

- [ ] Plantilla de utilidad y acceso habilitados o simulador declarado
- [ ] destinatarios ficticios/de prueba
- [ ] secretos en servidor
- [ ] payload mínimo
- [ ] errores y estado de aprobación documentados.

## SP-26 · Programar recordatorios y registrar entrega

Como afiliado, quiero recibir un recordatorio de mi turno vigente.

- Etapa: S5 · Tipo: HU · Prioridad: P0 · Esfuerzo: 14 h · Rol: B
- Trazabilidad: RF-07
- Dependencias: SP-25, SP-13

- [ ] Proceso servidor independiente del navegador
- [ ] verificar vigencia antes de enviar
- [ ] evitar duplicados entre instancias
- [ ] reintentos acotados
- [ ] webhooks verificados
- [ ] envío y entrega diferenciados
- [ ] baja de notificaciones respetada.

## SP-27 · Construir indicadores con definiciones verificables

Como director, quiero medir espera, ausentismo y ocupación por centro y especialidad.

- Etapa: S5 · Tipo: HU · Prioridad: P1 · Esfuerzo: 14 h · Rol: A+B
- Trazabilidad: RF-08
- Dependencias: SP-10, SP-19, SP-24

- [ ] Fórmulas y denominadores definidos
- [ ] distinguir ausentes/cancelados/pendientes
- [ ] inicio-fin para ocupación
- [ ] filtros por fecha y centro
- [ ] datos conocidos producen resultados comprobables.

## SP-28 · Completar auditoría y controles de datos

Registrar acciones relevantes y limitar el acceso a información sensible.

- Etapa: S5 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: RF-09,RNF-04,RNF-09
- Dependencias: SP-11, SP-15, SP-19, SP-26

- [ ] Actor/fecha/centro/acción
- [ ] operador no puede alterar auditoría
- [ ] no registrar secretos
- [ ] retención y consentimiento según decisiones de Auditoría/Legales
- [ ] pruebas de acceso.

## SP-29 · Configurar despliegue, respaldos y restauración

Publicar un entorno de prueba recuperable.

- Etapa: S5 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: RNF-07,A4
- Dependencias: SP-9, SP-10, SP-21, SP-28

- [ ] Render configurado
- [ ] migraciones y salud
- [ ] respaldo y restauración ensayados
- [ ] separar plan propuesto de recursos realmente contratados
- [ ] no comprar ni crear cargos reales sin autorización.

## SP-30 · Actualizar informe y preparar estrategia comercial

Mantener propuesta alineada con decisiones y evidencia.

- Etapa: S5 · Tipo: DOC · Prioridad: P1 · Esfuerzo: 6 h · Rol: A
- Trazabilidad: A1:A5,B1,B6
- Dependencias: SP-2, SP-6, SP-12, SP-26, SP-29

- [ ] Fundamentación de USD 2.000 mensuales como precio comercial
- [ ] incluidos y consumos claros
- [ ] tres objeciones
- [ ] propuesta de valor y siguiente paso
- [ ] matriz riesgos actualizada
- [ ] fuentes sin precios inventados.

## SP-31 · Ejecutar pruebas de aceptación, carga y accesibilidad

Verificar criterios comprometidos antes de entregar.

- Etapa: S6 · Tipo: TEST · Prioridad: P0 · Esfuerzo: 16 h · Rol: A+B
- Trazabilidad: RNF-01:09,B3,B4
- Dependencias: SP-24, SP-26, SP-27, SP-28, SP-29

- [ ] Carga basada en concurrencia/pico justificados
- [ ] autorización negativa
- [ ] desconexiones
- [ ] teclado/contraste
- [ ] sin defectos críticos
- [ ] resultados y limitaciones conservados.

## SP-32 · Redactar manual de usuario y material de capacitación

Como usuario final, quiero instrucciones por perfil con capturas reales.

- Etapa: S6 · Tipo: DOC · Prioridad: P0 · Esfuerzo: 10 h · Rol: A
- Trazabilidad: B5
- Dependencias: SP-20, SP-26, SP-27, SP-31

- [ ] Flujos paciente/secretaria/médico/director y soporte
- [ ] requisitos de acceso
- [ ] problemas frecuentes y glosario
- [ ] capturas del sistema real
- [ ] guion para semana de capacitación.

## SP-33 · Cerrar informe, contrato y declaración de IA

Preparar documentos completos conforme a la consigna.

- Etapa: S6 · Tipo: DOC · Prioridad: P0 · Esfuerzo: 8 h · Rol: A+B
- Trazabilidad: A1:A5,B1,IA
- Dependencias: SP-30, SP-31, SP-32

- [ ] Informe de 8–15 páginas sin anexos, carátula/índice/páginas/fuentes
- [ ] contrato firmado por grupo con espacio cliente
- [ ] declaración IA
- [ ] trazabilidad
- [ ] comparación con checklist oficial.

## SP-34 · Preparar demo pública y respaldo audiovisual

Demostrar un circuito completo con datos ficticios.

- Etapa: S6 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 6 h · Rol: B
- Trazabilidad: B3
- Dependencias: SP-29, SP-31

- [ ] URL accesible, README de ejecución, frontend/backend/persistencia/auth
- [ ] video de 2–3 minutos
- [ ] no depender de API real no habilitada sin avisar
- [ ] demo probada en equipo de defensa.

## SP-35 · Diseñar presentación propia y guion equilibrado

Comunicar la propuesta como reunión comercial simulada.

- Etapa: S6 · Tipo: DOC · Prioridad: P0 · Esfuerzo: 8 h · Rol: A
- Trazabilidad: C,B4,B6
- Dependencias: SP-30, SP-33, SP-34

- [ ] Diseño propio y marca
- [ ] 25 minutos repartidos entre ambos
- [ ] preguntas 15 minutos
- [ ] diagnóstico/solución/alcance/demo/riesgos/cierre
- [ ] evitar jerga sin explicar.

## SP-36 · Ensayar defensa y verificar entrega 48 horas antes

Asegurar que ambos integrantes defienden todo el proyecto.

- Etapa: S6 · Tipo: TEST · Prioridad: P0 · Esfuerzo: 8 h · Rol: A+B
- Trazabilidad: C,B2,B3
- Dependencias: SP-33, SP-34, SP-35

- [ ] Ensayo con cinco preguntas del caso y cambio de condiciones
- [ ] ambos explican código y modificación
- [ ] enlaces/documentos accesibles
- [ ] checklist de entrega y evidencia de trabajo real.

## SP-37 · Preparar centro piloto y capacitar durante una semana

Planificar capacitación por rol antes de la prueba operativa.

- Etapa: P1 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 12 h · Rol: A+B
- Trazabilidad: B1,B5,RNF-07
- Dependencias: SP-31, SP-32, SP-36

- [ ] Cronograma semanal, ejercicios y evaluación por rol
- [ ] dispositivos y contingencia verificados
- [ ] autorización de piloto simulada
- [ ] identificar actividad académica vs implementación real.

## SP-38 · Desplegar piloto y habilitar período de prueba

Iniciar operación controlada del primer centro.

- Etapa: P1 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 10 h · Rol: B
- Trazabilidad: B1,RNF-03,RNF-07
- Dependencias: SP-37, SP-29

- [ ] Criterios go/no-go
- [ ] respaldo y rollback
- [ ] registro de inicio para abono USD 2.000 y prueba30 días
- [ ] no desplegar datos reales ni contratar servicios en este TP.

## SP-39 · Gestionar 30 días de prueba y ajustes incluidos

Dar seguimiento a incidencias sin ampliar alcance informalmente.

- Etapa: P1 · Tipo: TASK · Prioridad: P0 · Esfuerzo: 16 h · Rol: A+B
- Trazabilidad: B1,B5
- Dependencias: SP-38

- [ ] Registro de incidencias y severidades
- [ ] defectos/ajustes incluidos sin cargo extra
- [ ] nuevas funciones por cambio de alcance
- [ ] criterios de aceptación del piloto y reporte de cierre.

## SP-40 · Planificar extensión progresiva a cinco centros restantes

Extender solo tras aceptar el piloto.

- Etapa: P1 · Tipo: TASK · Prioridad: P1 · Esfuerzo: 12 h · Rol: A+B
- Trazabilidad: B1,RNF-07
- Dependencias: SP-39

- [ ] Orden por infraestructura y riesgo
- [ ] checklist por centro
- [ ] compatibilidad/reversión
- [ ] responsable y validación
- [ ] fechas posteriores a la aceptación, sin prometer simultaneidad.

