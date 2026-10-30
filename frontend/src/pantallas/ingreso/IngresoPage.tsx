import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../componentes/Logo';
import { Icon, type IconName } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { CredencialesError, iniciarSesion, INACTIVIDAD_MINUTOS, useUsuario } from '../../servicios/sesion';
import { CLAVE_DEMO, ETIQUETA_ROL, puedeAcceder, USUARIOS_DEMO, type Usuario } from '../../servicios/usuarios';
import './ingreso.css';

const BENEFICIOS: { icono: IconName; titulo: string; texto: string }[] = [
  { icono: 'users', titulo: 'Admisión', texto: 'La cola del centro en tiempo real, sin listados en papel.' },
  { icono: 'user-check', titulo: 'Consultorios', texto: 'Llamar al próximo paciente con un toque.' },
  { icono: 'monitor', titulo: 'Sala de espera', texto: 'Número, consultorio y espera estimada a la vista.' },
];

/** Un usuario de prueba por rol para el ingreso rápido de la demo. */
const ACCESOS_RAPIDOS = (['secretaria', 'profesional', 'direccion'] as const).map((rol) => USUARIOS_DEMO.find((u) => u.rol === rol)!);

/** Inicio de sesión del personal (#47, rediseño #80). El tótem y la sala no lo requieren. */
export function IngresoPage() {
  const usuarioActual = useUsuario();
  const [params] = useSearchParams();
  const navegar = useNavigate();
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [mayusculas, setMayusculas] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<{ campo?: 'usuario' | 'clave'; texto: string } | null>(null);
  const campoUsuario = useRef<HTMLInputElement>(null);
  const campoClave = useRef<HTMLInputElement>(null);

  useEffect(() => campoUsuario.current?.focus(), []);

  const volver = params.get('volver');
  const motivo = params.get('motivo');
  const destino = (rutaVolver: string | null, u: Usuario) =>
    rutaVolver && rutaVolver.startsWith('/') && puedeAcceder(u, rutaVolver.split('?')[0]) ? rutaVolver : '/inicio';

  if (usuarioActual && !enviando) return <Navigate to={destino(volver, usuarioActual)} replace />;

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!usuario.trim()) {
      campoUsuario.current?.focus();
      return setError({ campo: 'usuario', texto: 'Ingrese su usuario.' });
    }
    if (!clave) {
      campoClave.current?.focus();
      return setError({ campo: 'clave', texto: 'Ingrese su contraseña.' });
    }
    setError(null);
    setEnviando(true);
    try {
      const u = await iniciarSesion(usuario, clave);
      navegar(destino(volver, u), { replace: true });
    } catch (err) {
      setClave('');
      campoClave.current?.focus();
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

  const detectarMayusculas = (e: KeyboardEvent<HTMLInputElement>) => setMayusculas(e.getModifierState('CapsLock'));

  const usarPrueba = (u: Usuario) => {
    setUsuario(u.usuario);
    setClave(CLAVE_DEMO);
    setError(null);
  };

  return (
    <div className="ingreso">
      <aside className="ingreso__marca" aria-label="SaludPlus">
        <div className="ingreso__marca-contenido">
          <Logo size={44} />
          <div className="ingreso__marca-texto">
            <h2>Admisión y sala de espera</h2>
            <p>Desde que el paciente llega al centro hasta que entra al consultorio.</p>
          </div>
          <ul className="ingreso__beneficios">
            {BENEFICIOS.map((b) => (
              <li key={b.titulo}>
                <span className="ingreso__beneficio-icono">
                  <Icon name={b.icono} size={24} />
                </span>
                <span>
                  <strong>{b.titulo}</strong>
                  {b.texto}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <p className="ingreso__marca-pie">SaludPlus Obra Social · Seis centros médicos</p>
      </aside>

      <main className="ingreso__panel">
        <div className="ingreso__form-caja">
          <div className="ingreso__encabezado">
            <span className="ingreso__candado">
              <Icon name="lock" size={24} />
            </span>
            <div>
              <h1>Ingreso del personal</h1>
              <p>Admisión, consultorios y dirección.</p>
            </div>
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
              <div className="ingreso__control">
                <Icon name="user" size={22} className="ingreso__control-icono" />
                <input
                  ref={campoUsuario}
                  id="ing-usuario"
                  className={`input ${error?.campo === 'usuario' ? 'input--error' : ''}`}
                  placeholder="Por ejemplo, jbenitez"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={usuario}
                  aria-invalid={error?.campo === 'usuario'}
                  aria-describedby={error?.campo === 'usuario' ? 'ing-error' : undefined}
                  onChange={(e) => {
                    setUsuario(e.target.value);
                    if (error?.campo === 'usuario') setError(null);
                  }}
                />
              </div>
            </div>

            <div className="campo">
              <label htmlFor="ing-clave">Contraseña</label>
              <div className="ingreso__control">
                <Icon name="lock" size={22} className="ingreso__control-icono" />
                <input
                  ref={campoClave}
                  id="ing-clave"
                  type={verClave ? 'text' : 'password'}
                  className={`input ${error?.campo === 'clave' ? 'input--error' : ''}`}
                  autoComplete="current-password"
                  enterKeyHint="go"
                  value={clave}
                  aria-invalid={error?.campo === 'clave'}
                  aria-describedby={[error?.campo === 'clave' ? 'ing-error' : '', mayusculas ? 'ing-mayus' : ''].join(' ').trim() || undefined}
                  onKeyUp={detectarMayusculas}
                  onKeyDown={detectarMayusculas}
                  onChange={(e) => {
                    setClave(e.target.value);
                    if (error?.campo === 'clave') setError(null);
                  }}
                />
                <button
                  type="button"
                  className="ingreso__ver"
                  aria-pressed={verClave}
                  aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  onClick={() => setVerClave((v) => !v)}
                >
                  <Icon name={verClave ? 'eye-off' : 'eye'} size={22} />
                </button>
              </div>
              {mayusculas && (
                <p id="ing-mayus" className="ingreso__mayus">
                  <Icon name="alert-triangle" size={18} /> Bloq Mayús está activado.
                </p>
              )}
            </div>

            {error?.campo && (
              <p id="ing-error" className="campo__error" role="alert">
                <Icon name="x-circle" size={18} /> {error.texto}
              </p>
            )}

            <Button type="submit" className="ingreso__btn" icon={<Icon name="arrow-right" size={24} />} loading={enviando}>
              {enviando ? 'Ingresando…' : 'Ingresar'}
            </Button>
          </form>

          <section className="ingreso__prueba" aria-labelledby="ing-prueba-titulo">
            <h2 id="ing-prueba-titulo">Probar con un usuario de demostración</h2>
            <div className="ingreso__accesos">
              {ACCESOS_RAPIDOS.map((u) => (
                <button key={u.usuario} type="button" className={`ingreso__acceso ${usuario === u.usuario ? 'ingreso__acceso--activo' : ''}`} onClick={() => usarPrueba(u)}>
                  <strong>{ETIQUETA_ROL[u.rol]}</strong>
                  <span>{u.usuario}</span>
                </button>
              ))}
            </div>
            <details className="ingreso__todos">
              <summary>Ver todos los usuarios de prueba</summary>
              <p>
                Contraseña para todos: <code>{CLAVE_DEMO}</code>. Datos ficticios.
              </p>
              <ul>
                {USUARIOS_DEMO.map((u) => (
                  <li key={u.usuario}>
                    <button type="button" className="ingreso__usar" onClick={() => usarPrueba(u)}>
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
          </section>

          <p className="ingreso__nota">
            <Icon name="info" size={20} />
            La sesión se cierra sola después de {INACTIVIDAD_MINUTOS} minutos sin uso. El tótem y la pantalla de sala no necesitan usuario.
          </p>
        </div>
      </main>
    </div>
  );
}
