/**
 * Adaptador SIMULADO del proveedor de turnos (RF-10), del registro de llegada (RF-02)
 * y de la cola de atención (RF-04, RF-05, RF-07, RF-11). Todos los datos son ficticios.
 * Cuando exista el backend NestJS, estas funciones se reemplazan por llamadas HTTP
 * manteniendo los mismos tipos; las pantallas no cambian.
 *
 * La cola se guarda en localStorage para que el tótem, la secretaría y el profesional
 * compartan los datos entre pestañas del mismo navegador durante la demo.
 */
import { evaluarTolerancia, TOLERANCIA_MINUTOS } from './tolerancia';

export type Profesional = { nombre: string; especialidad: string; consultorio: string };

export const PROFESIONALES: Profesional[] = [
  { nombre: 'Dra. Lucía Ferrer', especialidad: 'Clínica médica', consultorio: '4' },
  { nombre: 'Dr. Tomás Vidal', especialidad: 'Cardiología', consultorio: '2' },
  { nombre: 'Dra. Paula Ríos', especialidad: 'Pediatría', consultorio: '6' },
];

export const profesionalPorConsultorio = (consultorio: string) =>
  PROFESIONALES.find((p) => p.consultorio === consultorio) ?? PROFESIONALES[0];

const profesionalPorNombre = (nombre: string) => PROFESIONALES.find((p) => p.nombre === nombre) ?? PROFESIONALES[0];

export type Turno = {
  id: string;
  documento: string;
  afiliado: string;
  paciente: string; // nombre abreviado, nunca el apellido completo
  profesional: string;
  especialidad: string;
  horario: Date;
  consultorio: string;
};

export type EstadoAdmision = 'en-espera' | 'llamado' | 'finalizado' | 'cancelado-tolerancia' | 'ausente';
export type TipoAdmision = 'turno' | 'demanda' | 'contraturno';

export type Admision = {
  numero: string;
  turnoId: string; // id del turno del proveedor, o id propio para demanda y contraturno
  paciente: string;
  profesional: string;
  consultorio: string;
  horaTurno: string; // ISO
  registradaEn: string; // ISO
  estado: EstadoAdmision;
  tipo?: TipoAdmision; // por defecto 'turno'
  llamadoEn?: string; // ISO
  canceladoEn?: string; // ISO
  contraturnoDe?: string; // turnoId de la admisión cancelada que origina el contraturno
  contraturnoAsignado?: string; // número del contraturno ya asignado
  motivo?: string;
};

export type ResultadoBusqueda =
  | { tipo: 'encontrado'; turno: Turno }
  | { tipo: 'no-encontrado' }
  | { tipo: 'tolerancia-vencida'; turno: Turno; admision: Admision }
  | { tipo: 'ya-registrado'; admision: Admision };

export type ColaConsultorio = {
  enEspera: Admision[]; // ordenada: el primero es el próximo paciente
  enAtencion: Admision | null;
  actualizadoEn: Date;
};

export type ColaCentro = {
  registros: Admision[]; // sin finalizados
  actualizadoEn: Date;
};

export class SinConexionError extends Error {
  constructor() {
    super('Sin conexión');
    this.name = 'SinConexionError';
  }
}

export class RegistroError extends Error {
  constructor() {
    super('No se pudo registrar la llegada');
    this.name = 'RegistroError';
  }
}

export class ConsultaError extends Error {
  constructor() {
    super('No se pudo consultar la cola');
    this.name = 'ConsultaError';
  }
}

const minutosDesdeAhora = (min: number) => {
  const d = new Date(Date.now() + min * 60_000);
  d.setSeconds(0, 0);
  return d;
};

/** Turnos que informa el proveedor para hoy. DNIs de demostración: ver README. */
function turnosDelDia(): Turno[] {
  const t = (id: string, documento: string, afiliado: string, paciente: string, consultorio: string, min: number): Turno => {
    const p = profesionalPorConsultorio(consultorio);
    return { id, documento, afiliado, paciente, profesional: p.nombre, especialidad: p.especialidad, horario: minutosDesdeAhora(min), consultorio };
  };
  return [
    t('t-1', '30111222', '100200300', 'Marta R.', '4', 10),
    t('t-2', '28444555', '100200301', 'Jorge P.', '2', -25),
    t('t-3', '25666777', '100200302', 'Ana G.', '6', 5),
    t('t-4', '33888999', '100200303', 'Raúl D.', '4', 20),
  ];
}

