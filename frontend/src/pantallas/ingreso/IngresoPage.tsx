import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Logo } from '../../componentes/Logo';
import { Icon, type IconName } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { FormularioClave } from '../../componentes/FormularioClave';
import { ElegirConsultorio } from '../../componentes/ElegirConsultorio';
import { opcionesDeConsultorio } from '../../servicios/turnos';
import { abrirSesion, cerrarSesion, comprobarIngreso, inactividadMinutos, usuarioActual as leerUsuarioActual, useUsuario } from '../../servicios/sesion';
import { CLAVE_DEMO, ETIQUETA_ROL, puedeAcceder, usuariosDemo, type Usuario } from '../../servicios/usuarios';
import { configuracion, nombreSucursal, profesionalesDelDia, sucursalPorId, type Rol, type UsuarioRegistrado } from '../../servicios/configuracion';
import './ingreso.css';

const BENEFICIOS: { icono: IconName; titulo: string; texto: string }[] = [
  { icono: 'users', titulo: 'Admisión', texto: 'La cola del centro en tiempo real, sin listados en papel.' },
  { icono: 'user-check', titulo: 'Consultorios', texto: 'Llamar al próximo paciente con un toque.' },
  { icono: 'monitor', titulo: 'Sala de espera', texto: 'Número, consultorio y espera estimada a la vista.' },
];

/** Un usuario de prueba por rol para el ingreso rápido de la demo. */
const accesosRapidos = () =>
  (['secretaria', 'profesional', 'direccion'] as Rol[]).map((rol) => usuariosDemo().find((u) => u.rol === rol)).filter((u): u is UsuarioRegistrado => !!u);

