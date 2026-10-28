/** Cálculo de tiempos de espera (#46). Funciones puras: se prueban sin navegador. */

/** Minutos promedio por consulta usados para estimar la espera (valor a acordar con SaludPlus). */
export const MINUTOS_POR_CONSULTA = 10;

/** A partir de estos minutos la espera se destaca en todas las pantallas. */
export const ESPERA_LARGA_MINUTOS = 30;

/**
 * Espera estimada para un paciente según cuántos tiene adelante en el mismo consultorio.
 * Si el profesional está atendiendo, se suma media consulta.
 */
export function estimarEspera(pacientesAntes: number, hayEnAtencion: boolean): number {
  return Math.max(0, pacientesAntes) * MINUTOS_POR_CONSULTA + (hayEnAtencion ? MINUTOS_POR_CONSULTA / 2 : 0);
}

export const esEsperaLarga = (minutos: number) => minutos >= ESPERA_LARGA_MINUTOS;

/** Texto para pacientes: evita prometer una hora exacta. */
export function textoEspera(minutos: number): string {
  if (minutos <= 0) return 'Será atendido en breve';
  if (minutos < 60) return `Unos ${minutos} minutos`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `Alrededor de ${h} h${m ? ` ${m} min` : ''}`;
}
