import { Icon, type IconName } from './Icon';

export type EstadoTurno =
  | 'en-espera'
  | 'llamado'
  | 'cancelado-tolerancia'
  | 'ausente'
  | 'contraturno'
  | 'se-retiro'
  | 'no-atendido'
  | 'reprogramado';

const config: Record<EstadoTurno, { etiqueta: string; icono: IconName }> = {
  'en-espera': { etiqueta: 'En espera', icono: 'clock' },
  llamado: { etiqueta: 'Llamado', icono: 'megaphone' },
  'cancelado-tolerancia': { etiqueta: 'Cancelado por tolerancia', icono: 'x-circle' },
  ausente: { etiqueta: 'Ausente', icono: 'user-x' },
  contraturno: { etiqueta: 'Contraturno', icono: 'swap' },
  'se-retiro': { etiqueta: 'Se retiró', icono: 'log-out' },
  'no-atendido': { etiqueta: 'No atendido', icono: 'x-circle' },
  reprogramado: { etiqueta: 'Reprogramado', icono: 'calendar-check' },
};

/** Estados siempre con ícono y texto, nunca solo color. */
export function StatusChip({ estado }: { estado: EstadoTurno }) {
  const { etiqueta, icono } = config[estado];
  return (
    <span className={`chip chip--${estado}`}>
      <Icon name={icono} size={20} />
      {etiqueta}
    </span>
  );
}
