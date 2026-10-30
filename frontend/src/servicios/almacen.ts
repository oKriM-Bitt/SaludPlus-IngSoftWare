/**
 * Lectura y escritura en localStorage con respaldo en memoria.
 * Funciona también en las pruebas (Node), donde no hay localStorage.
 */
const memoria = new Map<string, string>();

function almacenamiento(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export function leerJSON<T>(clave: string, porDefecto: T): T {
  try {
    const raw = almacenamiento()?.getItem(clave) ?? memoria.get(clave) ?? null;
    return raw === null ? porDefecto : (JSON.parse(raw) as T);
  } catch {
    return porDefecto;
  }
}

export function escribirJSON(clave: string, valor: unknown) {
  const raw = JSON.stringify(valor);
  memoria.set(clave, raw);
  try {
    almacenamiento()?.setItem(clave, raw);
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
}

export function borrar(clave: string) {
  memoria.delete(clave);
  try {
    almacenamiento()?.removeItem(clave);
  } catch {
    /* nada que borrar */
  }
}

/** Avisa cuando otra pestaña cambia alguna de las claves. Devuelve la función para dejar de escuchar. */
export function escucharClaves(claves: string[], alCambiar: () => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const handler = (e: StorageEvent) => {
    if (e.key === null || claves.includes(e.key)) alCambiar();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}

/** Parámetro de la dirección web actual (vacío en las pruebas). */
export function parametroURL(nombre: string): string | null {
  if (typeof window === 'undefined') return null;
  return new URLSearchParams(window.location.search).get(nombre);
}

/** Fecha local del día en formato AAAA-MM-DD. */
export function hoy(d = new Date()): string {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dia = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${dia}`;
}
