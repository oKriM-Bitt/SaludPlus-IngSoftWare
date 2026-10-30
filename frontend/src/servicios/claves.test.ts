import { describe, expect, it } from 'vitest';
import { claveTemporal, minutosDeBloqueo, problemaConClave, resumenClave } from './claves';
import { configuracionInicial } from './configuracion';

describe('contraseñas (#79)', () => {
  it('no guarda la contraseña: guarda su resumen, que coincide con el de la demo', async () => {
    const jbenitez = configuracionInicial().usuarios.find((u) => u.usuario === 'jbenitez')!;
    expect(jbenitez.claveHash).not.toContain('saludplus');
    expect(await resumenClave('jbenitez', 'saludplus')).toBe(jbenitez.claveHash);
    expect(await resumenClave('jbenitez', 'otra')).not.toBe(jbenitez.claveHash);
  });
  it('el mismo texto da resúmenes distintos para usuarios distintos', async () => {
    expect(await resumenClave('a', 'Clave123')).not.toBe(await resumenClave('b', 'Clave123'));
  });
  it('exige largo mínimo, letras y números, y que no contenga el usuario', () => {
    expect(problemaConClave('abc12', 'jbenitez')).toMatch(/8 caracteres/);
    expect(problemaConClave('solamenteletras', 'jbenitez')).toMatch(/letras y números/);
    expect(problemaConClave('jbenitez2026', 'jbenitez')).toMatch(/usuario/);
    expect(problemaConClave('Mesa-4821', 'jbenitez')).toBeNull();
  });
  it('la contraseña temporal cumple las reglas', () => {
    for (let i = 0; i < 20; i++) expect(problemaConClave(claveTemporal(), 'jbenitez')).toBeNull();
  });
  it('calcula los minutos que faltan para el desbloqueo', () => {
    const ahora = new Date('2026-10-30T10:00:00');
    expect(minutosDeBloqueo(undefined, ahora)).toBe(0);
    expect(minutosDeBloqueo('2026-10-30T10:14:10', ahora)).toBe(15);
    expect(minutosDeBloqueo('2026-10-30T09:59:00', ahora)).toBe(0);
  });
});
