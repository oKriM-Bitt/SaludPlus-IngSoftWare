type KeypadProps = {
  onDigit: (d: string) => void;
  onClear: () => void;
  onBackspace: () => void;
};

const digitos = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

export function Keypad({ onDigit, onClear, onBackspace }: KeypadProps) {
  return (
    <div className="keypad" role="group" aria-label="Teclado numérico">
      {digitos.map((d) => (
        <button key={d} type="button" className="keypad__key" onClick={() => onDigit(d)}>
          {d}
        </button>
      ))}
      <button type="button" className="keypad__key keypad__key--text" onClick={onClear} aria-label="Borrar todo">
        Borrar
      </button>
      <button type="button" className="keypad__key" onClick={() => onDigit('0')}>
        0
      </button>
      <button type="button" className="keypad__key keypad__key--text" onClick={onBackspace} aria-label="Corregir último número">
        Corregir
      </button>
    </div>
  );
}
