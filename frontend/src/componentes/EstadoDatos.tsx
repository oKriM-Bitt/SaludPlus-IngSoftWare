import { Icon } from './Icon';
import { hora } from '../utilidades/fechas';

type Props = {
  sinConexion: boolean;
  /** Hora de los últimos datos recibidos. */
  actualizadoEn: Date | null;
  className?: string;
};

/**
 * #91: en lugar de "Conectado", el encabezado dice hasta qué hora están al día los datos.
 * Con conexión es un texto discreto ("Actualizado 10:32"); sin conexión pasa a ser un aviso
 * con ícono y texto, así no depende solo del color.
 */
export function EstadoDatos({ sinConexion, actualizadoEn, className = '' }: Props) {
  if (sinConexion) {
    return (
      <span className={`estado-datos estado-datos--sin-conexion ${className}`} role="status">
        <Icon name="wifi-off" size={20} />
        {actualizadoEn ? `Sin conexión · datos de las ${hora(actualizadoEn)}` : 'Sin conexión'}
      </span>
    );
  }
  return (
    <span className={`estado-datos ${className}`} role="status" title="Los datos se actualizan solos cada pocos segundos.">
      <Icon name="clock" size={18} />
      {actualizadoEn ? `Actualizado ${hora(actualizadoEn)}` : 'Actualizando…'}
    </span>
  );
}
