import type { ReactNode } from 'react';
import { Icon, type IconName } from './Icon';

type Tono = 'success' | 'warning' | 'error' | 'info';

const iconos: Record<Tono, IconName> = {
  success: 'check-circle',
  warning: 'alert-triangle',
  error: 'x-circle',
  info: 'info',
};

type AlertaProps = { tono: Tono; titulo: string; children?: ReactNode; className?: string; accion?: ReactNode };

export function Alerta({ tono, titulo, children, className = '', accion }: AlertaProps) {
  return (
    <div className={`alerta alerta--${tono} ${className}`} role={tono === 'error' || tono === 'warning' ? 'alert' : 'status'}>
      <Icon name={iconos[tono]} size={24} />
      <div className="alerta__texto">
        <span className="alerta__titulo">{titulo}</span>
        {children && <span>{children}</span>}
        {accion}
      </div>
    </div>
  );
}
