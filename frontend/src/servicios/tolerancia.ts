/**
 * Reglas de llegada: tolerancia confirmada por el cliente (RF-07) y desde cuánto antes
 * del turno se acepta el registro (#75). Los minutos se configuran en Administración (#77).
 */
import { escucharConfiguracion, parametros } from './configuracion';

/** Minutos de tolerancia vigentes (por defecto 15). Se actualiza si dirección lo cambia. */
export let TOLERANCIA_MINUTOS = parametros().toleranciaMinutos;

/** Desde cuántos minutos antes del horario se acepta la llegada (por defecto 60). */
export let ANTICIPACION_MAXIMA_MINUTOS = parametros().anticipacionMaximaMinutos;

escucharConfiguracion(() => {
  TOLERANCIA_MINUTOS = parametros().toleranciaMinutos;
  ANTICIPACION_MAXIMA_MINUTOS = parametros().anticipacionMaximaMinutos;
});

export type EstadoTolerancia = 'a-tiempo' | 'vencida';

/**
 * Llegar antes o hasta la tolerancia después del horario es válido.
 * Con 15 minutos de tolerancia, a partir de los 15 minutos y 1 segundo el turno queda cancelado.
 */
export function evaluarTolerancia(horarioTurno: Date, ahora: Date, toleranciaMinutos = TOLERANCIA_MINUTOS): EstadoTolerancia {
  const demoraMs = ahora.getTime() - horarioTurno.getTime();
  return demoraMs > toleranciaMinutos * 60_000 ? 'vencida' : 'a-tiempo';
}

export type EstadoLlegada = { estado: 'muy-temprano'; desde: Date } | { estado: 'a-tiempo' } | { estado: 'vencida' };

/** #75: combina la anticipación máxima con la tolerancia. */
export function evaluarLlegada(
  horarioTurno: Date,
  ahora: Date,
  toleranciaMinutos = TOLERANCIA_MINUTOS,
  anticipacionMinutos = ANTICIPACION_MAXIMA_MINUTOS,
): EstadoLlegada {
  const desde = new Date(horarioTurno.getTime() - anticipacionMinutos * 60_000);
  if (ahora.getTime() < desde.getTime()) return { estado: 'muy-temprano', desde };
  return { estado: evaluarTolerancia(horarioTurno, ahora, toleranciaMinutos) };
}
