import { useState } from 'react';
import { Icon } from './Icon';
import { Alerta } from './Alerta';
import { consultorioPropuesto, elegirConsultorio, opcionesDeConsultorio, PacienteEnAtencionError } from '../servicios/turnos';

type Props = {
  profesionalId: string;
  sucursal: string;
  /** Se llama con el número de consultorio ya guardado. */
  onListo: (numero: string) => void;
};

/**
 * DEV-60: lista de consultorios de la sucursal para elegir dónde atiende hoy.
 * Propone el de la agenda; los que usa otro profesional figuran ocupados.
 */
export function ElegirConsultorio({ profesionalId, sucursal, onListo }: Props) {
  const opciones = opcionesDeConsultorio(profesionalId, sucursal);
  const propuesto = consultorioPropuesto(profesionalId, sucursal);
  const [guardando, setGuardando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const elegir = async (id: string) => {
    setGuardando(id);
    setError(null);
    try {
      onListo(await elegirConsultorio(profesionalId, id, sucursal));
    } catch (e) {
      setError(
        e instanceof PacienteEnAtencionError
          ? `Tiene a ${e.enAtencion.numero} en atención. Finalice la atención antes de cambiar de consultorio.`
          : e instanceof Error && e.name === 'OperacionNoPermitidaError'
            ? e.message
            : 'No se pudo guardar el consultorio. Intente nuevamente.',
      );
    } finally {
      setGuardando(null);
    }
  };

  return (
    <>
      {error && <Alerta tono="error" titulo={error} />}
      <ul className="elegir-consultorio">
        {[...opciones]
          .sort((a, b) => Number(b.consultorio.id === propuesto) - Number(a.consultorio.id === propuesto))
          .map(({ consultorio, ocupadoPor, agenda }) => (
            <li key={consultorio.id}>
              <button
                type="button"
                className={`elegir-consultorio__opcion ${consultorio.id === propuesto ? 'elegir-consultorio__opcion--propuesto' : ''}`}
                disabled={!!ocupadoPor || guardando !== null}
                aria-busy={guardando === consultorio.id || undefined}
                onClick={() => elegir(consultorio.id)}
              >
                <Icon name="user-check" size={26} />
                <span>
                  <strong>Consultorio {consultorio.numero}</strong>
                  <span>
                    {ocupadoPor ? `Ocupado · ${ocupadoPor}` : consultorio.id === propuesto ? (agenda ? 'Propuesto · el de su agenda de hoy' : 'Propuesto') : agenda ? 'El de su agenda de hoy' : 'Libre'}
                  </span>
                </span>
                {guardando === consultorio.id ? <span className="spinner" aria-hidden="true" /> : !ocupadoPor && <Icon name="arrow-right" size={22} />}
              </button>
            </li>
          ))}
      </ul>
    </>
  );
}
