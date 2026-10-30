import { describe, expect, it } from 'vitest';
import { evaluarLlegada, evaluarTolerancia } from './tolerancia';

const turno = new Date('2026-10-19T10:00:00');
const despues = (min: number, seg = 0) => new Date(turno.getTime() + min * 60_000 + seg * 1000);

describe('evaluarTolerancia', () => {
  it('acepta llegadas anticipadas', () => {
    expect(evaluarTolerancia(turno, despues(-30))).toBe('a-tiempo');
  });
  it('acepta 14:59 de demora', () => {
    expect(evaluarTolerancia(turno, despues(14, 59))).toBe('a-tiempo');
  });
  it('acepta exactamente 15:00 de demora', () => {
    expect(evaluarTolerancia(turno, despues(15))).toBe('a-tiempo');
  });
  it('cancela con 15:01 de demora', () => {
    expect(evaluarTolerancia(turno, despues(15, 1))).toBe('vencida');
  });
});

describe('evaluarLlegada (#75)', () => {
  it('rechaza la llegada antes de la anticipación máxima e informa desde qué hora se acepta', () => {
    const r = evaluarLlegada(turno, despues(-61), 15, 60);
    expect(r.estado).toBe('muy-temprano');
    if (r.estado === 'muy-temprano') expect(r.desde).toEqual(despues(-60));
  });
  it('acepta justo en el límite de anticipación', () => {
    expect(evaluarLlegada(turno, despues(-60), 15, 60).estado).toBe('a-tiempo');
  });
  it('respeta la tolerancia configurada', () => {
    expect(evaluarLlegada(turno, despues(10, 1), 10, 60).estado).toBe('vencida');
    expect(evaluarLlegada(turno, despues(10), 10, 60).estado).toBe('a-tiempo');
  });
});
