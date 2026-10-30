import { describe, expect, it } from 'vitest';
import { aCSV, ausentismo, diasDelPeriodo, historialSimulado, resumirDia, sumarFilas } from './reportes';

const r = (estado: string, llegada: string, llamado?: string, extra = {}) => ({ estado, registradaEn: `2026-10-30T${llegada}:00`, llamadoEn: llamado ? `2026-10-30T${llamado}:00` : undefined, ...extra });

describe('resumen del día (#69)', () => {
  const registros = [
    { ...r('finalizado', '09:00', '09:20'), esp: 'Clínica' },
    { ...r('finalizado', '09:10', '09:20'), esp: 'Clínica' },
    { ...r('ausente', '09:30'), esp: 'Clínica' },
    { ...r('se-retiro', '09:40'), esp: 'Pediatría' },
    { ...r('no-atendido', '10:00'), esp: 'Pediatría' },
    { ...r('en-espera', '10:05', undefined, { tipo: 'demanda', derivaciones: [{ desde: '' }, { desde: 'Dra. X' }] }), esp: 'Pediatría' },
  ];
  const resumen = resumirDia(registros, (a) => a.esp);
  it('cuenta atendidos, ausentes, abandonos y pendientes por separado', () => {
    expect(resumen.total).toMatchObject({ atendidos: 2, ausentes: 1, retirados: 1, noAtendidos: 1, enCurso: 1, demandaEspontanea: 1 });
  });
  it('promedia la espera desde la llegada hasta el primer llamado', () => {
    expect(resumen.total.esperaPromedio).toBe(15);
  });
  it('no cuenta como derivación la asignación inicial de una demanda espontánea', () => {
    expect(resumen.total.derivaciones).toBe(1);
  });
  it('separa por especialidad', () => {
    expect(resumen.porEspecialidad['Clínica'].atendidos).toBe(2);
    expect(resumen.porEspecialidad['Pediatría'].retirados).toBe(1);
  });
});

describe('reportes y exportación (#78)', () => {
  it('el historial simulado es siempre el mismo para la misma fecha', () => {
    expect(historialSimulado('2026-10-20', 'villa-norte', 'Cardiología')).toEqual(historialSimulado('2026-10-20', 'villa-norte', 'Cardiología'));
  });
  it('arma los días del período terminando hoy', () => {
    expect(diasDelPeriodo('2026-10-30', 3)).toEqual(['2026-10-28', '2026-10-29', '2026-10-30']);
    expect(diasDelPeriodo('2026-11-01', 2)).toEqual(['2026-10-31', '2026-11-01']);
  });
  it('suma filas ponderando la espera por atendidos', () => {
    const a = { ...historialSimulado('2026-10-27', 'x', 'y'), atendidos: 10, esperaPromedio: 10 };
    const b = { ...historialSimulado('2026-10-28', 'x', 'y'), atendidos: 30, esperaPromedio: 30 };
    expect(sumarFilas([a, b]).esperaPromedio).toBe(25);
  });
  it('calcula el ausentismo sobre los turnos esperados', () => {
    expect(ausentismo({ atendidos: 8, ausentes: 2, retirados: 0, noAtendidos: 0 })).toBe(20);
    expect(ausentismo({ atendidos: 0, ausentes: 0, retirados: 0, noAtendidos: 0 })).toBeNull();
  });
  it('genera un CSV para Excel en español, sin nombres de pacientes', () => {
    const csv = aCSV([{ ...historialSimulado('2026-10-29', 'Centro; Norte', 'Clínica médica'), esperaPromedio: null }]);
    expect(csv.startsWith('﻿Fecha;Sucursal;Especialidad;')).toBe(true);
    expect(csv).toContain('"Centro; Norte"');
    expect(csv.trim().split('\r\n')).toHaveLength(2);
    expect(csv.trim().endsWith(';')).toBe(true); // espera vacía al final
  });
});
