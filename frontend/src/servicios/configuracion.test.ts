import { describe, expect, it } from 'vitest';
import { actualizarConfiguracion, asignacionDe, PARAMETROS_POR_DEFECTO, profesionalesDelDia, restaurarConfiguracion, validarParametros } from './configuracion';

describe('parámetros configurables (#77)', () => {
  it('los valores por defecto son válidos', () => {
    expect(validarParametros(PARAMETROS_POR_DEFECTO)).toEqual({});
  });
  it('rechaza valores fuera de los límites o no enteros', () => {
    const e = validarParametros({ ...PARAMETROS_POR_DEFECTO, toleranciaMinutos: 90, minutosPorConsulta: 7.5 });
    expect(e.toleranciaMinutos).toMatch(/entre 0 y 60/);
    expect(e.minutosPorConsulta).toMatch(/entero/);
  });
  it('exige al menos un motivo de prioridad y sin repetidos', () => {
    expect(validarParametros({ ...PARAMETROS_POR_DEFECTO, motivosPrioridad: [] }).motivosPrioridad).toBeDefined();
    expect(validarParametros({ ...PARAMETROS_POR_DEFECTO, motivosPrioridad: ['Embarazo', 'embarazo'] }).motivosPrioridad).toMatch(/repetidos/);
  });
});

describe('agenda de profesionales (#56, #60)', () => {
  it('cada sucursal ve solo a sus profesionales con su consultorio', () => {
    restaurarConfiguracion();
    const villa = profesionalesDelDia('villa-norte').map((p) => `${p.nombre}·${p.consultorio}`);
    const guemes = profesionalesDelDia('guemes').map((p) => p.nombre);
    expect(villa).toContain('Dra. Lucía Ferrer·4');
    expect(guemes).toEqual(['Dr. Martín Aguirre', 'Dra. Inés Sosa']);
    expect(villa.some((p) => p.startsWith('Dr. Martín Aguirre'))).toBe(false);
  });
  it('un profesional dado de baja deja de aparecer', () => {
    restaurarConfiguracion();
    actualizarConfiguracion((c) => ({ ...c, profesionales: c.profesionales.map((p) => (p.id === 'p-luna' ? { ...p, activo: false } : p)) }));
    expect(profesionalesDelDia('villa-norte').some((p) => p.id === 'p-luna')).toBe(false);
    restaurarConfiguracion();
  });
  it('respeta los días y la franja horaria de la agenda', () => {
    restaurarConfiguracion();
    actualizarConfiguracion((c) => ({
      ...c,
      asignaciones: c.asignaciones.map((a) => (a.profesional === 'p-vidal' ? { ...a, dias: [1, 2, 3, 4, 5], desde: '08:00', hasta: '12:00' } : a)),
    }));
    const lunes10 = new Date('2026-10-26T10:00:00');
    const domingo10 = new Date('2026-10-25T10:00:00');
    expect(asignacionDe('p-vidal', 'villa-norte', lunes10)).toBeDefined();
    expect(asignacionDe('p-vidal', 'villa-norte', domingo10)).toBeUndefined();
    restaurarConfiguracion();
  });
});
