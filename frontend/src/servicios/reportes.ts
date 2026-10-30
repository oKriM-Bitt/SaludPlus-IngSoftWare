/**
 * Resúmenes e indicadores (#69, #78). Funciones puras: se prueban sin navegador.
 * Nunca incluyen nombres ni datos de salud de pacientes.
 */

/** Datos mínimos de una admisión que necesitan los resúmenes. */
export type RegistroResumen = {
  estado: string;
  registradaEn: string;
  llamadoEn?: string;
  tipo?: string;
  derivaciones?: { desde: string }[];
};

export type Indicadores = {
  registrados: number; // llegadas registradas (sin ausentes del proveedor)
  atendidos: number;
  ausentes: number;
  retirados: number; // se fueron sin ser atendidos (#64)
  noAtendidos: number; // quedaron pendientes al cierre (#69)
  reprogramados: number;
  canceladosTolerancia: number;
  derivaciones: number; // entre profesionales (no cuenta la asignación inicial de una demanda)
  demandaEspontanea: number;
  enCurso: number; // todavía en espera o en atención
  esperaPromedio: number | null; // minutos entre la llegada y el primer llamado
};

export type ResumenDia = { total: Indicadores; porEspecialidad: Record<string, Indicadores> };

const vacio = (): Indicadores => ({
  registrados: 0,
  atendidos: 0,
  ausentes: 0,
  retirados: 0,
  noAtendidos: 0,
  reprogramados: 0,
  canceladosTolerancia: 0,
  derivaciones: 0,
  demandaEspontanea: 0,
  enCurso: 0,
  esperaPromedio: null,
});

function sumar(ind: Indicadores, a: RegistroResumen, esperas: number[]) {
  if (a.estado !== 'ausente' || a.llamadoEn) ind.registrados++;
  if (a.estado === 'finalizado') ind.atendidos++;
  if (a.estado === 'ausente') ind.ausentes++;
  if (a.estado === 'se-retiro') ind.retirados++;
  if (a.estado === 'no-atendido') ind.noAtendidos++;
  if (a.estado === 'reprogramado') ind.reprogramados++;
  if (a.estado === 'cancelado-tolerancia') ind.canceladosTolerancia++;
  if (a.estado === 'en-espera' || a.estado === 'llamado') ind.enCurso++;
  if (a.tipo === 'demanda') ind.demandaEspontanea++;
  ind.derivaciones += (a.derivaciones ?? []).filter((d) => d.desde).length;
  if (a.llamadoEn) esperas.push(Math.max(0, (new Date(a.llamadoEn).getTime() - new Date(a.registradaEn).getTime()) / 60_000));
}

