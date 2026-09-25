# SaludPlus
Proyecto académico de Ingeniería de Software: sistema de turnos, admisión y sala de espera para seis centros médicos.

Se trabaja como un equipo proveedor dentro de una simulación comercial. No hay contratos, compras ni despliegues productivos reales comprometidos por este repositorio.

## Estado
Etapa actual: documentación y planificación. La aplicación todavía no está implementada. Las tareas abiertas representan trabajo pendiente, no avances ya realizados.

## Documentación
- [Fundamentación por criterio](docs/fundamentacion.md)
- [Plan de trabajo y cronograma](docs/plan-de-trabajo.md)
- [Alcance y decisiones pendientes](docs/alcance.md)
- [Requerimientos y trazabilidad](docs/requerimientos.md)
- [Guía de trabajo](CONTRIBUTING.md)

## Stack propuesto
React + TypeScript + Vite, vite-plugin-pwa, NestJS, PostgreSQL, Socket.IO y Render.
Los recordatorios se programarán desde NestJS mediante la API oficial de WhatsApp de Meta. No se utilizarán Twilio ni n8n.
PostgreSQL no tiene costo de licencia para este uso. El alojamiento, administración y soporte son conceptos distintos.

## Gestión
Seis sprints de dos semanas. Las fechas se expresan en semanas relativas hasta acordar el inicio.
Cada issue incluye objetivo, alcance, criterios de aceptación, prioridad, esfuerzo estimado, rol y dependencias.
La capacitación y la prueba operativa posteriores se planifican por separado.

## Datos y autoría
Utilizar exclusivamente datos ficticios en desarrollo y demostraciones. No subir credenciales, datos personales reales ni archivos .env.
Registrar herramientas de IA, resultados utilizados, revisiones y decisiones propias. Todos los integrantes deben poder explicar y modificar el trabajo.

## Enlaces de trabajo
- [Issues](https://github.com/oKriM-Bitt/SaludPlus-IngSoftWare/issues)
- [Hitos](https://github.com/oKriM-Bitt/SaludPlus-IngSoftWare/milestones)
- [Backlog detallado](docs/backlog.md)

Equipo: **oKriM-Bitt** y **zaymaite**. Responsabilidades nominales propuestas y revisión cruzada; confirmar disponibilidad antes de iniciar.

