import { useEffect, type ReactNode } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { controlarInactividad, registrarActividad, useUsuario } from '../servicios/sesion';
import { puedeAcceder } from '../servicios/usuarios';

const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

/**
 * Pantallas internas (#47): sin sesión van al inicio de sesión; con un rol que no
 * corresponde, al menú. También cierra la sesión por inactividad.
 */
export function RutaProtegida({ children }: { children: ReactNode }) {
  const usuario = useUsuario();
  const { pathname, search } = useLocation();
  const navegar = useNavigate();

  useEffect(() => {
    if (!usuario) return;
    const actividad = () => registrarActividad();
    EVENTOS.forEach((e) => window.addEventListener(e, actividad, { passive: true }));
    const intervalo = window.setInterval(() => {
      if (controlarInactividad()) navegar('/ingresar?motivo=inactividad', { replace: true });
    }, 20_000);
    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, actividad));
      window.clearInterval(intervalo);
    };
  }, [usuario, navegar]);

  if (!usuario) return <Navigate to={`/ingresar?volver=${encodeURIComponent(pathname + search)}`} replace />;
  if (!puedeAcceder(usuario, pathname)) return <Navigate to="/inicio?sin-permiso=1" replace />;
  return <>{children}</>;
}
