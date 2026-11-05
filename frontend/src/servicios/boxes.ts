/**
 * DEV-72: qué secretaria atiende en cada box de admisión hoy.
 * Está separado de turnos.ts para que la sesión pueda liberar los boxes al cerrarse
 * sin crear una dependencia circular (turnos → contexto → sesión → turnos).
 *
 * El dato que vale es el del registro compartido del servidor de desarrollo (`/api/boxes`,
 * ver vite.config.ts): así dos navegadores o equipos ven los mismos boxes ocupados.
 * Cada navegador guarda una copia en localStorage para dibujar la pantalla sin esperar.
 * Sin ese registro (pruebas, `vite preview`) funciona solo con la copia local.
 * Todo lo que se toma o se deja queda en la auditoría.
 */
import { escribirJSON, hoy, leerJSON } from './almacen';
import { registrarAuditoria } from './auditoria';
import { configuracion } from './configuracion';

/** Clave "AAAA-MM-DD|sucursal|número de box" → usuario que atiende ahí. */
export const CLAVE_BOXES = 'saludplus.boxes.dia'; // DEV-44

const API = '/api/boxes';
const SINCRONIZAR_CADA_MS = 3_000;

const prefijo = (sucursal: string) => `${hoy()}|${sucursal}|`;
const deHoy = (todos: Record<string, string>) => {
  const dia = `${hoy()}|`;
  return Object.fromEntries(Object.entries(todos).filter(([k]) => k.startsWith(dia)));
};

/** Lee las ocupaciones de hoy (las de días anteriores ya no cuentan). */
const leer = (): Record<string, string> => deHoy(leerJSON<Record<string, string>>(CLAVE_BOXES, {}));

/** Guarda la copia local y avisa a la pantalla si cambió algo. */
function guardarCopia(boxes: Record<string, string>) {
  const nuevos = deHoy(boxes);
  if (JSON.stringify(nuevos) === JSON.stringify(leer())) return;
  escribirJSON(CLAVE_BOXES, nuevos);
  // localStorage no avisa a la misma pestaña: se avisa a mano para que se redibuje ya.
  if (typeof window !== 'undefined' && typeof StorageEvent !== 'undefined') window.dispatchEvent(new StorageEvent('storage', { key: CLAVE_BOXES }));
}

type Respuesta = { boxes: Record<string, string>; ocupadoPor?: string };

