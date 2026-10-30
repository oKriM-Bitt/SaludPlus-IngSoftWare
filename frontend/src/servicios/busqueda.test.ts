import { describe, expect, it } from 'vitest';
import { coincideBusqueda, partesResaltadas } from './busqueda';

const sofia = { numero: 'A021', paciente: 'Sofía M.', documento: '31000111' };

describe('buscador de la cola (DEV-54)', () => {
  it('encuentra por número de orden, con o sin letra y ceros', () => {
    expect(coincideBusqueda(sofia, 'A021')).toBe(true);
    expect(coincideBusqueda(sofia, 'a21')).toBe(true);
    expect(coincideBusqueda(sofia, '21')).toBe(true);
    expect(coincideBusqueda(sofia, 'A022')).toBe(false);
  });
  it('encuentra por DNI, también con puntos', () => {
    expect(coincideBusqueda(sofia, '31000111')).toBe(true);
    expect(coincideBusqueda(sofia, '31.000.111')).toBe(true);
    expect(coincideBusqueda(sofia, '0001')).toBe(true);
    expect(coincideBusqueda(sofia, '99999')).toBe(false);
  });
  it('encuentra por nombre sin importar tildes ni mayúsculas', () => {
    expect(coincideBusqueda(sofia, 'sofia')).toBe(true);
    expect(coincideBusqueda(sofia, 'SOF')).toBe(true);
    expect(coincideBusqueda(sofia, 'carlos')).toBe(false);
  });
  it('la búsqueda vacía no filtra', () => {
    expect(coincideBusqueda(sofia, '   ')).toBe(true);
  });
  it('resalta la parte del nombre que coincide', () => {
    expect(partesResaltadas('Sofía M.', 'sofi')).toEqual([
      { texto: 'Sofí', marca: true },
      { texto: 'a M.', marca: false },
    ]);
    expect(partesResaltadas('Sofía M.', '123')).toEqual([{ texto: 'Sofía M.', marca: false }]);
  });
});
