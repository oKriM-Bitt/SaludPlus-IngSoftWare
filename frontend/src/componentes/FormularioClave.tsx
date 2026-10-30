import { useState, type FormEvent } from 'react';
import { Icon } from './Icon';
import { Button } from './Button';
import { LARGO_MINIMO, problemaConClave } from '../servicios/claves';
import { cambiarClave } from '../servicios/sesion';

type Props = {
  usuario: string;
  pedirActual: boolean; // false en el cambio obligatorio después de un restablecimiento
  textoBoton?: string;
  onListo: () => void;
};

/** #79: cambio de contraseña con las reglas a la vista. */
export function FormularioClave({ usuario, pedirActual, textoBoton = 'Guardar contraseña', onListo }: Props) {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ver, setVer] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ campo: 'actual' | 'nueva' | 'repetida'; texto: string } | null>(null);

  const reglas = [
    { ok: nueva.length >= LARGO_MINIMO, texto: `Al menos ${LARGO_MINIMO} caracteres` },
    { ok: /[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nueva) && /\d/.test(nueva), texto: 'Letras y números' },
    { ok: !!nueva && !nueva.toLowerCase().includes(usuario.toLowerCase()), texto: 'Sin el nombre de usuario' },
  ];

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (pedirActual && !actual) return setError({ campo: 'actual', texto: 'Ingrese su contraseña actual.' });
    const problema = problemaConClave(nueva, usuario);
    if (problema) return setError({ campo: 'nueva', texto: problema });
    if (nueva !== repetida) return setError({ campo: 'repetida', texto: 'Las contraseñas no coinciden.' });
    setError(null);
    setEnviando(true);
    const r = await cambiarClave(usuario, pedirActual ? actual : null, nueva);
    setEnviando(false);
    if (r.ok) onListo();
    else setError({ campo: r.campo, texto: r.mensaje });
  };

  const tipo = ver ? 'text' : 'password';
  const campo = (id: 'actual' | 'nueva' | 'repetida', etiqueta: string, valor: string, cambiar: (v: string) => void, autocompletar: string) => (
    <div className="campo">
      <label htmlFor={`clave-${id}`}>{etiqueta}</label>
      <input
        id={`clave-${id}`}
        type={tipo}
        className={`input ${error?.campo === id ? 'input--error' : ''}`}
        autoComplete={autocompletar}
        value={valor}
        aria-invalid={error?.campo === id}
        aria-describedby={error?.campo === id ? 'clave-error' : id === 'nueva' ? 'clave-reglas' : undefined}
        onChange={(e) => {
          cambiar(e.target.value);
          if (error?.campo === id) setError(null);
        }}
      />
    </div>
  );

  return (
    <form className="form-clave" onSubmit={enviar} noValidate>
      {pedirActual && campo('actual', 'Contraseña actual', actual, setActual, 'current-password')}
      {campo('nueva', 'Contraseña nueva', nueva, setNueva, 'new-password')}
      <ul id="clave-reglas" className="form-clave__reglas">
        {reglas.map((r) => (
          <li key={r.texto} className={r.ok ? 'form-clave__regla--ok' : ''}>
            <Icon name={r.ok ? 'check-circle' : 'info'} size={18} /> {r.texto}
            <span className="visually-hidden">{r.ok ? ': cumplido' : ': pendiente'}</span>
          </li>
        ))}
      </ul>
      {campo('repetida', 'Repita la contraseña nueva', repetida, setRepetida, 'new-password')}
      <label className="form-clave__ver">
        <input type="checkbox" checked={ver} onChange={(e) => setVer(e.target.checked)} /> Mostrar contraseñas
      </label>
      {error && (
        <p id="clave-error" className="campo__error" role="alert">
          <Icon name="x-circle" size={18} /> {error.texto}
        </p>
      )}
      <Button type="submit" className="form-clave__btn" icon={<Icon name="key" size={22} />} loading={enviando}>
        {enviando ? 'Guardando…' : textoBoton}
      </Button>
    </form>
  );
}
