import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { CredencialesError, iniciarSesion, INACTIVIDAD_MINUTOS, useUsuario } from '../../servicios/sesion';
import { CLAVE_DEMO, ETIQUETA_ROL, puedeAcceder, USUARIOS_DEMO } from '../../servicios/usuarios';
import './ingreso.css';

/** Inicio de sesión del personal (#47). El tótem y la sala no lo requieren. */
export function IngresoPage() {
  const usuarioActual = useUsuario();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ campo?: 'usuario' | 'clave'; texto: string } | null>(null);
  const campoUsuario = useRef<HTMLInputElement>(null);

  useEffect(() => campoUsuario.current?.focus(), []);

  const volver = params.get('volver');
  const destino = (rutaVolver: string | null, u: NonNullable<typeof usuarioActual>) =>
    rutaVolver && rutaVolver.startsWith('/') && puedeAcceder(u, rutaVolver.split('?')[0]) ? rutaVolver : '/inicio';

  if (usuarioActual && !enviando) return <Navigate to={destino(volver, usuarioActual)} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) return setError({ campo: 'usuario', texto: 'Ingrese su usuario.' });
    if (!clave) return setError({ campo: 'clave', texto: 'Ingrese su contraseña.' });
    setError(null);
    setEnviando(true);
    try {
      const u = await iniciarSesion(usuario, clave);
      navegar(destino(volver, u), { replace: true });
    } catch (err) {
      setClave('');
      setError({
        texto:
          err instanceof CredencialesError
            ? 'Usuario o contraseña incorrectos. Revise los datos e intente nuevamente.'
            : 'No pudimos iniciar sesión. Intente nuevamente en unos segundos.',
      });
    } finally {
      setEnviando(false);
    }
  };

  const motivo = params.get('motivo');

  return (
    <div className="ingreso">
      <main className="ingreso__card">
        <Logo size={48} />
        <div>
          <h1>Ingreso del personal</h1>
          <p className="ingreso__lead">Admisión, consultorios y dirección del centro.</p>
        </div>

        {motivo === 'inactividad' && (
          <Alerta tono="info" titulo="La sesión se cerró por inactividad">
            Pasaron {INACTIVIDAD_MINUTOS} minutos sin uso. Ingrese nuevamente.
          </Alerta>
        )}
        {volver && !motivo && !error && <Alerta tono="info" titulo="Inicie sesión para continuar" />}
        {error && !error.campo && <Alerta tono="error" titulo={error.texto} />}

        <form className="ingreso__form" onSubmit={enviar} noValidate>
          <div className="campo">
            <label htmlFor="ing-usuario">Usuario</label>
            <input
              ref={campoUsuario}
              id="ing-usuario"
              className={`input ${error?.campo === 'usuario' ? 'input--error' : ''}`}
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={usuario}
              aria-invalid={error?.campo === 'usuario'}
              aria-describedby={error?.campo === 'usuario' ? 'ing-error' : undefined}
              onChange={(e) => {
                setUsuario(e.target.value);
                if (error?.campo === 'usuario') setError(null);
              }}
            />
          </div>
          <div className="campo">
            <label htmlFor="ing-clave">Contraseña</label>
            <div className="ingreso__clave">
              <input
                id="ing-clave"
                type={verClave ? 'text' : 'password'}
                className={`input ${error?.campo === 'clave' ? 'input--error' : ''}`}
                autoComplete="current-password"
                value={clave}
                aria-invalid={error?.campo === 'clave'}
                aria-describedby={error?.campo === 'clave' ? 'ing-error' : undefined}
                onChange={(e) => {
                  setClave(e.target.value);
                  if (error?.campo === 'clave') setError(null);
                }}
              />
              <button type="button" className="ingreso__ver" aria-pressed={verClave} onClick={() => setVerClave((v) => !v)}>
                {verClave ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          {error?.campo && (
            <p id="ing-error" className="campo__error" role="alert">
              <Icon name="x-circle" size={18} /> {error.texto}
            </p>
          )}
          <Button type="submit" className="ingreso__btn" icon={<Icon name="lock" size={24} />} loading={enviando}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </Button>
        </form>

        <p className="ingreso__nota">
          <Icon name="info" size={20} />
          La sesión se cierra sola después de {INACTIVIDAD_MINUTOS} minutos sin uso. El tótem y la pantalla de sala no necesitan usuario.
        </p>

        <details className="ingreso__demo">
          <summary>Usuarios de prueba (datos ficticios)</summary>
          <p>
            Contraseña para todos: <code>{CLAVE_DEMO}</code>
          </p>
          <ul>
            {USUARIOS_DEMO.map((u) => (
              <li key={u.usuario}>
                <button
                  type="button"
                  className="ingreso__usar"
                  onClick={() => {
                    setUsuario(u.usuario);
                    setClave(CLAVE_DEMO);
                    setError(null);
                  }}
                >
                  <code>{u.usuario}</code>
                  <span>
                    {u.nombre} · {ETIQUETA_ROL[u.rol]}
                    {u.consultorio ? ` · consultorio ${u.consultorio}` : ''}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </details>
      </main>
    </div>
  );
}