/** Pacientes que ya estaban en el centro al abrir la demo. */
function admisionesIniciales(): Record<string, Admision> {
  const a = (turnoId: string, numero: string, paciente: string, consultorio: string, turnoMin: number, llegadaMin: number, extra: Partial<Admision> = {}): Admision => ({
    numero,
    turnoId,
    paciente,
    profesional: profesionalPorConsultorio(consultorio).nombre,
    consultorio,
    horaTurno: minutosDesdeAhora(turnoMin).toISOString(),
    registradaEn: minutosDesdeAhora(llegadaMin).toISOString(),
    estado: 'en-espera',
    tipo: 'turno',
    ...extra,
  });
  return {
    's-1': a('s-1', 'A021', 'Sofía M.', '4', -20, -24),
    's-2': a('s-2', 'A022', 'Carlos B.', '4', 0, -6),
    's-3': a('s-3', 'A018', 'Diego S.', '2', 0, -2),
    's-4': a('s-4', 'A020', 'Carolina V.', '4', -25, -9, { estado: 'cancelado-tolerancia', canceladoEn: minutosDesdeAhora(-9).toISOString() }),
    't-3': a('t-3', 'A019', 'Ana G.', '6', 5, -20),
  };
}

/** El turno t-4 falla en el primer intento de registro (pantalla K09); al reintentar, funciona. */
const fallasPendientes = new Set(['t-4']);

const CLAVE = 'saludplus.admisiones';
let memoria: Record<string, Admision> = admisionesIniciales();

function parametro(nombre: string) {
  return new URLSearchParams(window.location.search).get(nombre);
}

// ?reset=1 vuelve la demo a su estado inicial.
if (parametro('reset') === '1') {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    /* sin almacenamiento disponible */
  }
}

function leerAdmisiones(): Record<string, Admision> {
  try {
    const raw = localStorage.getItem(CLAVE);
    return raw ? { ...memoria, ...JSON.parse(raw) } : { ...memoria };
  } catch {
    return { ...memoria };
  }
}

function guardarAdmision(a: Admision) {
  memoria = { ...memoria, [a.turnoId]: a };
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ ...leerAdmisiones(), [a.turnoId]: a }));
  } catch {
    /* el almacenamiento puede no estar disponible: se mantiene en memoria */
  }
}

function siguienteNumero(): string {
  const usados = Object.values(leerAdmisiones())
    .map((a) => Number(a.numero.slice(1)))
    .filter((n) => !Number.isNaN(n));
  const siguiente = Math.max(22, ...usados) + 1;
  return `A${String(siguiente).padStart(3, '0')}`;
}

const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** ?offline=1 simula un corte de internet; también se detecta el corte real del navegador. */
export function hayConexion() {
  return parametro('offline') !== '1' && navigator.onLine;
}

function verificarConexion() {
  if (!hayConexion()) throw new SinConexionError();
}

function verificarServicio() {
  if (parametro('error') === '1') throw new ConsultaError(); // simula una falla del servidor
}

const nuevaAdmision = (turno: Turno, estado: EstadoAdmision, extra: Partial<Admision> = {}): Admision => ({
  numero: siguienteNumero(),
  turnoId: turno.id,
  paciente: turno.paciente,
  profesional: turno.profesional,
  consultorio: turno.consultorio,
  horaTurno: turno.horario.toISOString(),
  registradaEn: new Date().toISOString(),
  estado,
  tipo: 'turno',
  ...extra,
});

// ---------- Tótem y registro de llegada ----------

export async function buscarTurno(identificador: string, ahora = new Date()): Promise<ResultadoBusqueda> {
  verificarConexion();
  await esperar(600);
  const turno = turnosDelDia().find((t) => t.documento === identificador || t.afiliado === identificador);
  if (!turno) return { tipo: 'no-encontrado' };

  const existente = leerAdmisiones()[turno.id];
  if (existente?.estado === 'cancelado-tolerancia') return { tipo: 'tolerancia-vencida', turno, admision: existente };
  if (existente) return { tipo: 'ya-registrado', admision: existente };

  if (evaluarTolerancia(turno.horario, ahora) === 'vencida') {
    // RF-07: el turno queda cancelado y la secretaría lo ve para ofrecer un contraturno.
    const cancelada = nuevaAdmision(turno, 'cancelado-tolerancia', { canceladoEn: ahora.toISOString() });
    guardarAdmision(cancelada);
    return { tipo: 'tolerancia-vencida', turno, admision: cancelada };
  }
  return { tipo: 'encontrado', turno };
}

export async function registrarLlegada(turno: Turno): Promise<Admision> {
  verificarConexion();
  await esperar(1200);
  if (fallasPendientes.delete(turno.id)) throw new RegistroError();

  const existente = leerAdmisiones()[turno.id];
  if (existente) return existente; // registrar dos veces no duplica la admisión

  const admision = nuevaAdmision(turno, 'en-espera');
  guardarAdmision(admision);
  return admision;
}

// ---------- Secretaría ----------

/** Turnos del proveedor sin llegada y con la tolerancia vencida: se muestran como ausentes. */
function ausentes(registrados: Record<string, Admision>, ahora: Date): Admision[] {
  return turnosDelDia()
    .filter((t) => !registrados[t.id] && evaluarTolerancia(t.horario, ahora) === 'vencida')
    .map((t) => ({
      numero: '—',
      turnoId: t.id,
      paciente: t.paciente,
      profesional: t.profesional,
      consultorio: t.consultorio,
      horaTurno: t.horario.toISOString(),
      registradaEn: t.horario.toISOString(),
      estado: 'ausente' as const,
      tipo: 'turno' as const,
    }));
}

