import { Icon } from './Icon';

export type EstadoTurno = 'en-espera' | 'llamado' | 'cancelado-tolerancia' | 'ausente' | 'contraturno';

const etiquetas: Record<EstadoTurno, string> = {
  'en-espera': 'En espera',
  llamado: 'Llamado',
  'cancelado-tolerancia': 'Cancelado por tolerancia',
  ausente: 'Ausente',
  contraturno: 'Contraturno',
};

export function StatusChip({ estado }: { estado: EstadoTurno }) {
  return (
    <span className={`chip chip--${estado}`}>
      {estado === 'en-espera' && <Icon name="clock" size={20} />}
      {estado === 'llamado' && <Icon name="megaphone" size={20} />}
      {etiquetas[estado]}
    </span>
  );
}
