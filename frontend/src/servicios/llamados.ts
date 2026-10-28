/**
 * Reglas del llamado desde la vista del profesional (#42 y DEV-38).
 * Son funciones puras: no usan el navegador, así se prueban sin la pantalla.
 */

/** Pacientes que quedan "salteados" si se llama a turnoId. La cola ya viene ordenada. */
export function pacientesSaltados<T extends { turnoId: string }>(enEspera: T[], turnoId: string): T[] {
  const posicion = enEspera.findIndex((a) => a.turnoId === turnoId);
  return posicion <= 0 ? [] : enEspera.slice(0, posicion);
}

// ---------- Atajos de teclado (DEV-38) ----------

export type Atajo = 'llamar-siguiente' | 'volver-a-llamar' | 'finalizar' | 'ir-a-lista';

/** Teclas de los atajos. Se muestran en pantalla tal como están acá. */
export const ATAJOS: Record<Atajo, string> = {
  'llamar-siguiente': 'N',
  'volver-a-llamar': 'R',
  finalizar: 'F',
  'ir-a-lista': 'L',
};

type EventoTecla = {
  key: string;
  ctrlKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  repeat?: boolean;
};

type ObjetivoTecla = {
  tagName?: string;
  isContentEditable?: boolean;
  closest?: (selector: string) => unknown;
} | null;

/** Los atajos no se activan mientras se escribe en un campo ni dentro de un diálogo o menú abierto. */
export function escribiendoEnCampo(objetivo: ObjetivoTecla): boolean {
  if (!objetivo) return false;
  const etiqueta = (objetivo.tagName ?? '').toUpperCase();
  if (etiqueta === 'INPUT' || etiqueta === 'TEXTAREA' || etiqueta === 'SELECT') return true;
  if (objetivo.isContentEditable) return true;
  return !!objetivo.closest?.('[role="dialog"], .menu__panel');
}

/** Devuelve el atajo que corresponde a la tecla, o null si hay que ignorarla. */
export function atajoDeTecla(e: EventoTecla, objetivo: ObjetivoTecla): Atajo | null {
  if (e.ctrlKey || e.altKey || e.metaKey || e.repeat) return null;
  if (escribiendoEnCampo(objetivo)) return null;
  const tecla = e.key.toUpperCase();
  const encontrado = (Object.keys(ATAJOS) as Atajo[]).find((a) => ATAJOS[a] === tecla);
  return encontrado ?? null;
}

/** Movimiento dentro de la tabla con flechas, Inicio y Fin. Devuelve el nuevo índice. */
export function moverEnLista(tecla: string, actual: number, total: number): number | null {
  if (total === 0) return null;
  switch (tecla) {
    case 'ArrowDown':
      return Math.min(actual + 1, total - 1);
    case 'ArrowUp':
      return Math.max(actual - 1, 0);
    case 'Home':
      return 0;
    case 'End':
      return total - 1;
    default:
      return null;
  }
}