export async function obtenerColaCentro(ahora = new Date()): Promise<ColaCentro> {
  verificarConexion();
  await esperar(700);
  verificarServicio();
  const registradas = leerAdmisiones();
  const registros = [...Object.values(registradas), ...ausentes(registradas, ahora)]
    .filter((a) => a.estado !== 'finalizado')
    .sort((a, b) => b.registradaEn.localeCompare(a.registradaEn));
  return { registros, actualizadoEn: new Date() };
}

/** RF-11: nueva atención en la cola del día para un turno cancelado por tolerancia. */
export async function registrarContraturno(cancelada: Admision, profesional: string, motivo: string): Promise<Admision> {
  verificarConexion();
  await esperar(700);
  verificarServicio();
  const actual = leerAdmisiones()[cancelada.turnoId] ?? cancelada;
  if (actual.contraturnoAsignado) {
    const ya = Object.values(leerAdmisiones()).find((a) => a.numero === actual.contraturnoAsignado);
    if (ya) return ya; // no duplica contraturnos
  }
  const p = profesionalPorNombre(profesional);
  const ahora = new Date().toISOString();
  const contraturno: Admision = {
    numero: siguienteNumero(),
    turnoId: `c-${cancelada.turnoId}`,
    paciente: cancelada.paciente,
    profesional: p.nombre,
    consultorio: p.consultorio,
    horaTurno: ahora,
    registradaEn: ahora,
    estado: 'en-espera',
    tipo: 'contraturno',
    contraturnoDe: cancelada.turnoId,
    motivo,
  };
  guardarAdmision(contraturno);
  guardarAdmision({ ...actual, contraturnoAsignado: contraturno.numero });
  return contraturno;
}

/** RF-05: paciente sin turno previo que se incorpora a la cola. */
export async function registrarDemandaEspontanea(paciente: string, profesional: string): Promise<Admision> {
  verificarConexion();
  await esperar(700);
  verificarServicio();
  const p = profesionalPorNombre(profesional);
  const ahora = new Date().toISOString();
  const admision: Admision = {
    numero: siguienteNumero(),
    turnoId: `d-${Date.now()}`,
    paciente,
    profesional: p.nombre,
    consultorio: p.consultorio,
    horaTurno: ahora,
    registradaEn: ahora,
    estado: 'en-espera',
    tipo: 'demanda',
  };
  guardarAdmision(admision);
  return admision;
}

/** RF-06: demora del profesional según el paciente que más espera desde su horario. */
export function calcularDemoras(registros: Admision[], ahora: Date): { profesional: string; consultorio: string; minutos: number }[] {
  const porProfesional = new Map<string, Admision>();
  for (const a of registros) {
    if (a.estado !== 'en-espera') continue;
    const previo = porProfesional.get(a.profesional);
    if (!previo || a.horaTurno < previo.horaTurno) porProfesional.set(a.profesional, a);
  }
  return [...porProfesional.values()]
    .map((a) => ({
      profesional: a.profesional,
      consultorio: a.consultorio,
      minutos: Math.round((ahora.getTime() - new Date(a.horaTurno).getTime()) / 60_000),
    }))
    .filter((d) => d.minutos > TOLERANCIA_MINUTOS)
    .sort((a, b) => b.minutos - a.minutos);
}

// ---------- Vista del profesional ----------

/** Orden de atención: por horario del turno y, si empatan, por llegada. */
function ordenarCola(a: Admision, b: Admision) {
  return a.horaTurno.localeCompare(b.horaTurno) || a.registradaEn.localeCompare(b.registradaEn);
}

export async function obtenerCola(consultorio: string): Promise<ColaConsultorio> {
  verificarConexion();
  await esperar(500);
  verificarServicio();
  const delConsultorio = Object.values(leerAdmisiones()).filter((a) => a.consultorio === consultorio);
  return {
    enEspera: delConsultorio.filter((a) => a.estado === 'en-espera').sort(ordenarCola),
    enAtencion: delConsultorio.find((a) => a.estado === 'llamado') ?? null,
    actualizadoEn: new Date(),
  };
}

/** Llama al primer paciente en espera. Si ya hay uno en atención, no llama a otro. */
export async function llamarSiguiente(consultorio: string): Promise<Admision> {
  verificarConexion();
  await esperar(500);
  const cola = await obtenerCola(consultorio);
  if (cola.enAtencion) return cola.enAtencion;
  const siguiente = cola.enEspera[0];
  if (!siguiente) throw new ConsultaError();
  const llamado: Admision = { ...siguiente, estado: 'llamado', llamadoEn: new Date().toISOString() };
  guardarAdmision(llamado);
  return llamado;
}

export async function finalizarAtencion(admision: Admision): Promise<void> {
  verificarConexion();
  await esperar(400);
  guardarAdmision({ ...admision, estado: 'finalizado' });
}

/** Avisa cuando otra pestaña cambia la cola. */
export function escucharCambios(alCambiar: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === CLAVE || e.key === null) alCambiar();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
