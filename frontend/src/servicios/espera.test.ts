import { describe, expect, it } from 'vitest';
import { esEsperaLarga, estimarEspera, MINUTOS_POR_CONSULTA, textoEspera } from './espera';

describe('estimarEspera (#46)', () => {
  it('sin pacientes adelante ni atención en curso, no hay espera', () => {
    expect(estimarEspera(0, false)).toBe(0);
  });
  it('suma una consulta por paciente adelante', () => {
    expect(estimarEspera(3, false)).toBe(3 * MINUTOS_POR_CONSULTA);
  });
  it('suma media consulta si el profesional está atendiendo', () => {
    expect(estimarEspera(2, true)).toBe(2 * MINUTOS_POR_CONSULTA + MINUTOS_POR_CONSULTA / 2);
  });
  it('marca como larga la espera desde 30 minutos', () => {
    expect(esEsperaLarga(29)).toBe(false);
    expect(esEsperaLarga(30)).toBe(true);
  });
  it('arma un texto sin prometer una hora exacta', () => {
    expect(textoEspera(0)).toBe('Será atendido en breve');
    expect(textoEspera(25)).toBe('Unos 25 minutos');
    expect(textoEspera(75)).toBe('Alrededor de 1 h 15 min');
  });
});