/** Pasos del ingreso: credenciales, cambio obligatorio de contraseña (#79) y elección de sucursal (#56). */
type Etapa =
  | { tipo: 'credenciales' }
  | { tipo: 'cambio-clave'; registrado: UsuarioRegistrado }
  | { tipo: 'sucursal'; registrado: UsuarioRegistrado }
  | { tipo: 'consultorio'; registrado: UsuarioRegistrado; sucursal: string }; // DEV-60

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
  const [etapa, setEtapa] = useState<Etapa>({ tipo: 'credenciales' });
  const [error, setError] = useState<{ campo?: 'usuario' | 'clave'; texto: string } | null>(null);
  const campoUsuario = useRef<HTMLInputElement>(null);
  const campoClave = useRef<HTMLInputElement>(null);

  useEffect(() => campoUsuario.current?.focus(), []);

  const volver = params.get('volver');
  const motivo = params.get('motivo');
  const destino = (rutaVolver: string | null, u: Usuario) =>
    rutaVolver && rutaVolver.startsWith('/') && puedeAcceder(u, rutaVolver.split('?')[0]) ? rutaVolver : '/inicio';

  if (usuarioActual && !enviando && etapa.tipo === 'credenciales') return <Navigate to={destino(volver, usuarioActual)} replace />;

  /** Abre la sesión y entra al sistema. */
  const entrar = (r: UsuarioRegistrado, sucursal: string) => {
    // DEV-60: el profesional que puede rotar elige primero el consultorio del día.
    if (etapa.tipo !== 'consultorio' && puedeElegirConsultorio(r, sucursal)) {
      abrirSesion(r, sucursal); // la elección queda registrada a su nombre
      setEtapa({ tipo: 'consultorio', registrado: r, sucursal });
      return;
    }
    if (etapa.tipo !== 'consultorio') abrirSesion(r, sucursal);
    const u = leerUsuarioActual();
    navegar(u ? destino(volver, u) : '/inicio', { replace: true });
  };

  /** Vuelve al ingreso sin dejar la sesión abierta a medias. */
  const volverAlIngreso = () => {
    if (etapa.tipo === 'consultorio') cerrarSesion();
    setEtapa({ tipo: 'credenciales' });
  };

  /** Después de validar: cambio de contraseña pendiente, elección de sucursal o ingreso directo. */
  const continuarCon = (r: UsuarioRegistrado) => {
    const sucursales = r.sucursales.filter((s) => sucursalPorId(s)?.activa);
    if (r.debeCambiarClave) return setEtapa({ tipo: 'cambio-clave', registrado: r });
    if (sucursales.length > 1) return setEtapa({ tipo: 'sucursal', registrado: r });
    if (sucursales.length === 0) return setError({ texto: 'Su usuario no tiene una sucursal activa asignada. Consulte a dirección.' });
    entrar(r, sucursales[0]);
  };

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
      const r = await comprobarIngreso(usuario, clave);
      if (r.tipo === 'ok') {
        setEnviando(false);
        continuarCon(r.registrado);
        return;
      }
      setClave('');
      campoClave.current?.focus();
      setError({
        texto:
          r.tipo === 'bloqueado'
            ? `Usuario bloqueado por varios intentos fallidos. Intente de nuevo en ${r.minutos} minutos o pida a dirección que lo desbloquee.`
            : r.tipo === 'inactivo'
              ? 'Este usuario está dado de baja. Consulte a dirección.'
              : 'Usuario o contraseña incorrectos. Revise los datos e intente nuevamente.',
      });
    } catch {
      setError({ texto: 'No pudimos iniciar sesión. Intente nuevamente en unos segundos.' });
    }
    setEnviando(false);
  };

  const detectarMayusculas = (e: KeyboardEvent<HTMLInputElement>) => setMayusculas(e.getModifierState('CapsLock'));

  const usarPrueba = (u: UsuarioRegistrado) => {
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

          {etapa.tipo === 'consultorio' ? (
            <>
              <div className="ingreso__sucursales-titulo">
                <h2>¿En qué consultorio atiende hoy?</h2>
                <p>
                  {nombreSucursal(etapa.sucursal)}. Le proponemos el de su agenda. Puede cambiarlo después desde el menú si no tiene un paciente en atención.
                </p>
              </div>
              <ElegirConsultorio profesionalId={etapa.registrado.profesional!} sucursal={etapa.sucursal} onListo={() => entrar(etapa.registrado, etapa.sucursal)} />
              <button type="button" className="ingreso__volver" onClick={volverAlIngreso}>
                <Icon name="undo" size={20} /> Volver al ingreso
              </button>
            </>
          ) : etapa.tipo === 'cambio-clave' ? (
            <>
              <Alerta tono="info" titulo="Elija una contraseña nueva">
                Dirección restableció su contraseña. Para continuar, cree una propia que solo usted conozca.
              </Alerta>
              <FormularioClave
                usuario={etapa.registrado.usuario}
                pedirActual={false}
                textoBoton="Guardar y continuar"
                onListo={() => continuarCon(configuracion().usuarios.find((u) => u.usuario === etapa.registrado.usuario)!)}
              />
              <button type="button" className="ingreso__volver" onClick={() => setEtapa({ tipo: 'credenciales' })}>
                <Icon name="undo" size={20} /> Volver al ingreso
              </button>
            </>
          ) : etapa.tipo === 'sucursal' ? (
            <>
              <div className="ingreso__sucursales-titulo">
                <h2>¿En qué sucursal trabaja hoy?</h2>
                <p>Hola, {etapa.registrado.nombre}. Puede cambiarla después desde el menú.</p>
              </div>
              <ul className="ingreso__sucursales">
                {etapa.registrado.sucursales
                  .filter((s) => sucursalPorId(s)?.activa)
                  .map((s) => (
                    <li key={s}>
                      <button type="button" className="ingreso__sucursal" onClick={() => entrar(etapa.registrado, s)}>
                        <Icon name="building" size={28} />
                        <span>
                          <strong>{nombreSucursal(s)}</strong>
                          <span>{sucursalPorId(s)?.direccion}</span>
                        </span>
                        <Icon name="arrow-right" size={24} />
                      </button>
                    </li>
                  ))}
              </ul>
              <button type="button" className="ingreso__volver" onClick={() => setEtapa({ tipo: 'credenciales' })}>
                <Icon name="undo" size={20} /> Volver al ingreso
              </button>
            </>
          ) : (
          <>
          {motivo === 'inactividad' && (
            <Alerta tono="info" titulo="La sesión se cerró por inactividad">
              Pasaron {inactividadMinutos()} minutos sin uso. Ingrese nuevamente.
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
            <p className="ingreso__olvido">
              <Icon name="help-circle" size={18} /> ¿Olvidó su contraseña? Pida a dirección que la restablezca: le dará una temporal para cambiar al ingresar.
            </p>
          </form>

          <section className="ingreso__prueba" aria-labelledby="ing-prueba-titulo">
            <h2 id="ing-prueba-titulo">Probar con un usuario de demostración</h2>
            <div className="ingreso__accesos">
              {accesosRapidos().map((u) => (
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
                {usuariosDemo().map((u) => (
                  <li key={u.usuario}>
                    <button type="button" className="ingreso__usar" onClick={() => usarPrueba(u)}>
                      <code>{u.usuario}</code>
                      <span>
                        {u.nombre} · {ETIQUETA_ROL[u.rol]}
                        {u.sucursales.length > 1 ? ` · ${u.sucursales.length} sucursales` : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </details>
          </section>

          <p className="ingreso__nota">
            <Icon name="info" size={20} />
            La sesión se cierra sola después de {inactividadMinutos()} minutos sin uso. El tótem y la pantalla de sala no necesitan usuario.
          </p>
          </>
          )}
        </div>
      </main>
    </div>
  );
}

/** DEV-60: el profesional atiende hoy en la sucursal y tiene más de un consultorio libre para elegir. */
function puedeElegirConsultorio(r: UsuarioRegistrado, sucursal: string): boolean {
  if (r.rol !== 'profesional' || !r.profesional) return false;
  if (!profesionalesDelDia(sucursal).some((p) => p.id === r.profesional)) return false;
  return opcionesDeConsultorio(r.profesional, sucursal).filter((o) => !o.ocupadoPor).length > 1;
}
