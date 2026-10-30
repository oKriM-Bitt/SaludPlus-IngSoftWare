/**
 * Reglas de contraseñas (#79). La contraseña nunca se guarda: se guarda su resumen SHA-256
 * combinado con el nombre de usuario. Con el backend se usará un algoritmo lento (bcrypt o
 * Argon2) en el servidor; esto es solo para la demo.
 */
import { sha256 } from './sha256';

export const LARGO_MINIMO = 8;
export const INTENTOS_ANTES_DE_BLOQUEO = 5;
export const MINUTOS_DE_BLOQUEO = 15;

export async function resumenClave(usuario: string, clave: string): Promise<string> {
  const datos = new TextEncoder().encode(`saludplus:${usuario.trim().toLowerCase()}:${clave}`);
  // crypto.subtle solo existe en localhost o con https: si la página se abre por la red con http, se calcula en JavaScript.
  const sutil = typeof crypto !== 'undefined' ? crypto.subtle : undefined;
  const hash = sutil ? new Uint8Array(await sutil.digest('SHA-256', datos)) : sha256(datos);
  return [...hash].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Devuelve el motivo por el que la contraseña nueva no sirve, o null si es válida. */
export function problemaConClave(nueva: string, usuario: string): string | null {
  if (nueva.length < LARGO_MINIMO) return `Debe tener al menos ${LARGO_MINIMO} caracteres.`;
  if (!/[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(nueva) || !/\d/.test(nueva)) return 'Debe combinar letras y números.';
  if (nueva.toLowerCase().includes(usuario.trim().toLowerCase())) return 'No puede contener el nombre de usuario.';
  if (nueva.toLowerCase() === 'saludplus') return 'Elija una contraseña distinta de la de prueba.';
  return null;
}

/** Contraseña temporal legible para que dirección la entregue en persona. */
export function claveTemporal(aleatorio: () => number = Math.random): string {
  const silabas = ['sal', 'mar', 'luz', 'sol', 'pan', 'rio', 'mes', 'paz'];
  const palabra = silabas[Math.floor(aleatorio() * silabas.length)] + silabas[Math.floor(aleatorio() * silabas.length)];
  const numero = String(Math.floor(aleatorio() * 9000) + 1000);
  return `${palabra.charAt(0).toUpperCase()}${palabra.slice(1)}-${numero}`;
}

/** Cuántos minutos faltan para que se desbloquee el usuario (0 si no está bloqueado). */
export function minutosDeBloqueo(bloqueadoHasta: string | undefined, ahora = new Date()): number {
  if (!bloqueadoHasta) return 0;
  const resta = new Date(bloqueadoHasta).getTime() - ahora.getTime();
  return resta > 0 ? Math.ceil(resta / 60_000) : 0;
}
