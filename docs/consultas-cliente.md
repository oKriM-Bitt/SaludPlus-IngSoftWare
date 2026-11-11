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

## ¿Qué formato tiene el número de afiliado?

**Contexto.** El caso de estudio y el informe no definen cuántos caracteres tiene el número de afiliado. Hoy el tótem y la secretaría aceptan entre 7 y 11 dígitos, para que entren el DNI (7 u 8 dígitos), el número de afiliado (9 dígitos en los datos de prueba) y el CUIL (11 dígitos). En muchas obras sociales el número de afiliado tiene una parte del titular y dos dígitos más para cada integrante del grupo familiar; si SaludPlus lo usa así, el número identificaría a una sola persona y no haría falta pedir un dato más cuando el número coincide con varias.

**Preguntas**

1. ¿Cuántos caracteres tiene el número de afiliado de SaludPlus? ¿Es siempre igual de largo?
2. ¿Tiene solo números, o también letras, guiones o barras?
3. ¿Incluye un sufijo para cada integrante del grupo familiar (por ejemplo, /00 titular, /01 cónyuge)?
4. ¿Tiene dígito verificador que el sistema pueda controlar?

**Respuesta del cliente:** pendiente.

**Próximo paso.** Con la respuesta, ajustar la validación del tótem y de la secretaría y los datos de prueba.