const promedio = (xs: number[]) => (xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

export function resumirDia<T extends RegistroResumen>(registros: T[], especialidadDe: (a: T) => string): ResumenDia {
  const total = vacio();
  const esperasTotal: number[] = [];
  const porEspecialidad: Record<string, Indicadores> = {};
  const esperasPor: Record<string, number[]> = {};
  for (const a of registros) {
    const esp = especialidadDe(a);
    porEspecialidad[esp] ??= vacio();
    esperasPor[esp] ??= [];
    sumar(total, a, esperasTotal);
    sumar(porEspecialidad[esp], a, esperasPor[esp]);
  }
  total.esperaPromedio = promedio(esperasTotal);
  for (const esp of Object.keys(porEspecialidad)) porEspecialidad[esp].esperaPromedio = promedio(esperasPor[esp]);
  return { total, porEspecialidad };
}

// ---------- Historial simulado para los reportes de la demo ----------

/** Generador pseudoaleatorio con semilla: los mismos datos en cada apertura. */
function generador(semilla: string) {
  let h = 2166136261;
  for (const c of semilla) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export type FilaReporte = { fecha: string; sucursal: string; especialidad: string } & Omit<Indicadores, 'enCurso'>;

/** Días anteriores simulados de una sucursal y especialidad (datos ficticios). */
export function historialSimulado(fecha: string, sucursal: string, especialidad: string): FilaReporte {
  const r = generador(`${fecha}|${sucursal}|${especialidad}`);
  const dia = new Date(`${fecha}T12:00:00`).getDay();
  const factor = dia === 0 ? 0 : dia === 6 ? 0.4 : 1;
  const atendidos = Math.round((14 + r() * 16) * factor);
  const ausentes = Math.round((1 + r() * 4) * factor);
  const retirados = Math.round(r() * 3 * factor);
  const noAtendidos = Math.round(r() * 2 * factor);
  const cancelados = Math.round(r() * 3 * factor);
  return {
    fecha,
    sucursal,
    especialidad,
    registrados: atendidos + retirados + noAtendidos,
    atendidos,
    ausentes,
    retirados,
    noAtendidos,
    reprogramados: Math.round(r() * 2 * factor),
    canceladosTolerancia: cancelados,
    derivaciones: Math.round(r() * 3 * factor),
    demandaEspontanea: Math.round((1 + r() * 5) * factor),
    esperaPromedio: atendidos ? Math.round(8 + r() * 30) : null,
  };
}

/** Días del período, del más antiguo al más reciente, terminando en `hasta`. */
export function diasDelPeriodo(hasta: string, cantidad: number): string[] {
  const fin = new Date(`${hasta}T12:00:00`);
  return Array.from({ length: cantidad }, (_, i) => {
    const d = new Date(fin);
    d.setDate(fin.getDate() - (cantidad - 1 - i));
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
}

/** Suma filas (por ejemplo, de varios días o sucursales). La espera promedio se pondera por atendidos. */
export function sumarFilas(filas: FilaReporte[]): Omit<FilaReporte, 'fecha' | 'sucursal' | 'especialidad'> {
  const t = { ...vacio() } as Omit<Indicadores, 'enCurso'> & { enCurso?: number };
  delete t.enCurso;
  let pesoEspera = 0;
  let sumaEspera = 0;
  for (const f of filas) {
    t.registrados += f.registrados;
    t.atendidos += f.atendidos;
    t.ausentes += f.ausentes;
    t.retirados += f.retirados;
    t.noAtendidos += f.noAtendidos;
    t.reprogramados += f.reprogramados;
    t.canceladosTolerancia += f.canceladosTolerancia;
    t.derivaciones += f.derivaciones;
    t.demandaEspontanea += f.demandaEspontanea;
    if (f.esperaPromedio !== null && f.atendidos > 0) {
      sumaEspera += f.esperaPromedio * f.atendidos;
      pesoEspera += f.atendidos;
    }
  }
  return { ...t, esperaPromedio: pesoEspera ? Math.round(sumaEspera / pesoEspera) : null };
}

/** Porcentaje de ausentismo sobre los turnos esperados (atendidos + ausentes + retirados + no atendidos). */
export function ausentismo(f: Pick<Indicadores, 'atendidos' | 'ausentes' | 'retirados' | 'noAtendidos'>): number | null {
  const base = f.atendidos + f.ausentes + f.retirados + f.noAtendidos;
  return base ? Math.round((f.ausentes / base) * 100) : null;
}

// ---------- Exportación (#78) ----------

export const COLUMNAS_REPORTE: [keyof FilaReporte, string][] = [
  ['fecha', 'Fecha'],
  ['sucursal', 'Sucursal'],
  ['especialidad', 'Especialidad'],
  ['registrados', 'Llegadas registradas'],
  ['atendidos', 'Atendidos'],
  ['ausentes', 'Ausentes'],
  ['retirados', 'Se retiraron'],
  ['noAtendidos', 'No atendidos al cierre'],
  ['reprogramados', 'Reprogramados'],
  ['canceladosTolerancia', 'Cancelados por tolerancia'],
  ['derivaciones', 'Derivaciones'],
  ['demandaEspontanea', 'Demanda espontánea'],
  ['esperaPromedio', 'Espera promedio (min)'],
];

/** CSV con punto y coma y BOM, como lo abre Excel en español. */
export function aCSV(filas: FilaReporte[]): string {
  const celda = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const encabezado = COLUMNAS_REPORTE.map(([, t]) => celda(t)).join(';');
  const cuerpo = filas.map((f) => COLUMNAS_REPORTE.map(([k]) => celda(f[k])).join(';'));
  return '﻿' + [encabezado, ...cuerpo].join('\r\n') + '\r\n';
}
