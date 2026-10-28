import { describe, expect, it } from 'vitest';
import { CLAVE_DEMO, destinosPorRol, puedeAcceder, validarCredenciales } from './usuarios';

describe('inicio de sesión y permisos (#47, #48)', () => {
  it('acepta usuario y contraseña de prueba, sin distinguir mayúsculas en el usuario', () => {
    expect(validarCredenciales('  JBenitez ', CLAVE_DEMO)?.rol).toBe('secretaria');
  });
  it('rechaza contraseña incorrecta o usuario inexistente', () => {
    expect(validarCredenciales('jbenitez', 'otra')).toBeNull();
    expect(validarCredenciales('nadie', CLAVE_DEMO)).toBeNull();
  });
  it('cada rol abre solo sus pantallas', () => {
    const secretaria = validarCredenciales('jbenitez', CLAVE_DEMO)!;
    const medica = validarCredenciales('lferrer', CLAVE_DEMO)!;
    const direccion = validarCredenciales('direccion', CLAVE_DEMO)!;
    expect(puedeAcceder(secretaria, '/secretaria')).toBe(true);
    expect(puedeAcceder(secretaria, '/profesional')).toBe(false);
    expect(puedeAcceder(medica, '/profesional')).toBe(true);
    expect(puedeAcceder(medica, '/secretaria')).toBe(false);
    expect(puedeAcceder(direccion, '/secretaria')).toBe(true);
    expect(puedeAcceder(direccion, '/profesional')).toBe(true);
  });
  it('el menú del profesional apunta a su propio consultorio', () => {
    const medica = validarCredenciales('lferrer', CLAVE_DEMO)!;
    expect(destinosPorRol(medica)[0].ruta).toBe('/profesional?consultorio=4');
  });
});
