import { describe, expect, it } from 'vitest';
import { CLAVE_DEMO, destinosPorRol, puedeAcceder, verificarCredenciales, type Usuario } from './usuarios';
import { restaurarConfiguracion } from './configuracion';

const sesion = (rol: Usuario['rol'], consultorio?: string): Usuario => ({
  usuario: 'x',
  nombre: 'X',
  rol,
  sucursal: 'villa-norte',
  centro: 'Centro Villa Norte',
  sucursales: ['villa-norte'],
  consultorio,
});

describe('inicio de sesión (#47, #79)', () => {
  it('acepta usuario y contraseña de prueba, sin distinguir mayúsculas en el usuario', async () => {
    restaurarConfiguracion();
    const r = await verificarCredenciales('  JBenitez ', CLAVE_DEMO);
    expect(r.tipo).toBe('ok');
  });
  it('rechaza contraseña incorrecta o usuario inexistente', async () => {
    restaurarConfiguracion();
    expect((await verificarCredenciales('jbenitez', 'otra')).tipo).toBe('incorrecto');
    expect((await verificarCredenciales('nadie', CLAVE_DEMO)).tipo).toBe('incorrecto');
  });
  it('bloquea al usuario después de 5 intentos fallidos y no lo deja entrar ni con la clave correcta', async () => {
    restaurarConfiguracion();
    for (let i = 0; i < 4; i++) expect((await verificarCredenciales('prios', 'mala')).tipo).toBe('incorrecto');
    expect((await verificarCredenciales('prios', 'mala')).tipo).toBe('bloqueado');
    expect((await verificarCredenciales('prios', CLAVE_DEMO)).tipo).toBe('bloqueado');
  });
  it('se desbloquea solo pasados los 15 minutos', async () => {
    restaurarConfiguracion();
    for (let i = 0; i < 5; i++) await verificarCredenciales('tvidal', 'mala');
    const despues = new Date(Date.now() + 16 * 60_000);
    expect((await verificarCredenciales('tvidal', CLAVE_DEMO, despues)).tipo).toBe('ok');
  });
});

describe('permisos por rol (#48, #59)', () => {
  it('cada rol abre solo sus pantallas', () => {
    expect(puedeAcceder(sesion('secretaria'), '/secretaria')).toBe(true);
    expect(puedeAcceder(sesion('secretaria'), '/secretaria/cierre')).toBe(true);
    expect(puedeAcceder(sesion('secretaria'), '/box')).toBe(true);
    expect(puedeAcceder(sesion('profesional', '4'), '/box')).toBe(false);
    expect(puedeAcceder(sesion('secretaria'), '/profesional')).toBe(false);
    expect(puedeAcceder(sesion('secretaria'), '/administracion')).toBe(false);
    expect(puedeAcceder(sesion('profesional', '4'), '/profesional')).toBe(true);
    expect(puedeAcceder(sesion('profesional', '4'), '/secretaria')).toBe(false);
    expect(puedeAcceder(sesion('direccion'), '/administracion')).toBe(true);
    expect(puedeAcceder(sesion('direccion'), '/reportes')).toBe(true);
  });
  it('todos pueden cambiar su contraseña', () => {
    expect(puedeAcceder(sesion('profesional', '4'), '/cuenta')).toBe(true);
  });
  it('el menú del profesional tiene solo su consultorio: no la pantalla de sala', () => {
    const destinos = destinosPorRol(sesion('profesional', '4'));
    expect(destinos.map((d) => d.ruta)).toEqual(['/profesional?consultorio=4']);
  });
  it('el tótem y la sala se abren configurados para la sucursal de la secretaria', () => {
    const rutas = destinosPorRol(sesion('secretaria')).map((d) => d.ruta);
    expect(rutas).toContain('/totem?sucursal=villa-norte');
    expect(rutas).toContain('/sala?sucursal=villa-norte');
  });
});
