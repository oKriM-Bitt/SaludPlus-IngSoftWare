import { Icon, type IconName } from './Icon';

export type EstadoTurno = 'en-espera' | 'llamado' | 'cancelado-tolerancia' | 'ausente' | 'contraturno';

const config: Record<EstadoTurno, { etiqueta: string; icono: IconName }> = {
  'en-espera': { etiqueta: 'En espera', icono: 'clock' },
  llamado: { etiqueta: 'Llamado', icono: 'megaphone' },
  'cancelado-tolerancia': { etiqueta: 'Cancelado por tolerancia', icono: 'x-circle' },
  ausente: { etiqueta: 'Ausente', icono: 'user-x' },
  contraturno: { etiqueta: 'Contraturno', icono: 'swap' },
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
