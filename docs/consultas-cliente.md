# Consultas pendientes al cliente

Preguntas que el equipo necesita que SaludPlus responda antes de programar. Cuando haya respuesta, se registra acá con la fecha y se crea o ajusta la historia de usuario.

## #76 · ¿Hay que validar que la afiliación esté vigente?

**Contexto.** SaludPlus es una obra social. Hoy el tótem identifica al paciente por DNI o número de afiliado y verifica que tenga un turno del día, pero no controla si la afiliación está activa.

**Preguntas**

1. ¿El tótem y la secretaría deben avisar cuando la afiliación del paciente está dada de baja o suspendida?
2. Si no está vigente, ¿qué debe pasar?
   - a) No se registra la llegada y se lo deriva a secretaría.
   - b) Se registra igual, con un aviso para la secretaría.
   - c) Se atiende como particular (fuera del alcance: no hay facturación).
3. ¿El sistema de turnos del proveedor informa el estado de la afiliación, o hay que consultarlo en otro sistema? ¿Con qué permisos?
4. ¿Qué texto debe ver el paciente en el tótem? No debe exponer datos sensibles frente a otras personas.

**Respuesta del cliente:** pendiente.

**Próximo paso.** Con la respuesta, crear la historia de usuario (si corresponde) y cerrar #76.
