/**
 * DEV-48: ticket impreso a pedido del paciente (por ejemplo, si no tiene celular).
 * Solo se imprime al tocar "Imprimir ticket" y una sola vez por llegada.
 * La impresora es SIMULADA: ?impresora=sin-papel o ?impresora=error prueban las fallas.
 */
import { borrar, escribirJSON, leerJSON, parametroURL } from './almacen';
import { textoEspera } from './espera';
import { hora } from '../utilidades/fechas';

export type DatosTicket = {
  numero: string;
  destino: string; // "Consultorio 4", "Box 1" o el servicio si todavía no tiene profesional
  llegada: string; // HH:MM
  espera: string; // texto para el paciente, sin prometer una hora exacta
};

export type ResultadoImpresion = 'ok' | 'ya-impreso' | 'sin-papel' | 'error';

type ParaTicket = { numero: string; turnoId: string; registradaEn: string; consultorio: string; servicio?: string };

const CLAVE = 'saludplus.tickets';
if (parametroURL('reset') === '1') borrar(CLAVE);

/** Lo que muestra el ticket: nunca el nombre ni datos de salud. */
export function datosTicket(a: ParaTicket, minutosEspera: number | null): DatosTicket {
  return {
    numero: a.numero,
    destino: a.consultorio ? `Consultorio ${a.consultorio}` : a.servicio ? `${a.servicio} · la secretaría le asigna el consultorio` : 'Consulte en secretaría',
    llegada: hora(a.registradaEn),
    espera: minutosEspera === null ? 'Se informa en la pantalla de sala' : textoEspera(minutosEspera),
  };
}

const idLlegada = (a: ParaTicket) => `${a.turnoId}|${a.registradaEn}`;

export function yaImpreso(a: ParaTicket): boolean {
  return leerJSON<string[]>(CLAVE, []).includes(idLlegada(a));
}

/** Estado de la impresora simulada. */
function estadoImpresora(): ResultadoImpresion {
  const p = parametroURL('impresora');
  return p === 'sin-papel' ? 'sin-papel' : p === 'error' ? 'error' : 'ok';
}

/**
 * Controla si se puede imprimir y lo deja anotado. Si devuelve 'ok', la pantalla imprime.
 * Si la impresora falla, no cuenta como impreso: el número queda en pantalla.
 */
export function prepararImpresion(a: ParaTicket, impresora: () => ResultadoImpresion = estadoImpresora): ResultadoImpresion {
  if (yaImpreso(a)) return 'ya-impreso';
  const estado = impresora();
  if (estado !== 'ok') return estado;
  escribirJSON(CLAVE, [...leerJSON<string[]>(CLAVE, []), idLlegada(a)]);
  return 'ok';
}
