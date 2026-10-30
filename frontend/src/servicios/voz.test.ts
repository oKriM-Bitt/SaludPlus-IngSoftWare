import { describe, expect, it } from 'vitest';
import { anunciar, textoAnuncio, textoParaVoz, vozDisponible } from './voz';

describe('llamado por voz en la sala (DEV-61)', () => {
  it('anuncia número y consultorio con el formato acordado', () => {
    expect(textoAnuncio({ numero: 'A023', lugar: 'consultorio', destino: '4' })).toBe('Número A023, consultorio 4');
  });
  it('también anuncia los llamados a box', () => {
    expect(textoAnuncio({ numero: 'B011', lugar: 'box', destino: '1' })).toBe('Número B011, box 1');
  });
  it('para la voz separa la letra y quita los ceros de adelante', () => {
    expect(textoParaVoz({ numero: 'A023', lugar: 'consultorio', destino: '4' })).toBe('Número A 23, consultorio 4');
  });
  it('el anuncio solo usa número y destino: no hay lugar para el nombre del paciente', () => {
    const llamado = { numero: 'A023', lugar: 'consultorio' as const, destino: '4', paciente: 'Sofía M.' };
    expect(textoParaVoz(llamado)).not.toContain('Sofía');
  });
  it('sin voz en el navegador no anuncia y avisa para mantener el sonido', () => {
    expect(vozDisponible()).toBe(false);
    expect(anunciar({ numero: 'A023', lugar: 'consultorio', destino: '4' })).toBe(false);
  });
});
