import { describe, expect, it } from 'vitest';
import { datosTicket, prepararImpresion, yaImpreso } from './ticket';

const llegada = { numero: 'A023', turnoId: 't-1', registradaEn: '2026-10-30T13:05:00', consultorio: '4', paciente: 'Marta R.', servicio: 'Clínica médica' };

describe('ticket impreso a pedido (DEV-48)', () => {
  it('muestra número, consultorio, hora de llegada y espera estimada', () => {
    const t = datosTicket(llegada, 20);
    expect(t).toEqual({ numero: 'A023', destino: 'Consultorio 4', llegada: '13:05', espera: 'Unos 20 minutos' });
  });
  it('no incluye el nombre del paciente', () => {
    expect(JSON.stringify(datosTicket(llegada, 20))).not.toContain('Marta');
  });
  it('si la impresora falla no cuenta como impreso y se puede reintentar', () => {
    expect(prepararImpresion(llegada, () => 'sin-papel')).toBe('sin-papel');
    expect(yaImpreso(llegada)).toBe(false);
    expect(prepararImpresion(llegada, () => 'error')).toBe('error');
  });
  it('se imprime una sola vez por llegada', () => {
    expect(prepararImpresion(llegada, () => 'ok')).toBe('ok');
    expect(prepararImpresion(llegada, () => 'ok')).toBe('ya-impreso');
    // Otra llegada (por ejemplo, después de deshacer y volver a registrar) sí puede imprimir.
    expect(prepararImpresion({ ...llegada, registradaEn: '2026-10-30T13:09:00' }, () => 'ok')).toBe('ok');
  });
});
