import { describe, expect, it } from 'vitest';
import { sha256 } from './sha256';

const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
const de = (s: string) => hex(sha256(new TextEncoder().encode(s)));

describe('SHA-256 de respaldo (login abierto por la red con http)', () => {
  it('da los valores de referencia del estándar', () => {
    expect(de('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(de('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });
  it('coincide con el resumen de la contraseña de prueba guardado en la configuración', () => {
    expect(de('saludplus:jbenitez:saludplus')).toBe('847b7ed374af5917931faa654356dedebef5c3edd91da2dfd38e2b324c4c3161');
  });
  it('coincide con crypto.subtle en textos de distintos largos y con acentos', async () => {
    for (const texto of ['ñandú áéíóú', 'x'.repeat(55), 'y'.repeat(56), 'z'.repeat(64), 'w'.repeat(200)]) {
      const datos = new TextEncoder().encode(texto);
      const esperado = hex(new Uint8Array(await crypto.subtle.digest('SHA-256', datos)));
      expect(hex(sha256(datos))).toBe(esperado);
    }
  });
});
