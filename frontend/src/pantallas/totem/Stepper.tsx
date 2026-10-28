// #43: se agregó el paso "Servicio" antes del ingreso del número.
const pasos = ['Servicio', 'Ingreso', 'Confirmación', 'Resultado'];

export type PasoStepper = 1 | 2 | 3 | 4;

/** actual: del 1 al 4. Los pasos anteriores al actual quedan completos. */
export function Stepper({ actual }: { actual: PasoStepper }) {
  return (
    <ol className="stepper" aria-label={`Paso ${actual} de ${pasos.length}`}>
      {pasos.map((nombre, i) => {
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
