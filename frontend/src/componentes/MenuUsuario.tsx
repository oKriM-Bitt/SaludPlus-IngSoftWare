import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { cambiarSucursal, cerrarSesion, useUsuario } from '../servicios/sesion';
import { destinosPorRol, ETIQUETA_ROL } from '../servicios/usuarios';
import { nombreSucursal, profesionalesDelDia } from '../servicios/configuracion';
import { tienePacienteEnAtencion } from '../servicios/turnos';
import { Modal } from '../pantallas/secretaria/Modal';
import { Alerta } from './Alerta';
import { ElegirConsultorio } from './ElegirConsultorio';
import { useConfirmar } from './Confirmar';

/** Menú de navegación por rol (#48): usuario, sucursal (#56), opciones permitidas, contraseña (#79) y salida, con confirmación (#87). */
export function MenuUsuario() {
  const usuario = useUsuario();
  const [abierto, setAbierto] = useState(false);
  const [cambiandoConsultorio, setCambiandoConsultorio] = useState(false); // DEV-60
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const navegar = useNavigate();
  const { pathname, search } = useLocation();
  const { confirmar, dialogo } = useConfirmar();

  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (!contenedor.current?.contains(e.target as Node)) setAbierto(false);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAbierto(false);
        boton.current?.focus();
      }
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
    };
  }, [abierto]);

  if (!usuario) return null;
  const destinos = destinosPorRol(usuario, profesionalesDelDia(usuario.sucursal));
  const actual = pathname + search;
  const otrasSucursales = usuario.sucursales.filter((s) => s !== usuario.sucursal);

  const salir = async () => {
    setAbierto(false);
    const enAtencion = usuario.rol === 'profesional' && usuario.profesional && tienePacienteEnAtencion(usuario.profesional);
    const acepta = await confirmar({
      titulo: '¿Cerrar sesión?',
      mensaje: enAtencion
        ? `Tiene un paciente en atención. Conviene finalizar la atención antes de salir. Se cerrará la sesión de ${usuario.nombre} en este equipo.`
        : `Se cerrará la sesión de ${usuario.nombre} en este equipo.`,
      aceptar: 'Cerrar sesión',
    });
    if (!acepta) return boton.current?.focus();
    cerrarSesion();
    navegar('/ingresar', { replace: true });
  };

  const irASucursal = async (s: string) => {
    setAbierto(false);
    const acepta = await confirmar({
      titulo: `¿Cambiar a ${nombreSucursal(s)}?`,
      mensaje: 'Va a ver la cola, los consultorios y la sala de esa sucursal.',
      aceptar: 'Cambiar de sucursal',
    });
    if (!acepta) return boton.current?.focus();
    cambiarSucursal(s);
    // El consultorio y la cola cambian con la sucursal: se vuelve al menú principal.
    navegar('/inicio', { replace: true });
  };

  return (
    <div className="menu" ref={contenedor}>
      <button
        ref={boton}
        type="button"
        className="menu__boton"
        aria-expanded={abierto}
        aria-controls={id}
        onClick={() => setAbierto((v) => !v)}
      >
        <Icon name="user" size={24} />
        <span className="menu__quien">
          <strong>{usuario.nombre}</strong>
          <span>
            {ETIQUETA_ROL[usuario.rol]} · {usuario.centro}
          </span>
        </span>
        <Icon name="menu" size={24} className="menu__icono" />
        <span className="visually-hidden">Abrir menú</span>
      </button>

      {abierto && (
        <nav id={id} className="menu__panel" aria-label="Menú principal">
          <div className="menu__encabezado">
            <strong>{usuario.nombre}</strong>
            <span>
              {ETIQUETA_ROL[usuario.rol]} · {usuario.centro}
            </span>
          </div>
          <ul>
            <li>
              <Link to="/inicio" className={`menu__item ${pathname === '/inicio' ? 'menu__item--actual' : ''}`} aria-current={pathname === '/inicio' ? 'page' : undefined} onClick={() => setAbierto(false)}>
                <Icon name="grid" size={22} /> Inicio
              </Link>
            </li>
            {destinos.map((d) => {
              const base = d.ruta.split('?')[0];
              const unicoConEsaRuta = destinos.filter((x) => x.ruta.split('?')[0] === base).length === 1;
              const esActual = !d.nuevaPestana && (actual === d.ruta || (pathname === base && unicoConEsaRuta));
              return (
                <li key={d.ruta}>
                  {d.nuevaPestana ? (
                    <a className="menu__item" href={d.ruta} target="_blank" rel="noreferrer" onClick={() => setAbierto(false)}>
                      <Icon name={d.icono} size={22} /> {d.titulo}
                      <Icon name="external" size={18} className="menu__externo" />
                      <span className="visually-hidden">(se abre en otra pestaña)</span>
                    </a>
                  ) : (
                    <Link to={d.ruta} className={`menu__item ${esActual ? 'menu__item--actual' : ''}`} aria-current={esActual ? 'page' : undefined} onClick={() => setAbierto(false)}>
                      <Icon name={d.icono} size={22} /> {d.titulo}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>

          {usuario.rol === 'profesional' && usuario.profesionalId && (
            <div className="menu__grupo">
              <button
                type="button"
                className="menu__item"
                onClick={() => {
                  setAbierto(false);
                  setCambiandoConsultorio(true);
                }}
              >
                <Icon name="swap" size={22} /> Cambiar de consultorio
                <span className="menu__detalle">Hoy: {usuario.consultorio ?? 'sin asignar'}</span>
              </button>
            </div>
          )}

          {otrasSucursales.length > 0 && (
            <div className="menu__grupo">
              <span className="menu__grupo-titulo">Cambiar de sucursal</span>
              {otrasSucursales.map((s) => (
                <button key={s} type="button" className="menu__item" onClick={() => irASucursal(s)}>
                  <Icon name="building" size={22} /> {nombreSucursal(s)}
                </button>
              ))}
            </div>
          )}

          <div className="menu__grupo">
            <Link to="/cuenta" className={`menu__item ${pathname === '/cuenta' ? 'menu__item--actual' : ''}`} onClick={() => setAbierto(false)}>
              <Icon name="key" size={22} /> Cambiar contraseña
            </Link>
            {/* Guía de uso interactiva: el mismo archivo que docs/guia, servido por la app */}
            <a className="menu__item" href={`${import.meta.env.BASE_URL}guia-de-uso.html?rol=${usuario.rol}`} target="_blank" rel="noreferrer" onClick={() => setAbierto(false)}>
              <Icon name="help-circle" size={22} /> Guía de uso
              <Icon name="external" size={18} className="menu__externo" />
              <span className="visually-hidden">(se abre en otra pestaña)</span>
            </a>
          </div>
          <button type="button" className="menu__item menu__salir" onClick={salir}>
            <Icon name="log-out" size={22} /> Cerrar sesión
          </button>
        </nav>
      )}

      {cambiandoConsultorio && usuario.profesionalId && (
        <Modal titulo="Cambiar de consultorio" subtitulo={`${usuario.centro} · hoy atiende en el consultorio ${usuario.consultorio ?? '—'}`} onCerrar={() => setCambiandoConsultorio(false)}>
          {usuario.profesional && tienePacienteEnAtencion(usuario.profesional) ? (
            <>
              <Alerta tono="warning" titulo="Tiene un paciente en atención">
                Finalice la atención antes de cambiar de consultorio.
              </Alerta>
              <div className="modal__acciones">
                <button type="button" className="btn btn--primary" onClick={() => setCambiandoConsultorio(false)}>
                  <span>Entendido</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="modal__nota">Los pacientes que lo esperan pasan con usted al consultorio nuevo. La sala y la secretaría lo ven enseguida.</p>
              <ElegirConsultorio
                profesionalId={usuario.profesionalId}
                sucursal={usuario.sucursal}
                onListo={() => {
                  setCambiandoConsultorio(false);
                  // El consultorio forma parte de la dirección de la vista del profesional.
                  if (pathname === '/profesional') navegar('/profesional', { replace: true });
                }}
              />
            </>
          )}
        </Modal>
      )}
      {dialogo}
    </div>
  );
}
