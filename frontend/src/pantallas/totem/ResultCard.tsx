import { StatusChip } from '../../componentes/StatusChip';
import type { Admision } from '../../servicios/turnos';

export function ResultCard({ admision }: { admision: Admision }) {
  return (
    <div className="result-card">
      <div className="result-card__top">
        <span className="result-card__numero">{admision.numero}</span>
        <StatusChip estado="en-espera" />
      </div>
      <span className="result-card__consultorio">Consultorio {admision.consultorio}</span>
    </div>
  );
}
