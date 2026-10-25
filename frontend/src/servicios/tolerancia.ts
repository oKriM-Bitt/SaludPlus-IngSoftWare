/** Regla confirmada por el cliente: 15 minutos de tolerancia desde el horario del turno (RF-07). */
export const TOLERANCIA_MINUTOS = 15;

export type EstadoTolerancia = 'a-tiempo' | 'vencida';

/**
 * Llegar antes o hasta 15 minutos después del horario es válido.
 * A partir de los 15 minutos y 1 segundo el turno queda cancelado.
 */
export function evaluarTolerancia(
  horarioTurno: Date,
  ahora: Date,
  toleranciaMinutos = TOLERANCIA_MINUTOS,
): EstadoTolerancia {
  const demoraMs = ahora.getTime() - horarioTurno.getTime();
  return demoraMs > toleranciaMinutos * 60_000 ? 'vencida' : 'a-tiempo';
}
