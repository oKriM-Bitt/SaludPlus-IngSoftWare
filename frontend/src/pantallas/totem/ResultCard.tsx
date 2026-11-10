import { StatusChip } from '../../componentes/StatusChip';
import { Icon } from '../../componentes/Icon';
import { esperaDe, sinProfesional, type Admision } from '../../servicios/turnos';
import { textoEspera } from '../../servicios/espera';
import { hora } from '../../utilidades/fechas';

export function ResultCard({ admision }: { admision: Admision }) {
  // DEV-33: la demanda espontánea del tótem todavía no tiene consultorio ni espera estimada.
  if (sinProfesional(admision)) {
    return (
      <div className="result-card">
        <div className="result-card__top">
          <span className="result-card__numero">{admision.numero}</span>
          <StatusChip estado="en-espera" />
        </div>
        <span className="result-card__consultorio">{admision.servicio ?? 'Demanda espontánea'}</span>
        <span className="result-card__espera">
          <Icon name="info" size={28} />
          <span>Sin turno previo. La secretaría le asignará un profesional.</span>
        </span>
      </div>
    );
  }

  // #46: espera estimada al registrar la llegada.
  const { pacientesAntes, minutos } = esperaDe(admision);
  // Llegó con mucha anticipación: lo llaman cerca del horario de su turno, no antes.
  const faltan = (new Date(admision.horaTurno).getTime() - Date.now()) / 60_000;
  const temprano = faltan > minutos + 15;
  return (
    <div className="result-card">
      <div className="result-card__top">
        <span className="result-card__numero">{admision.numero}</span>
        <StatusChip estado="en-espera" />
      </div>
      <span className="result-card__consultorio">Consultorio {admision.consultorio}</span>
      {admision.estado === 'en-espera' && (
        <span className="result-card__espera">
          <Icon name="clock" size={28} />
          <span>
            {temprano ? (
              <>
                Llegó con anticipación. Lo llamarán cerca de las <strong>{hora(new Date(admision.horaTurno))}</strong>.
              </>
            ) : (
              <>
                Espera estimada: <strong>{textoEspera(minutos).toLowerCase()}</strong>
              </>
            )}
            <br />
            {pacientesAntes === 0 ? 'Usted es el próximo paciente.' : pacientesAntes === 1 ? '1 paciente antes que usted.' : `${pacientesAntes} pacientes antes que usted.`}
          </span>
        </span>
      )}
    </div>
  );
}
