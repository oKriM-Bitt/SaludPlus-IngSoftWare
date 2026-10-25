import type { Turno } from '../../servicios/turnos';

const hora = (d: Date) => d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

export function TurnoDetalle({ turno }: { turno: Turno }) {
  return (
    <dl className="turno-card">
      <dt className="visually-hidden">Paciente</dt>
      <dd className="turno-card__paciente">{turno.paciente}</dd>
      <dt>Profesional</dt>
      <dd>{turno.profesional}</dd>
      <dt>Especialidad</dt>
      <dd>{turno.especialidad}</dd>
      <dt>Hora del turno</dt>
      <dd>{hora(turno.horario)}</dd>
      <dt>Consultorio</dt>
      <dd>{turno.consultorio}</dd>
    </dl>
  );
}
