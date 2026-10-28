/**
 * Aviso sonoro de los llamados (#45). Usa Web Audio para no depender de archivos.
 * Los navegadores bloquean el audio hasta que alguien toca la pantalla: por eso la sala
 * muestra un botón para habilitarlo la primera vez.
 */

const CLAVE = 'saludplus.sala.sonido';
let ctx: AudioContext | null = null;

function contexto(): AudioContext | null {
  if (ctx) return ctx;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    ctx = null;
  }
  return ctx;
}

/** true si el navegador todavía no permite reproducir sonido. */
export function audioBloqueado(): boolean {
  const c = contexto();
  return !c || c.state !== 'running';
}

/** Debe llamarse desde un toque o clic del usuario. */
export async function habilitarAudio(): Promise<boolean> {
  const c = contexto();
  if (!c) return false;
  try {
    await c.resume();
  } catch {
    return false;
  }
  return c.state === 'running';
}

export function sonidoActivado(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== 'off';
  } catch {
    return true;
  }
}

export function guardarSonido(activado: boolean) {
  try {
    localStorage.setItem(CLAVE, activado ? 'on' : 'off');
  } catch {
    /* preferencia solo para esta sesión */
  }
}

/** Dos tonos cortos (ding-dong), repetidos en un llamado nuevo. */
export function sonarLlamado(repeticiones = 2): boolean {
  const c = contexto();
  if (!c || c.state !== 'running') return false;
  const inicio = c.currentTime + 0.05;
  const notas = [880, 660];
  for (let r = 0; r < repeticiones; r++) {
    notas.forEach((frecuencia, i) => {
      const t = inicio + r * 1.1 + i * 0.4;
      const osc = c.createOscillator();
      const gan = c.createGain();
      osc.type = 'sine';
      osc.frequency.value = frecuencia;
      gan.gain.setValueAtTime(0.0001, t);
      gan.gain.exponentialRampToValueAtTime(0.35, t + 0.03);
      gan.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
      osc.connect(gan).connect(c.destination);
      osc.start(t);
      osc.stop(t + 0.4);
    });
  }
  return true;
}
