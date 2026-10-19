/**
 * Adaptador SIMULADO del proveedor de turnos (RF-10), del registro de llegada (RF-02)
 * y de la cola de atención (RF-04). Todos los datos son ficticios.
 * Cuando exista el backend NestJS, estas funciones se reemplazan por llamadas HTTP
 * manteniendo los mismos tipos; las pantallas no cambian.
 *
 * La cola se guarda en localStorage para que el tótem y la vista del profesional
 * compartan los datos entre pestañas del mismo navegador durante la demo.
 */
import { evaluarTolerancia } from './tolerancia';

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

export type EstadoAdmision = 'en-espera' | 'llamado' | 'finalizado';

export type Admision = {
  numero: string;
  turnoId: string;
  paciente: string;
  profesional: string;
  consultorio: string;
  horaTurno: string; // ISO
  registradaEn: string; // ISO
  estado: EstadoAdmision;
  llamadoEn?: string; // ISO
};

export type ResultadoBusqueda =
  | { tipo: 'encontrado'; turno: Turno }
  | { tipo: 'no-encontrado' }
  | { tipo: 'tolerancia-vencida'; turno: Turno }
  | { tipo: 'ya-registrado'; admision: Admision };

export type ColaConsultorio = {
  enEspera: Admision[]; // ordenada: el primero es el próximo paciente
  enAtencion: Admision | null;
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

/** DNIs de demostración: ver README. */
function turnosDelDia(): Turno[] {
  return [
    { id: 't-1', documento: '30111222', afiliado: '100200300', paciente: 'Marta R.', profesional: 'Dra. Lucía Ferrer', especialidad: 'Clínica médica', horario: minutosDesdeAhora(10), consultorio: '4' },
    { id: 't-2', documento: '28444555', afiliado: '100200301', paciente: 'Jorge P.', profesional: 'Dr. Martín Sosa', especialidad: 'Cardiología', horario: minutosDesdeAhora(-25), consultorio: '2' },
    { id: 't-3', documento: '25666777', afiliado: '100200302', paciente: 'Ana G.', profesional: 'Dra. Paula Ríos', especialidad: 'Pediatría', horario: minutosDesdeAhora(5), consultorio: '6' },
    { id: 't-4', documento: '33888999', afiliado: '100200303', paciente: 'Raúl D.', profesional: 'Dra. Lucía Ferrer', especialidad: 'Clínica médica', horario: minutosDesdeAhora(20), consultorio: '4' },
  ];
}

/** Pacientes que ya llegaron antes de abrir la demo (consultorio 4 y 6). */
function admisionesIniciales(): Record<string, Admision> {
  const base = (turnoId: string, numero: string, paciente: string, profesional: string, consultorio: string, turnoMin: number, llegadaMin: number): Admision => ({
    numero,
    turnoId,
    paciente,
    profesional,
    consultorio,
    horaTurno: minutosDesdeAhora(turnoMin).toISOString(),
    registradaEn: minutosDesdeAhora(llegadaMin).toISOString(),
    estado: 'en-espera',
  });
  return {
    's-1': base('s-1', 'A021', 'Sofía M.', 'Dra. Lucía Ferrer', '4', -10, -14),
    's-2': base('s-2', 'A022', 'Carlos B.', 'Dra. Lucía Ferrer', '4', 0, -6),
    't-3': base('t-3', 'A019', 'Ana G.', 'Dra. Paula Ríos', '6', 5, -20),
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
  const usados = Object.values(leerAdmisiones()).map((a) => Number(a.numero.slice(1)));
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

// ---------- Tótem ----------

export async function buscarTurno(identificador: string, ahora = new Date()): Promise<ResultadoBusqueda> {
  verificarConexion();
  await esperar(600);
  const turno = turnosDelDia().find((t) => t.documento === identificador || t.afiliado === identificador);
  if (!turno) return { tipo: 'no-encontrado' };

  const admision = leerAdmisiones()[turno.id];
  if (admision) return { tipo: 'ya-registrado', admision };

  if (evaluarTolerancia(turno.horario, ahora) === 'vencida') return { tipo: 'tolerancia-vencida', turno };
  return { tipo: 'encontrado', turno };
}

export async function registrarLlegada(turno: Turno): Promise<Admision> {
  verificarConexion();
  await esperar(1200);
  if (fallasPendientes.delete(turno.id)) throw new RegistroError();

  const existente = leerAdmisiones()[turno.id];
  if (existente) return existente; // registrar dos veces no duplica la admisión

  const admision: Admision = {
    numero: siguienteNumero(),
    turnoId: turno.id,
    paciente: turno.paciente,
    profesional: turno.profesional,
    consultorio: turno.consultorio,
    horaTurno: turno.horario.toISOString(),
    registradaEn: new Date().toISOString(),
    estado: 'en-espera',
  };
  guardarAdmision(admision);
  return admision;
}

// ---------- Vista del profesional ----------

/** Orden de atención: por horario del turno y, si empatan, por llegada. */
function ordenarCola(a: Admision, b: Admision) {
  return a.horaTurno.localeCompare(b.horaTurno) || a.registradaEn.localeCompare(b.registradaEn);
}

export async function obtenerCola(consultorio: string): Promise<ColaConsultorio> {
  verificarConexion();
  await esperar(500);
  if (parametro('error') === '1') throw new ConsultaError(); // simula una falla del servidor (P05)
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

/** Avisa cuando otra pestaña (por ejemplo, el tótem) cambia la cola. */
export function escucharCambios(alCambiar: () => void): () => void {
  const handler = (e: StorageEvent) => {
    if (e.key === CLAVE || e.key === null) alCambiar();
  };
  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