/** Pide algo al registro compartido. Devuelve null si no está disponible. */
async function pedir(accion: 'tomar' | 'dejar', cuerpo: object): Promise<Respuesta | null> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return null;
  try {
    // keepalive: el pedido termina aunque la pantalla cambie (por ejemplo, al cerrar sesión).
    const r = await fetch(`${API}/${accion}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo), keepalive: true });
    if (r.status !== 200 && r.status !== 409) return null;
    return (await r.json()) as Respuesta;
  } catch {
    return null;
  }
}

/** Trae del registro compartido quién ocupa cada box. */
export async function sincronizarBoxes(): Promise<void> {
  if (typeof window === 'undefined' || typeof fetch === 'undefined') return;
  try {
    const r = await fetch(API);
    if (!r.ok || !r.headers.get('content-type')?.includes('application/json')) return;
    guardarCopia((await r.json()) as Record<string, string>);
  } catch {
    /* sin registro compartido: queda la copia local */
  }
}

if (typeof window !== 'undefined') {
  sincronizarBoxes();
  window.setInterval(sincronizarBoxes, SINCRONIZAR_CADA_MS);
  window.addEventListener('focus', () => sincronizarBoxes());
}

/** Nombre para mostrar de un usuario ("Julia Benítez" en vez de "jbenitez"). */
export const nombreDeUsuario = (usuario: string) => configuracion().usuarios.find((u) => u.usuario === usuario)?.nombre ?? usuario;

/** Qué usuario atiende en cada box hoy: número de box → usuario. */
export function ocupacionDeBoxes(sucursal: string): Record<string, string> {
  const p = prefijo(sucursal);
  return Object.fromEntries(Object.entries(leer()).filter(([k]) => k.startsWith(p)).map(([k, usuario]) => [k.slice(p.length), usuario]));
}

/** Box en el que atiende hoy el usuario en esa sucursal, o null. */
export function boxDelUsuario(usuario: string, sucursal: string): string | null {
  return Object.entries(ocupacionDeBoxes(sucursal)).find(([, u]) => u === usuario)?.[0] ?? null;
}

export type ResultadoTomarBox = { ok: true } | { ok: false; ocupadoPor: string };

/** Sin registro compartido: toma el box en la copia local (misma regla que el servidor). */
function tomarLocal(sucursal: string, numero: string, usuario: string): ResultadoTomarBox {
  const todos = leer();
  const clave = prefijo(sucursal) + numero;
  if (todos[clave] && todos[clave] !== usuario) return { ok: false, ocupadoPor: todos[clave] };
  const anterior = boxDelUsuario(usuario, sucursal);
  if (anterior) delete todos[prefijo(sucursal) + anterior];
  todos[clave] = usuario;
  escribirJSON(CLAVE_BOXES, todos);
  // Otra pestaña pudo escribir en el medio: gana el que quedó guardado.
  const quedo = leer()[clave];
  return quedo === usuario ? { ok: true } : { ok: false, ocupadoPor: quedo ?? '' };
}

/**
 * Toma el box. Quien decide es el registro compartido: si dos personas lo eligen casi a la vez,
 * solo una lo toma y la otra recibe quién lo tiene. Si el usuario estaba en otro box, lo deja.
 */
export async function tomarBox(sucursal: string, numero: string, usuario: string): Promise<ResultadoTomarBox> {
  const anterior = boxDelUsuario(usuario, sucursal);
  if (anterior === numero) return { ok: true };
  const remoto = await pedir('tomar', { clave: prefijo(sucursal) + numero, usuario });
  let r: ResultadoTomarBox;
  if (remoto) {
    guardarCopia(remoto.boxes);
    r = remoto.ocupadoPor ? { ok: false, ocupadoPor: remoto.ocupadoPor } : { ok: true };
  } else {
    r = tomarLocal(sucursal, numero, usuario);
  }
  if (!r.ok) return r;
  if (anterior) registrarAuditoria({ accion: 'deja-box', usuario, sucursal, box: anterior, detalle: `Box ${anterior} · cambió al box ${numero}` });
  registrarAuditoria({ accion: 'toma-box', usuario, sucursal, box: numero, detalle: `Box ${numero}` });
  return r;
}

/** Deja libre el box del usuario en la sucursal. Devuelve el número que dejó, o null. */
export function dejarBox(sucursal: string, usuario: string, motivo = 'lo dejó libre'): string | null {
  const numero = boxDelUsuario(usuario, sucursal);
  if (!numero) return null;
  const clave = prefijo(sucursal) + numero;
  const todos = leer();
  delete todos[clave];
  escribirJSON(CLAVE_BOXES, todos);
  void pedir('dejar', { claves: [clave], usuario }); // no se espera: al cerrar sesión la pantalla cambia enseguida
  registrarAuditoria({ accion: 'deja-box', usuario, sucursal, box: numero, detalle: `Box ${numero} · ${motivo}` });
  return numero;
}

/** Deja libres todos los boxes del usuario (al cerrar sesión). Devuelve cuántos dejó. */
export function dejarTodosLosBoxes(usuario: string, motivo: string): number {
  const sucursales = new Set(
    Object.entries(leer())
      .filter(([, u]) => u === usuario)
      .map(([k]) => k.split('|')[1]),
  );
  let dejados = 0;
  for (const s of sucursales) if (dejarBox(s, usuario, motivo)) dejados++;
  return dejados;
}
