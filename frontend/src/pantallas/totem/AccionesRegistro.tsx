import { useEffect, useState } from 'react';
import { Button } from '../../componentes/Button';
import { Icon } from '../../componentes/Icon';
import { deshacerLlegada, esperaDe, puedeDeshacer, SEGUNDOS_PARA_DESHACER, sinProfesional, SinConexionError, type Admision } from '../../servicios/turnos';
import { datosTicket, prepararImpresion, yaImpreso, type ResultadoImpresion } from '../../servicios/ticket';

type Props = {
  admision: Admision;
  /** true en la pantalla "Llegada registrada": solo ahí se puede deshacer. */
  recienRegistrada: boolean;
  onDeshecho: () => void;
};

const MENSAJE_IMPRESION: Record<Exclude<ResultadoImpresion, 'ok'>, string> = {
  'ya-impreso': 'El ticket de esta llegada ya se imprimió.',
  'sin-papel': 'La impresora no tiene papel. Recuerde su número: lo ve en la pantalla.',
  error: 'No pudimos imprimir el ticket. Recuerde su número: lo ve en la pantalla.',
};

const segundosRestantes = (a: Admision) => Math.max(0, Math.ceil(SEGUNDOS_PARA_DESHACER - (Date.now() - new Date(a.registradaEn).getTime()) / 1000));

/** DEV-53 y DEV-48: deshacer el registro unos segundos e imprimir el ticket solo si lo pide. */
export function AccionesRegistro({ admision, recienRegistrada, onDeshecho }: Props) {
  const [segundos, setSegundos] = useState(() => (recienRegistrada ? segundosRestantes(admision) : 0));
  const [deshaciendo, setDeshaciendo] = useState(false);
  const [errorDeshacer, setErrorDeshacer] = useState<string | null>(null);
  const [impreso, setImpreso] = useState(() => yaImpreso(admision));
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = window.setInterval(() => setSegundos(segundosRestantes(admision)), 500);
    return () => window.clearInterval(t);
  }, [admision, segundos]);

  const deshacer = async () => {
    setDeshaciendo(true);
    setErrorDeshacer(null);
    try {
      await deshacerLlegada(admision);
      onDeshecho();
    } catch (e) {
      setErrorDeshacer(e instanceof SinConexionError ? 'No hay conexión. Acérquese a secretaría para corregir el registro.' : 'Ya no se puede deshacer. Acérquese a secretaría.');
      setSegundos(0);
      setDeshaciendo(false);
    }
  };

  const imprimir = () => {
    const r = prepararImpresion(admision);
    if (r !== 'ok') {
      setAviso(MENSAJE_IMPRESION[r]);
      if (r === 'ya-impreso') setImpreso(true);
      return;
    }
    setImpreso(true);
    setAviso('Retire su ticket de la impresora.');
    window.print();
  };

  const espera = sinProfesional(admision) ? null : esperaDe(admision).minutos;
  const ticket = datosTicket(admision, espera);
  const sePuedeDeshacer = recienRegistrada && segundos > 0 && puedeDeshacer(admision);

  return (
    <div className="totem__registro-acciones">
      <Button variant="secondary" icon={<Icon name="printer" size={28} />} disabled={impreso} onClick={imprimir}>
        {impreso ? 'Ticket impreso' : 'Imprimir ticket'}
      </Button>
      {aviso && (
        <p className="totem__small totem__aviso-impresion" role="status">
          {aviso}
        </p>
      )}

      {recienRegistrada &&
        (sePuedeDeshacer ? (
          <Button variant="secondary" className="totem__equivoque" icon={<Icon name="undo" size={28} />} loading={deshaciendo} onClick={deshacer}>
            Me equivoqué ({segundos} s)
          </Button>
        ) : (
          <p className="totem__small" role="status">
            {errorDeshacer ?? 'Si se equivocó, acérquese a secretaría para corregir el registro.'}
          </p>
        ))}

      {/* Solo se ve al imprimir: número, destino, llegada y espera. Sin nombre ni datos de salud. */}
      <div className="ticket-impresion" aria-hidden="true">
        <strong>SaludPlus</strong>
        <span className="ticket-impresion__numero">{ticket.numero}</span>
        <span>{ticket.destino}</span>
        <span>Llegada: {ticket.llegada}</span>
        <span>Espera estimada: {ticket.espera.toLowerCase()}</span>
        <small>Mire la pantalla de la sala. Conserve este ticket.</small>
      </div>
    </div>
  );
}
