# Fundamentación por criterio

## Costo
SaludPlus asumirá la inversión necesaria para implementar y operar el sistema en sus seis centros médicos. La propuesta comercial contempla un abono mensual de USD 2.000 para la red completa de seis centros, equivalente a USD 24.000 por doce meses completos. La facturación comenzará a partir del primer despliegue operativo en el centro piloto, aunque la extensión al resto de los centros sea progresiva. La ausencia de cargos adicionales por ajustes durante la prueba no suspende este abono.

Como alcance propuesto del abono se incluyen soporte, mantenimiento correctivo, acompañamiento y administración de la operación. El contrato deberá confirmar si también comprende el desarrollo inicial, los cargos de alojamiento y los consumos de notificaciones; hasta entonces, no se presentarán como incluidos sin límite. El equipamiento, la conectividad y los consumos de terceros deberán identificarse como incluidos o adicionales, evitando confundir el precio ofrecido al cliente con los costos internos del proveedor.

React, TypeScript, Vite, NestJS y PostgreSQL no requieren adquirir licencias para el uso propuesto. En particular, PostgreSQL es gratuito; un eventual cargo correspondería a infraestructura o administración del servicio, no a una licencia de la base de datos.

La propuesta prioriza disponibilidad, protección de la información, mantenimiento y recuperación ante fallas. Se realizará una semana de capacitación por perfiles antes del inicio de la prueba del primer centro. Durante los primeros 30 días de prueba se corregirán sin cargo adicional los defectos y se realizarán ajustes dentro del alcance acordado. Los pedidos de nuevas funcionalidades se analizarán mediante el procedimiento de gestión de cambios.

## Curva de aprendizaje del equipo
Se propone utilizar TypeScript tanto en frontend como en backend para reducir la diversidad de lenguajes y facilitar la colaboración. React permitirá reutilizar componentes entre las interfaces del paciente, secretaría, profesional y sala de espera. NestJS aportará una organización por módulos que facilite comprender y mantener las reglas del sistema.

El equipo estará integrado por dos personas con responsabilidades principales de análisis/frontend y backend/infraestructura, con revisión cruzada y dominio compartido del proyecto. Durante las primeras dos semanas se realizará un diagnóstico de conocimientos y pruebas técnicas breves sobre PWA, autenticación, Socket.IO e integración con servicios externos. La planificación se ajustará a los resultados. No se presupone experiencia que el equipo todavía no haya demostrado.

Figma y Stitch se utilizarán para explorar y validar interfaces. Los resultados generados se revisarán y adaptarán a accesibilidad, identidad visual y reglas del caso. Cada integrante deberá comprender el código incorporado y las decisiones adoptadas.

## Tiempo de desarrollo
Se estima un plazo de tres meses, planificado como 12 semanas de desarrollo y seis sprints de dos semanas. La estimación corresponde a una primera versión con alcance acordado, no a la resolución de todos los pedidos posibles del cliente.

El primer mes se destinará al análisis, alcance, diseño de interfaces, arquitectura y base técnica. El segundo mes se enfocará en el circuito principal: validación del turno, registro de llegada, cola de espera, llamado y visualización en sala. El tercer mes incorporará recordatorios, indicadores, pruebas integrales, documentación y preparación del despliegue.

Cada sprint concluirá con una revisión de los entregables y una retrospectiva. Las validaciones con el Director Médico se realizarán por videollamada y las pruebas de uso incluirán representantes de secretaría, médicos y pacientes.

Después del desarrollo se prevé una semana de capacitación y preparación del centro piloto. A continuación comenzará un período de prueba de 30 días, contado desde su primer despliegue operativo. Estos períodos son adicionales a las 12 semanas de construcción. El avance hacia los demás centros dependerá de los criterios de aceptación y estabilidad del piloto.

El plazo supone disponibilidad del equipo, acceso oportuno a documentación de la API, decisiones del cliente y equipamiento adecuado. Cambios de alcance o demoras externas se evaluarán con su impacto en fechas, costo y prioridades.

## Mantenimiento posterior
Durante la puesta en marcha y la prueba, el equipo proveedor atenderá incidencias y ajustes acordados. Posteriormente se propone que el proveedor mantenga el software y acompañe al Área de Sistemas de SaludPlus, que administrará usuarios, equipos y tareas operativas según la distribución establecida en el contrato.

Se entregarán repositorio, documentación de arquitectura y API, instrucciones de despliegue, manuales de usuario, procedimientos de respaldo y recuperación, y guía de resolución de incidentes. El nivel de servicio deberá definir horario de soporte, severidades, tiempos de respuesta y escalamiento, sin prometer atención permanente antes de acordarla.

## Restricciones impuestas por el cliente
Conectividad: la operación debe continuar durante cortes de internet. La instalación de una PWA por sí sola no mantiene una cola compartida entre dispositivos. Durante el primer sprint se validará una solución local con sincronización y su alcance. El despliegue público en Render no se considerará evidencia de funcionamiento offline.

Dispositivos y accesibilidad: se ofrecerán interfaces específicas para tótem, secretaría, médico y pantalla de sala. El paciente no necesitará un smartphone. Se comprobarán navegación por teclado, contraste y legibilidad a ocho metros en las condiciones del centro.

Integración obligatoria: se conservará el módulo de turnos del proveedor. La API limitada de consulta se encapsulará en un adaptador. Cancelaciones y reprogramaciones se gestionarán mediante el circuito autorizado del proveedor; no se prometerá escribir cambios mediante una API de solo lectura.

Datos: el sistema se limitará a la información necesaria para gestionar la atención. Se diseñarán permisos por rol y centro, auditoría de accesos, gestión de sesiones y reglas de retención acordadas con Auditoría/Legales. La demostración utilizará datos ficticios.

Continuidad del servicio: los despliegues serán progresivos y tendrán criterios de avance, compatibilidad y reversión. No se trasladará el piloto a los seis centros si persisten fallas que comprometan la atención.

Notificaciones: NestJS programará recordatorios y se integrará directamente con WhatsApp Business Platform de Meta. Se requerirán acceso autorizado, plantillas aprobadas, destinatarios habilitados y registro de resultados. El costo por envío y las condiciones se cotizarán por separado o se incluirán con un límite explícito dentro del abono.

