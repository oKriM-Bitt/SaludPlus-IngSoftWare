import { StatusChip } from '../../componentes/StatusChip';
import { Icon } from '../../componentes/Icon';
import { esperaDe, type Admision } from '../../servicios/turnos';
import { textoEspera } from '../../servicios/espera';

export function ResultCard({ admision }: { admision: Admision }) {
  // #46: espera estimada al registrar la llegada.
  const { pacientesAntes, minutos } = esperaDe(admision);
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
            Espera estimada: <strong>{textoEspera(minutos).toLowerCase()}</strong>
            <br />
            {pacientesAntes === 0 ? 'Usted es el próximo paciente.' : pacientesAntes === 1 ? '1 paciente antes que usted.' : `${pacientesAntes} pacientes antes que usted.`}
          </span>
        </span>
      )}
    </div>
  );
}
