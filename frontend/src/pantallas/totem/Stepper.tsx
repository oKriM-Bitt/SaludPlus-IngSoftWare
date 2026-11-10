// #43: se agregó el paso "Servicio" antes del ingreso del número.
const pasos = ['Servicio', 'Ingreso', 'Confirmación', 'Resultado'];

export type PasoStepper = 1 | 2 | 3 | 4;

/**
 * actual: del 1 al 4. Los pasos anteriores al actual quedan completos.
 * Con turno no se elige servicio (el turno ya lo tiene): se muestran 3 pasos.
 */
export function Stepper({ actual: actualCompleto, conServicio = true }: { actual: PasoStepper; conServicio?: boolean }) {
  const lista = conServicio ? pasos : pasos.slice(1);
  const actual = conServicio ? actualCompleto : Math.max(1, actualCompleto - 1);
  return (
    <ol className="stepper" style={{ gridTemplateColumns: `repeat(${lista.length}, 1fr)` }} aria-label={`Paso ${actual} de ${lista.length}`}>
      {lista.map((nombre, i) => {
        const n = i + 1;
        const estado = n < actual ? 'completo' : n === actual ? 'actual' : 'pendiente';
        return (
          <li key={nombre} className={`stepper__item stepper__item--${estado}`} aria-current={n === actual ? 'step' : undefined}>
            <span className="stepper__bar" aria-hidden="true" />
            <span className="stepper__label">
              {n}. {nombre}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
