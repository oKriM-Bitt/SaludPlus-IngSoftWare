import { useEffect, useId, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from './Icon';
import { cambiarSucursal, cerrarSesion, useUsuario } from '../servicios/sesion';
import { destinosPorRol, ETIQUETA_ROL } from '../servicios/usuarios';
import { nombreSucursal, profesionalesDelDia } from '../servicios/configuracion';

/** Menú de navegación por rol (#48): usuario, sucursal (#56), opciones permitidas, contraseña (#79) y salida. */
export function MenuUsuario() {
  const usuario = useUsuario();
  const [abierto, setAbierto] = useState(false);
  const contenedor = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  const id = useId();
  const navegar = useNavigate();
  const { pathname, search } = useLocation();

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

  const salir = () => {
    cerrarSesion();
    navegar('/ingresar', { replace: true });
  };

  const irASucursal = (s: string) => {
    cambiarSucursal(s);
    setAbierto(false);
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
          </div>
          <button type="button" className="menu__item menu__salir" onClick={salir}>
            <Icon name="log-out" size={22} /> Cerrar sesión
          </button>
        </nav>
      )}
    </div>
  );
}
