/**
 * Sesión SIMULADA (#47, #56, #79). Se guarda en localStorage para que las pestañas que abre
 * la secretaría (sala, tótem) y la demo compartan el mismo usuario.
 * Con el backend (#17) se reemplaza por un token emitido por el servidor.
 */
import { useSyncExternalStore } from 'react';
import { borrar, escribirJSON, escucharClaves, leerJSON, parametroURL } from './almacen';
import { configuracion, escucharConfiguracion, nombreSucursal, parametros, profesionalesDelDia, type UsuarioRegistrado } from './configuracion';
import { registrarAuditoria } from './auditoria';
import { problemaConClave, resumenClave } from './claves';
import { modificarUsuario, verificarCredenciales, type ResultadoCredenciales, type Usuario } from './usuarios';

export const inactividadMinutos = () => parametros().inactividadMinutos;

const CLAVE = 'saludplus.sesion';

type Guardada = { usuario: string; sucursal: string; ultimaActividad: number };

export class ServicioError extends Error {
  constructor() {
    super('No se pudo iniciar sesión');
    this.name = 'ServicioError';
  }
}

const oyentes = new Set<() => void>();

const leer = () => leerJSON<Guardada | null>(CLAVE, null);

function vencida(g: Guardada, ahora = Date.now()) {
  return ahora - g.ultimaActividad > inactividadMinutos() * 60_000;
}

/** Arma el usuario de la sesión a partir de la configuración vigente. */
function armarUsuario(r: UsuarioRegistrado, sucursal: string): Usuario {
  const base: Usuario = { usuario: r.usuario, nombre: r.nombre, rol: r.rol, sucursal, centro: nombreSucursal(sucursal), sucursales: r.sucursales };
  if (r.rol !== 'profesional' || !r.profesional) return base;
  // DEV-60: el consultorio del día es el que eligió al ingresar o, si no eligió, el de su agenda.
  const hoy = profesionalesDelDia(sucursal).find((p) => p.id === r.profesional);
  return { ...base, consultorio: hoy?.consultorio, profesionalId: r.profesional, profesional: hoy?.nombre ?? configuracion().profesionales.find((p) => p.id === r.profesional)?.nombre };
}

// Instantánea estable para useSyncExternalStore: se recalcula solo cuando algo cambia.
let instantanea: Usuario | null = null;
function recalcular() {
  const g = leer();
  const r = g ? configuracion().usuarios.find((u) => u.usuario === g.usuario) : undefined;
  instantanea = g && r && r.activo && !vencida(g) && r.sucursales.includes(g.sucursal) ? armarUsuario(r, g.sucursal) : null;
}
recalcular();

function avisar() {
  recalcular();
  oyentes.forEach((f) => f());
}

escucharClaves([CLAVE], avisar);
escucharConfiguracion(avisar);

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

export function escucharSesion(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  return () => oyentes.delete(alCambiar);
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Paso 1 del ingreso: valida las credenciales. No abre la sesión todavía. */
export async function comprobarIngreso(usuario: string, clave: string): Promise<ResultadoCredenciales> {
  await esperar(600);
  if (parametroURL('error') === '1') throw new ServicioError();
  return verificarCredenciales(usuario, clave);
}

/** Paso final del ingreso: abre la sesión en la sucursal elegida. */
export function abrirSesion(r: UsuarioRegistrado, sucursal: string) {
  escribirJSON(CLAVE, { usuario: r.usuario, sucursal, ultimaActividad: Date.now() });
  registrarAuditoria({ accion: 'inicio-sesion', usuario: r.usuario, sucursal });
  avisar();
}

/** #56: cambia la sucursal de trabajo sin cerrar la sesión. */
export function cambiarSucursal(sucursal: string) {
  const g = leer();
  if (!g) return;
  escribirJSON(CLAVE, { ...g, sucursal, ultimaActividad: Date.now() });
  avisar();
}

export function cerrarSesion() {
  borrar(CLAVE);
  avisar();
}

/**
 * #79: cambia la contraseña. Si `actual` es null, es el cambio obligatorio después de
 * un restablecimiento (ya se validó la contraseña temporal al ingresar).
 */
export async function cambiarClave(usuario: string, actual: string | null, nueva: string): Promise<{ ok: true } | { ok: false; campo: 'actual' | 'nueva'; mensaje: string }> {
  const r = configuracion().usuarios.find((u) => u.usuario === usuario);
  if (!r) return { ok: false, campo: 'actual', mensaje: 'Usuario inexistente.' };
  if (actual !== null && (await resumenClave(usuario, actual)) !== r.claveHash) return { ok: false, campo: 'actual', mensaje: 'La contraseña actual no es correcta.' };
  const problema = problemaConClave(nueva, usuario);
  if (problema) return { ok: false, campo: 'nueva', mensaje: problema };
  const hash = await resumenClave(usuario, nueva);
  if (hash === r.claveHash) return { ok: false, campo: 'nueva', mensaje: 'La contraseña nueva debe ser distinta de la actual.' };
  modificarUsuario(usuario, (u) => ({ ...u, claveHash: hash, debeCambiarClave: false }));
  registrarAuditoria({ accion: 'cambio-clave', usuario });
  return { ok: true };
}

/** Registra actividad del usuario. Escribe como máximo cada 30 segundos. */
let ultimaEscritura = 0;
export function registrarActividad() {
  const g = leer();
  if (!g) return;
  const ahora = Date.now();
  if (ahora - ultimaEscritura < 30_000) return;
  ultimaEscritura = ahora;
  escribirJSON(CLAVE, { ...g, ultimaActividad: ahora });
}

/** Cierra la sesión si pasó el tiempo de inactividad. Devuelve true si la cerró. */
export function controlarInactividad(): boolean {
  const g = leer();
  if (g && vencida(g)) {
    cerrarSesion();
    return true;
  }
  return false;
}
