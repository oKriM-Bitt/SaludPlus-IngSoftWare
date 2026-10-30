/**
 * Sucursal en la que se está trabajando (#56).
 * - El tótem y la sala son equipos de una sucursal: se configuran una vez con
 *   `?sucursal=<id>` en la dirección y el navegador lo recuerda.
 * - Las pantallas del personal usan la sucursal elegida al iniciar sesión.
 */
import { escribirJSON, leerJSON, parametroURL } from './almacen';
import { sucursalesActivas, sucursalPorId } from './configuracion';
import { usuarioActual } from './sesion';

const CLAVE_EQUIPO = 'saludplus.equipo.sucursal';

function esPantallaDeEquipo() {
  if (typeof window === 'undefined') return false;
  const ruta = window.location.pathname;
  return ruta.startsWith('/totem') || ruta.startsWith('/sala');
}

/** Sucursal configurada en este equipo (tótem o TV de sala). */
export function sucursalDelEquipo(): string {
  const pedida = parametroURL('sucursal');
  if (pedida && sucursalPorId(pedida)?.activa) {
    escribirJSON(CLAVE_EQUIPO, pedida);
    return pedida;
  }
  const guardada = leerJSON<string | null>(CLAVE_EQUIPO, null);
  if (guardada && sucursalPorId(guardada)?.activa) return guardada;
  return sucursalesActivas()[0]?.id ?? 'villa-norte';
}

export function sucursalActiva(): string {
  if (esPantallaDeEquipo()) return sucursalDelEquipo();
  return usuarioActual()?.sucursal ?? sucursalDelEquipo();
}

/** Usuario para la auditoría: el de la sesión o el equipo que hizo la acción. */
export function quienSoy(): string {
  if (esPantallaDeEquipo()) return 'tótem';
  return usuarioActual()?.usuario ?? 'sin-usuario';
}
