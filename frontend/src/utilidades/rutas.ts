/**
 * Rutas según cómo se abre la app:
 * - Normal (npm run dev / build): direcciones como /totem?sucursal=guemes.
 * - Demo en un solo archivo (npm run build:demo): direcciones con # (#/totem?sucursal=guemes),
 *   para que funcione abriendo el archivo HTML con doble clic, sin Node ni servidor.
 */
export const MODO_ARCHIVO = import.meta.env?.VITE_RUTAS === 'hash';

/** Ruta y parámetros de la pantalla actual, en los dos modos. */
export function ubicacionActual(): { pathname: string; search: string } {
  if (typeof window === 'undefined') return { pathname: '/', search: '' };
  if (!MODO_ARCHIVO) return { pathname: window.location.pathname, search: window.location.search };
  const [ruta, consulta] = (window.location.hash.slice(1) || '/').split('?');
  return { pathname: ruta || '/', search: consulta ? `?${consulta}` : '' };
}

/** Dirección para un enlace normal (por ejemplo, abrir la sala en otra pestaña). */
export const enlace = (ruta: string) => (MODO_ARCHIVO ? `#${ruta}` : ruta);
