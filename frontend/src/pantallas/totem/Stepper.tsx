const pasos = ['Ingreso', 'Confirmación', 'Resultado'];

/** actual: 1, 2 o 3. Los pasos anteriores al actual quedan completos. */
export function Stepper({ actual }: { actual: 1 | 2 | 3 }) {
  return (
    <ol className="stepper" aria-label={`Paso ${actual} de 3`}>
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
