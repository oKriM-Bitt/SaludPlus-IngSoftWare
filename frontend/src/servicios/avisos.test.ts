import { describe, expect, it } from 'vitest';
import { avisosVigentes, LARGO_MAXIMO_AVISO, MENSAJES_PREDEFINIDOS, problemaConAviso, publicarAviso, quitarAviso, vencimiento } from './avisos';

describe('avisos generales en la sala (DEV-55)', () => {
  const pacientes = ['Sofía M.', 'Carlos B.'];
  it('los mensajes predefinidos se pueden publicar', () => {
    MENSAJES_PREDEFINIDOS.forEach((m) => expect(problemaConAviso(m, pacientes)).toBeNull());
  });
  it('rechaza mensajes vacíos o demasiado largos', () => {
    expect(problemaConAviso('  ')).toMatch(/Escriba/);
    expect(problemaConAviso('x'.repeat(LARGO_MAXIMO_AVISO + 1))).toMatch(/máximo/);
  });
  it('no permite datos personales de pacientes', () => {
    expect(problemaConAviso('Sofia, acérquese a secretaría', pacientes)).toMatch(/nombres/);
    expect(problemaConAviso('DNI 31.000.111 acérquese', pacientes)).toMatch(/documento/);
    expect(problemaConAviso('Llamar al 351 555 1234', pacientes)).toMatch(/teléfonos/);
    expect(problemaConAviso('Escriba a alguien@correo.com', pacientes)).toMatch(/correo/);
    expect(problemaConAviso('El consultorio 4 pasa al 10', pacientes)).toBeNull();
  });
  it('se muestra solo en su sucursal y hasta que vence', () => {
    const ahora = new Date();
    publicarAviso({ sucursal: 'villa-norte', texto: 'Hay demoras', hasta: vencimiento(15, ahora), usuario: 'jbenitez' });
    expect(avisosVigentes('villa-norte', ahora).map((a) => a.texto)).toEqual(['Hay demoras']);
    expect(avisosVigentes('guemes', ahora)).toEqual([]);
    expect(avisosVigentes('villa-norte', new Date(ahora.getTime() + 16 * 60_000))).toEqual([]);
  });
  it('se puede quitar antes de que venza', () => {
    const a = publicarAviso({ sucursal: 'guemes', texto: 'Cambio de consultorio', hasta: vencimiento(null), usuario: 'mcastro' });
    expect(avisosVigentes('guemes')).toHaveLength(1);
    quitarAviso(a.id, 'mcastro');
    expect(avisosVigentes('guemes')).toHaveLength(0);
  });
  it('no publica un mensaje con datos personales', () => {
    expect(() => publicarAviso({ sucursal: 'guemes', texto: 'Carlos, venga', hasta: vencimiento(15), usuario: 'x' }, pacientes)).toThrow(/nombres/);
  });
});
