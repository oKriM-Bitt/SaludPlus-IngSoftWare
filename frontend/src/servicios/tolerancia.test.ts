import { describe, expect, it } from 'vitest';
import { evaluarTolerancia } from './tolerancia';

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
