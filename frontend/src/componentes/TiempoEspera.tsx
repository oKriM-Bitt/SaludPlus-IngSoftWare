import { Icon } from './Icon';
import { esEsperaLarga } from '../servicios/espera';

/** Minutos de espera con ícono; las esperas largas se marcan con color y con texto. */
export function TiempoEspera({ minutos, className = '' }: { minutos: number; className?: string }) {
  const larga = esEsperaLarga(minutos);
  return (
    <span className={`espera ${larga ? 'espera--larga' : ''} ${className}`}>
      <Icon name="clock" size={18} />
      {minutos} min
      {larga && <span className="espera__aviso">· espera larga</span>}
    </span>
  );
}
