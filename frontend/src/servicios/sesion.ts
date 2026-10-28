/**
 * Sesión SIMULADA (#47). Se guarda en localStorage para que las pestañas que abre
 * la secretaría (sala, tótem) y la demo compartan el mismo usuario.
 * Con el backend (#17) se reemplaza por un token emitido por el servidor.
 */
import { useSyncExternalStore } from 'react';
import { validarCredenciales, type Usuario } from './usuarios';

/** Cierre automático por inactividad. */
export const INACTIVIDAD_MINUTOS = 15;

const CLAVE = 'saludplus.sesion';

type Guardada = { usuario: Usuario; ultimaActividad: number };

export class CredencialesError extends Error {
  constructor() {
    super('Usuario o contraseña incorrectos');
    this.name = 'CredencialesError';
  }
}

export class ServicioError extends Error {
  constructor() {
    super('No se pudo iniciar sesión');
    this.name = 'ServicioError';
  }
}

let memoria: Guardada | null = null;
const oyentes = new Set<() => void>();

function leer(): Guardada | null {
  try {
    const raw = localStorage.getItem(CLAVE);
    return raw ? (JSON.parse(raw) as Guardada) : null;
  } catch {
    return memoria;
  }
}

function escribir(valor: Guardada | null) {
  memoria = valor;
  try {
    if (valor) localStorage.setItem(CLAVE, JSON.stringify(valor));
    else localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento: la sesión vive en memoria */
  }
  avisar();
}

function vencida(g: Guardada, ahora = Date.now()) {
  return ahora - g.ultimaActividad > INACTIVIDAD_MINUTOS * 60_000;
}

// Instantánea estable para useSyncExternalStore: se recalcula solo cuando algo cambia.
let instantanea: Usuario | null = null;
function recalcular() {
  const g = leer();
  instantanea = g && !vencida(g) ? g.usuario : null;
}
recalcular();

function avisar() {
  recalcular();
  oyentes.forEach((f) => f());
}

// Otra pestaña inició o cerró sesión.
window.addEventListener('storage', (e) => {
  if (e.key === CLAVE || e.key === null) avisar();
});

export function usuarioActual(): Usuario | null {
  return instantanea;
}

export function useUsuario(): Usuario | null {
  return useSyncExternalStore(
    (f) => {
      oyentes.add(f);
      return () => oyentes.delete(f);
    },
    usuarioActual,
  );
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function iniciarSesion(usuario: string, clave: string): Promise<Usuario> {
  await esperar(700);
  if (new URLSearchParams(window.location.search).get('error') === '1') throw new ServicioError();
  const u = validarCredenciales(usuario, clave);
  if (!u) throw new CredencialesError();
  escribir({ usuario: u, ultimaActividad: Date.now() });
  return u;
}

export function cerrarSesion() {
  escribir(null);
}

/** Registra actividad del usuario. Escribe como máximo cada 30 segundos. */
let ultimaEscritura = 0;
export function registrarActividad() {
  const g = leer();
  if (!g) return;
  const ahora = Date.now();
  if (ahora - ultimaEscritura < 30_000) return;
  ultimaEscritura = ahora;
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...g, ultimaActividad: ahora }));
  } catch {
    memoria = { ...g, ultimaActividad: ahora };
  }
}

/** Cierra la sesión si pasó el tiempo de inactividad. Devuelve true si la cerró. */
export function controlarInactividad(): boolean {
  const g = leer();
  if (g && vencida(g)) {
    escribir(null);
    return true;
  }
  return false;
}
