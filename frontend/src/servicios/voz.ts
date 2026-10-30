/**
 * DEV-61: anuncio por voz de los llamados en la sala, para personas con baja visión.
 * Usa la síntesis de voz del navegador (Web Speech API). Si el navegador no tiene voz,
 * la sala sigue con el aviso sonoro (#45). El anuncio nunca incluye nombres de pacientes:
 * solo recibe número y destino.
 */

export type DestinoLlamado = { numero: string; lugar: 'consultorio' | 'box'; destino: string };

const CLAVE = 'saludplus.sala.voz';

/** Texto que se anuncia: "Número A023, consultorio 4". */
export function textoAnuncio({ numero, lugar, destino }: DestinoLlamado): string {
  return `Número ${numero}, ${lugar} ${destino}`;
}

/**
 * Texto preparado para la voz: separa la letra del número y quita los ceros de adelante,
 * así se escucha "A 23" y no "a cero veintitrés".
 */
export function textoParaVoz(llamado: DestinoLlamado): string {
  const m = llamado.numero.match(/^([A-Za-z]+)0*(\d+)$/);
  const numero = m ? `${m[1].toUpperCase()} ${m[2]}` : llamado.numero;
  return textoAnuncio({ ...llamado, numero });
}

function sintesis(): SpeechSynthesis | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  return window.speechSynthesis;
}

/** true si el navegador puede hablar. Algunas voces cargan tarde: se considera disponible si existe la API. */
export function vozDisponible(): boolean {
  return sintesis() !== null && typeof window.SpeechSynthesisUtterance === 'function';
}

/** Voz en español si hay alguna; si no, la del navegador. */
function vozEnEspanol(s: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voces = s.getVoices();
  return voces.find((v) => v.lang?.toLowerCase().startsWith('es-ar')) ?? voces.find((v) => v.lang?.toLowerCase().startsWith('es')) ?? null;
}

/** Dice el llamado. Devuelve false si el navegador no tiene voz (queda solo el aviso sonoro). */
export function anunciar(llamado: DestinoLlamado): boolean {
  const s = sintesis();
  if (!s || !vozDisponible()) return false;
  try {
    const u = new SpeechSynthesisUtterance(textoParaVoz(llamado));
    u.lang = 'es-AR';
    const voz = vozEnEspanol(s);
    if (voz) u.voice = voz;
    u.rate = 0.9; // un poco más lento: se entiende mejor en una sala
    s.cancel(); // un llamado nuevo reemplaza al anterior que todavía se estaba diciendo
    s.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function vozActivada(): boolean {
  try {
    return localStorage.getItem(CLAVE) !== 'off';
  } catch {
    return true;
  }
}

export function guardarVoz(activada: boolean) {
  try {
    localStorage.setItem(CLAVE, activada ? 'on' : 'off');
  } catch {
    /* preferencia solo para esta sesión */
  }
  if (!activada) sintesis()?.cancel();
}
