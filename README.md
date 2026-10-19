# SaludPlus
Proyecto académico de Ingeniería de Software: sistema de turnos, admisión y sala de espera para seis centros médicos.

Se trabaja como un equipo proveedor dentro de una simulación comercial. No hay contratos, compras ni despliegues productivos reales comprometidos por este repositorio.

## Estado
Etapa actual: desarrollo del frontend con datos simulados. Ya están el tótem de autogestión (`/totem`) y la vista del profesional (`/profesional`). Faltan el panel de secretaría, la pantalla de sala y el backend. Las tareas abiertas representan trabajo pendiente, no avances ya realizados.

## Código
- [`frontend/`](frontend/README.md): React + TypeScript + Vite. Para correrlo: `cd frontend`, `npm install`, `npm run dev`.

## Documentación
- [Fundamentación por criterio](docs/fundamentacion.md)
- [Plan de trabajo y cronograma](docs/plan-de-trabajo.md)
- [Alcance y decisiones pendientes](docs/alcance.md)
- [Requerimientos y trazabilidad](docs/requerimientos.md)
- [Guía de trabajo](CONTRIBUTING.md)

## Stack propuesto
React + TypeScript + Vite, vite-plugin-pwa, NestJS, PostgreSQL, Socket.IO y Render.
El sistema interviene desde que el paciente llega al centro y verifica su turno en el tótem. La reserva, reprogramación y cancelación de turnos quedan en el sistema del proveedor, y no se envían recordatorios.
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

