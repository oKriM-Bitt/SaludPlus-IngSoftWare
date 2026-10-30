import { Icon } from './Icon';

/** DEV-49: paciente con prioridad, siempre con ícono y texto (nunca solo color). */
export function MarcaPrioridad({ motivo, conMotivo = true }: { motivo: string; conMotivo?: boolean }) {
  return (
    <span className="prioridad" title={`Prioridad: ${motivo}`}>
      <Icon name="flag" size={16} />
      {conMotivo ? `Prioridad · ${motivo}` : 'Prioridad'}
    </span>
  );
}
