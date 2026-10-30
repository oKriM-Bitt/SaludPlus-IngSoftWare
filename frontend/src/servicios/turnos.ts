/**
 * Adaptador SIMULADO del proveedor de turnos (RF-10), del registro de llegada (RF-02)
 * y de la cola de atención (RF-04, RF-05, RF-07, RF-11). Todos los datos son ficticios.
 * Cuando exista el backend NestJS, estas funciones se reemplazan por llamadas HTTP
 * manteniendo los mismos tipos; las pantallas no cambian.
 *
 * La cola se guarda en localStorage para que el tótem, la secretaría y el profesional
 * compartan los datos entre pestañas del mismo navegador durante la demo.
 * Cada registro pertenece a una sucursal (#56): cada pantalla ve solo la suya.
 */
import { evaluarLlegada, evaluarTolerancia, TOLERANCIA_MINUTOS } from './tolerancia';
import { estimarEspera, MINUTOS_POR_CONSULTA } from './espera';
import { pacientesSaltados } from './llamados';
import { borrar, escribirJSON, escucharClaves, hoy, leerJSON, parametroURL } from './almacen';
import { escucharConfiguracion, nombreSucursal, parametros, profesionalesDelDia, sucursalPorId } from './configuracion';
import { CLAVE_AUDITORIA, obtenerAuditoria, registrarAuditoria, type RegistroAuditoria } from './auditoria';
import { quienSoy, sucursalActiva } from './contexto';
import { escucharSesion } from './sesion';
import { resumirDia, type ResumenDia } from './reportes';

export { MINUTOS_POR_CONSULTA, obtenerAuditoria, type RegistroAuditoria };

export type Profesional = { id?: string; nombre: string; especialidad: string; consultorio: string };

/**
 * Profesionales que atienden hoy en la sucursal activa, según la agenda que carga dirección (#60).
 * Se actualizan solos al cambiar la configuración o la sucursal de la sesión.
 */
export let PROFESIONALES: Profesional[] = [];

/** #43: servicios o especialidades que atiende la sucursal (se derivan de los profesionales). */
export let SERVICIOS: string[] = [];

function refrescarProfesionales() {
  PROFESIONALES = profesionalesDelDia(sucursalActiva());
  SERVICIOS = [...new Set(PROFESIONALES.map((p) => p.especialidad))];
}
refrescarProfesionales();
escucharConfiguracion(refrescarProfesionales);
escucharSesion(refrescarProfesionales);

const SIN_PROFESIONAL: Profesional = { nombre: '', especialidad: '', consultorio: '' };

export const profesionalPorConsultorio = (consultorio: string) =>
  PROFESIONALES.find((p) => p.consultorio === consultorio) ?? PROFESIONALES[0] ?? SIN_PROFESIONAL;

const profesionalPorNombre = (nombre: string) => PROFESIONALES.find((p) => p.nombre === nombre) ?? PROFESIONALES[0] ?? SIN_PROFESIONAL;

export const profesionalesDelServicio = (servicio: string) => PROFESIONALES.filter((p) => p.especialidad === servicio);

/** Especialidad de una admisión: la del servicio elegido o la de su profesional. */
export const especialidadDe = (a: Admision) => a.servicio || PROFESIONALES.find((p) => p.nombre === a.profesional)?.especialidad || 'Sin especialidad';

export type Turno = {
  id: string;
  documento: string;
  afiliado: string;
  paciente: string; // nombre abreviado, nunca el apellido completo
  profesional: string;
  especialidad: string;
  horario: Date;
  consultorio: string;
  sucursal: string; // #56
  anioNacimiento: string; // #54: dato extra para distinguir personas con el mismo número
};

export type EstadoAdmision =
  | 'en-espera'
  | 'llamado'
  | 'finalizado'
  | 'cancelado-tolerancia'
  | 'ausente'
  | 'se-retiro' // #64
  | 'no-atendido' // #69: quedó pendiente al cerrar el día
  | 'reprogramado'; // #69: el proveedor le dio otro turno
export type TipoAdmision = 'turno' | 'demanda' | 'contraturno';

/** #58: registro de cada derivación o asignación de profesional. */
export type Derivacion = { desde: string; hacia: string; motivo: string; fecha: string; usuario: string };

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
  sucursal?: string; // #56: por defecto la primera sucursal
  llamadoEn?: string; // ISO del último llamado
  llamados?: number; // cantidad de veces que se llamó (#41)
  ausenteEn?: string; // ISO: no se presentó después de los llamados
  canceladoEn?: string; // ISO
  contraturnoDe?: string; // turnoId de la admisión cancelada que origina el contraturno
  contraturnoAsignado?: string; // número del contraturno ya asignado
  motivo?: string;
  servicio?: string; // #43: servicio elegido en el tótem o especialidad del profesional
  documento?: string; // DNI ficticio: evita duplicados y agrupa turnos del mismo paciente; nunca se muestra
  derivaciones?: Derivacion[]; // #58
  retiradoEn?: string; // #64
  motivoRetiro?: string; // #64
  finalizadoEn?: string; // ISO
};

/** DEV-33: una demanda espontánea del tótem queda sin profesional hasta que la secretaría lo asigna. */
export const sinProfesional = (a: Admision) => !a.profesional;

export type ResultadoBusqueda =
  | { tipo: 'encontrado'; turno: Turno }
  | { tipo: 'no-encontrado' }
  | { tipo: 'tolerancia-vencida'; turno: Turno; admision: Admision }
  | { tipo: 'ya-registrado'; admision: Admision }
  | { tipo: 'otro-servicio'; turno: Turno } // #43: el turno es de otro servicio que el elegido en el tótem
  | { tipo: 'varias-personas'; personas: { paciente: string; documento: string }[] } // #54: el número coincide con más de una persona
  | { tipo: 'varios-turnos'; turnos: Turno[]; registrados: Admision[] } // #54: la persona tiene más de un turno hoy
  | { tipo: 'otra-sucursal'; turno: Turno; sucursal: string } // #56: nombre de la sucursal del turno
  | { tipo: 'muy-temprano'; turno: Turno; desde: Date } // #75
  | { tipo: 'dia-cerrado' }; // #69

/** DEV-33: resultado de identificar en el tótem a un paciente que dice no tener turno. */
export type ResultadoSinTurno =
  | { tipo: 'identificado'; paciente: string }
  | { tipo: 'no-encontrado' }
  | { tipo: 'tiene-turno'; turno: Turno } // tiene un turno hoy: debe seguir el camino "Tengo turno"
  | { tipo: 'turno-vencido' } // su turno de hoy venció: la secretaría ofrece contraturno
  | { tipo: 'ya-registrado'; admision: Admision }
  | { tipo: 'dia-cerrado' }; // #69

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

/** #69: la sucursal ya cerró la atención del día. */
export class DiaCerradoError extends Error {
  constructor() {
    super('El día ya está cerrado');
    this.name = 'DiaCerradoError';
  }
}

/** La operación no corresponde al estado actual del paciente (por ejemplo, anular a alguien ya llamado). */
export class OperacionNoPermitidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'OperacionNoPermitidaError';
  }
}

/** #42: hay un paciente en atención; hay que finalizarlo antes de llamar a otro. */
export class PacienteEnAtencionError extends Error {
  constructor(public enAtencion: Admision) {
    super('Hay un paciente en atención');
    this.name = 'PacienteEnAtencionError';
  }
}

/** #42: el paciente elegido ya no está en espera (lo llamó otro equipo o cambió su estado). */
export class PacienteNoDisponibleError extends Error {
  constructor() {
    super('El paciente ya no está en espera');
    this.name = 'PacienteNoDisponibleError';
  }
}

const minutosDesdeAhora = (min: number) => {
  const d = new Date(Date.now() + min * 60_000);
  d.setSeconds(0, 0);
  return d;
};

const PRIMERA_SUCURSAL = 'villa-norte';
const sucursalDe = (a: { sucursal?: string }) => a.sucursal ?? PRIMERA_SUCURSAL;

/** Datos fijos de cada turno de la demo: el consultorio sale de la agenda del profesional (#60). */
type TurnoBase = { id: string; documento: string; afiliado: string; paciente: string; profesional: string; sucursal: string; min: number; anio: string };

const TURNOS_BASE: TurnoBase[] = [
  { id: 't-1', documento: '30111222', afiliado: '100200300', paciente: 'Marta R.', profesional: 'p-ferrer', sucursal: 'villa-norte', min: 10, anio: '1983' },
  { id: 't-2', documento: '28444555', afiliado: '100200301', paciente: 'Jorge P.', profesional: 'p-vidal', sucursal: 'villa-norte', min: -25, anio: '1980' },
  { id: 't-3', documento: '25666777', afiliado: '100200302', paciente: 'Ana G.', profesional: 'p-rios', sucursal: 'villa-norte', min: 5, anio: '2019' },
  { id: 't-4', documento: '33888999', afiliado: '100200303', paciente: 'Raúl D.', profesional: 'p-ferrer', sucursal: 'villa-norte', min: 20, anio: '1988' },
  // #54: la misma persona con dos turnos hoy.
  { id: 't-5', documento: '29777888', afiliado: '100200310', paciente: 'Luis M.', profesional: 'p-vidal', sucursal: 'villa-norte', min: 15, anio: '1982' },
  { id: 't-6', documento: '29777888', afiliado: '100200310', paciente: 'Luis M.', profesional: 'p-luna', sucursal: 'villa-norte', min: 45, anio: '1982' },
  // #54: el mismo número de afiliado del grupo familiar para dos personas.
  { id: 't-7', documento: '20111999', afiliado: '100200500', paciente: 'Elsa F.', profesional: 'p-luna', sucursal: 'villa-norte', min: 25, anio: '1958' },
  { id: 't-8', documento: '45222111', afiliado: '100200500', paciente: 'Tomás F.', profesional: 'p-rios', sucursal: 'villa-norte', min: 30, anio: '2014' },
  // #75: llega demasiado temprano.
  { id: 't-9', documento: '26444333', afiliado: '100200320', paciente: 'Sergio V.', profesional: 'p-vidal', sucursal: 'villa-norte', min: 150, anio: '1979' },
  // #56: turnos de otra sucursal.
  { id: 't-10', documento: '24111333', afiliado: '100200330', paciente: 'Nora P.', profesional: 'p-aguirre', sucursal: 'guemes', min: 10, anio: '1975' },
  { id: 't-11', documento: '35222444', afiliado: '100200331', paciente: 'Iván R.', profesional: 'p-sosa', sucursal: 'guemes', min: 5, anio: '2018' },
];

/** Turnos que informa el proveedor para hoy, de todas las sucursales. DNIs de demostración: ver README. */
function turnosDelDia(): Turno[] {
  const turnos: Turno[] = [];
  for (const b of TURNOS_BASE) {
    const p = profesionalesDelDia(b.sucursal).find((x) => x.id === b.profesional);
    if (!p) continue; // el profesional no atiende hoy en esa sucursal según la agenda
    turnos.push({
      id: b.id,
      documento: b.documento,
      afiliado: b.afiliado,
      paciente: b.paciente,
      profesional: p.nombre,
      especialidad: p.especialidad,
      horario: minutosDesdeAhora(b.min),
      consultorio: p.consultorio,
      sucursal: b.sucursal,
      anioNacimiento: b.anio,
    });
  }
  return turnos;
}

/** #54: cuántos turnos tiene hoy ese documento en la sucursal activa. */
export function turnosHoyDe(documento: string | undefined): number {
  if (!documento) return 0;
  const sucursal = sucursalActiva();
  return turnosDelDia().filter((t) => t.documento === documento && t.sucursal === sucursal).length;
}

/** Pacientes que ya estaban en el centro al abrir la demo. */
function admisionesIniciales(): Record<string, Admision> {
  const consultorioDe = (profesional: string, sucursal: string) => profesionalesDelDia(sucursal).find((p) => p.nombre === profesional)?.consultorio ?? '';
  const a = (turnoId: string, numero: string, paciente: string, profesional: string, turnoMin: number, llegadaMin: number, extra: Partial<Admision> = {}): Admision => {
    const sucursal = extra.sucursal ?? PRIMERA_SUCURSAL;
    return {
      numero,
      turnoId,
      paciente,
      profesional,
      consultorio: consultorioDe(profesional, sucursal),
      horaTurno: minutosDesdeAhora(turnoMin).toISOString(),
      registradaEn: minutosDesdeAhora(llegadaMin).toISOString(),
      estado: 'en-espera',
      tipo: 'turno',
      sucursal,
      ...extra,
    };
  };
  const ferrer = 'Dra. Lucía Ferrer';
  const vidal = 'Dr. Tomás Vidal';
  const rios = 'Dra. Paula Ríos';
  const fin = (min: number): Partial<Admision> => ({ estado: 'finalizado', llamadoEn: minutosDesdeAhora(min).toISOString(), finalizadoEn: minutosDesdeAhora(min + 12).toISOString() });
  const guemes: Partial<Admision> = { sucursal: 'guemes' };
  return {
    's-1': a('s-1', 'A021', 'Sofía M.', ferrer, -20, -24, { documento: '31000111' }),
    's-2': a('s-2', 'A022', 'Carlos B.', ferrer, 0, -6, { documento: '31000222' }),
    's-3': a('s-3', 'A018', 'Diego S.', vidal, 0, -2, { documento: '31000333' }),
    's-4': a('s-4', 'A020', 'Carolina V.', ferrer, -25, -9, { estado: 'cancelado-tolerancia', canceladoEn: minutosDesdeAhora(-9).toISOString(), documento: '31000444' }),
    't-3': a('t-3', 'A019', 'Ana G.', rios, 5, -20, { documento: '25666777' }),
    // Atenciones ya realizadas esta mañana: alimentan los últimos llamados de la sala y el resumen del día.
    'h-1': a('h-1', 'A014', 'Rosa L.', vidal, -60, -70, fin(-40)),
    'h-2': a('h-2', 'A015', 'Hugo F.', rios, -50, -60, fin(-30)),
    'h-3': a('h-3', 'A016', 'Inés C.', ferrer, -45, -50, fin(-18)),
    'h-4': a('h-4', 'A017', 'Raquel N.', vidal, -30, -35, fin(-8)),
    // Centro Güemes
    'g-1': a('g-1', 'B010', 'Rita S.', 'Dr. Martín Aguirre', -5, -12, { ...guemes, documento: '32000111' }),
    'g-2': a('g-2', 'B011', 'Omar K.', 'Dra. Inés Sosa', 0, -4, { ...guemes, documento: '32000222' }),
    'g-3': a('g-3', 'B009', 'Lidia P.', 'Dr. Martín Aguirre', -40, -45, { ...guemes, ...fin(-25) }),
  };
}

/**
 * DEV-33: padrón SIMULADO de afiliados para identificar a quien llega sin turno.
 * Incluye a los pacientes con turno y dos afiliados sin turno hoy. Datos ficticios.
 */
function padron(): { documento: string; paciente: string }[] {
  return [
    ...turnosDelDia().map((t) => ({ documento: t.documento, paciente: t.paciente })),
    { documento: '27123456', paciente: 'Elena T.' },
    { documento: '31555666', paciente: 'Pablo Q.' },
  ];
}

/** El turno t-4 falla en el primer intento de registro (pantalla K09); al reintentar, funciona. */
const fallasPendientes = new Set(['t-4']);

const CLAVE = 'saludplus.admisiones';
const CLAVE_ESTADOS = 'saludplus.profesionales.estado';
const CLAVE_CIERRES = 'saludplus.cierres';
let memoria: Record<string, Admision> = admisionesIniciales();

// Si cambia la agenda, los pacientes de la demo toman el consultorio nuevo.
escucharConfiguracion(() => {
  memoria = admisionesIniciales();
});

function parametro(nombre: string) {
  return parametroURL(nombre);
}

// ?reset=1 vuelve la demo a su estado inicial.
if (parametro('reset') === '1') {
  [CLAVE, CLAVE_ESTADOS, CLAVE_CIERRES, CLAVE_AUDITORIA].forEach(borrar);
}

const CLAVE_ANULADAS = 'saludplus.anuladas';
if (parametro('reset') === '1') borrar(CLAVE_ANULADAS);

/** Todas las admisiones de todas las sucursales, sin las anuladas (#65). */
function leerTodas(): Record<string, Admision> {
  const anuladas = new Set(leerJSON<string[]>(CLAVE_ANULADAS, []));
  const todas = { ...memoria, ...leerJSON<Record<string, Admision>>(CLAVE, {}) };
  return Object.fromEntries(Object.entries(todas).filter(([id]) => !anuladas.has(id)));
}

/** Admisiones de la sucursal activa (#56). */
function leerAdmisiones(): Record<string, Admision> {
  const sucursal = sucursalActiva();
  return Object.fromEntries(Object.entries(leerTodas()).filter(([, a]) => sucursalDe(a) === sucursal));
}

function guardarAdmision(a: Admision) {
  memoria = { ...memoria, [a.turnoId]: a };
  escribirJSON(CLAVE, { ...leerJSON<Record<string, Admision>>(CLAVE, {}), [a.turnoId]: a });
  // Un turno anulado por error que se vuelve a registrar deja de estar anulado.
  const anuladas = leerJSON<string[]>(CLAVE_ANULADAS, []);
  if (anuladas.includes(a.turnoId)) escribirJSON(CLAVE_ANULADAS, anuladas.filter((id) => id !== a.turnoId));
}

/**
 * #65: quita una admisión de la cola. Solo se usa al anular una llegada (queda en la auditoría).
 * Se anota como anulada para que los pacientes de la demo, que viven en memoria, no reaparezcan.
 */
function eliminarAdmision(turnoId: string) {
  const guardadas = leerJSON<Record<string, Admision>>(CLAVE, {});
  delete guardadas[turnoId];
  escribirJSON(CLAVE, guardadas);
  const anuladas = leerJSON<string[]>(CLAVE_ANULADAS, []);
  if (!anuladas.includes(turnoId)) escribirJSON(CLAVE_ANULADAS, [...anuladas, turnoId]);
}

function siguienteNumero(sucursal = sucursalActiva()): string {
  const prefijo = sucursalPorId(sucursal)?.prefijo ?? 'A';
  const base = prefijo === 'A' ? 22 : 11;
  const usados = Object.values(leerTodas())
    .filter((a) => a.numero.startsWith(prefijo))
    .map((a) => Number(a.numero.slice(prefijo.length)))
    .filter((n) => !Number.isNaN(n));
  const siguiente = Math.max(base, ...usados) + 1;
  return `${prefijo}${String(siguiente).padStart(3, '0')}`;
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

function verificarDiaAbierto() {
  if (diaCerrado()) throw new DiaCerradoError();
}

const nuevaAdmision = (turno: Turno, estado: EstadoAdmision, extra: Partial<Admision> = {}): Admision => ({
  numero: siguienteNumero(turno.sucursal),
  turnoId: turno.id,
  paciente: turno.paciente,
  profesional: turno.profesional,
  consultorio: turno.consultorio,
  horaTurno: turno.horario.toISOString(),
  registradaEn: new Date().toISOString(),
  estado,
  tipo: 'turno',
  sucursal: turno.sucursal,
  documento: turno.documento,
  servicio: turno.especialidad,
  ...extra,
});

// ---------- Tótem y registro de llegada ----------

/** Decide qué pasa con un turno puntual: muy temprano (#75), tolerancia vencida (RF-07) o en horario. */
function resultadoDeTurno(turno: Turno, ahora: Date): ResultadoBusqueda {
  const existente = leerAdmisiones()[turno.id];
  if (existente?.estado === 'cancelado-tolerancia') return { tipo: 'tolerancia-vencida', turno, admision: existente };
  if (existente) return { tipo: 'ya-registrado', admision: existente };
  const llegada = evaluarLlegada(turno.horario, ahora);
  if (llegada.estado === 'muy-temprano') return { tipo: 'muy-temprano', turno, desde: llegada.desde };
  if (llegada.estado === 'vencida') {
    // RF-07: el turno queda cancelado y la secretaría lo ve para ofrecer un contraturno.
    const cancelada = nuevaAdmision(turno, 'cancelado-tolerancia', { canceladoEn: ahora.toISOString() });
    guardarAdmision(cancelada);
    return { tipo: 'tolerancia-vencida', turno, admision: cancelada };
  }
  return { tipo: 'encontrado', turno };
}

/**
 * Busca el turno del día. Si se indica el servicio elegido en el tótem (#43), también
 * controla que el turno sea de ese servicio antes de aplicar la tolerancia.
 * #54: si el número coincide con más de una persona pide el año de nacimiento; si la
 * persona tiene varios turnos pendientes, devuelve la lista para que elija.
 * #56: si el turno es de otra sucursal, lo informa y no registra nada.
 */
export async function buscarTurno(identificador: string, ahora = new Date(), servicio?: string, anioNacimiento?: string): Promise<ResultadoBusqueda> {
  verificarConexion();
  await esperar(600);
  let coincidencias = turnosDelDia().filter((t) => t.documento === identificador || t.afiliado === identificador);
  if (coincidencias.length === 0) return { tipo: 'no-encontrado' };

  const personas = [...new Map(coincidencias.map((t) => [t.documento, { paciente: t.paciente, documento: t.documento }])).values()];
  if (personas.length > 1) {
    if (!anioNacimiento) return { tipo: 'varias-personas', personas };
    coincidencias = coincidencias.filter((t) => t.anioNacimiento === anioNacimiento);
    if (coincidencias.length === 0) return { tipo: 'no-encontrado' };
  }

  const sucursal = sucursalActiva();
  const aca = coincidencias.filter((t) => t.sucursal === sucursal);
  if (aca.length === 0) return { tipo: 'otra-sucursal', turno: coincidencias[0], sucursal: nombreSucursal(coincidencias[0].sucursal) };
  if (diaCerrado()) return { tipo: 'dia-cerrado' };

  const registradas = leerAdmisiones();
  const delServicio = servicio ? aca.filter((t) => t.especialidad === servicio) : aca;
  if (servicio && delServicio.length === 0) {
    const existente = aca.map((t) => registradas[t.id]).find(Boolean);
    if (existente) return resultadoDeTurno(aca.find((t) => t.id === existente.turnoId)!, ahora);
    return { tipo: 'otro-servicio', turno: aca[0] };
  }

  const pendientes = delServicio.filter((t) => !registradas[t.id]);
  const registrados = delServicio.map((t) => registradas[t.id]).filter(Boolean);
  // Varios turnos pendientes, o uno pendiente y otro ya registrado: se pregunta a cuál llegó.
  if (pendientes.length > 1 || (pendientes.length === 1 && registrados.length > 0)) return { tipo: 'varios-turnos', turnos: pendientes, registrados };
  if (pendientes.length === 1) return resultadoDeTurno(pendientes[0], ahora);
  // Todos los turnos ya están registrados: informa el más reciente que siga activo.
  const elegido = delServicio.find((t) => activa(registradas[t.id])) ?? delServicio[0];
  return resultadoDeTurno(elegido, ahora);
}

/** #54: el paciente eligió uno de sus turnos del día. */
export async function elegirTurno(turno: Turno, ahora = new Date()): Promise<ResultadoBusqueda> {
  verificarConexion();
  await esperar(300);
  if (diaCerrado()) return { tipo: 'dia-cerrado' };
  return resultadoDeTurno(turno, ahora);
}

export async function registrarLlegada(turno: Turno): Promise<Admision> {
  verificarConexion();
  await esperar(1200);
  verificarDiaAbierto();
  if (fallasPendientes.delete(turno.id)) throw new RegistroError();

  const existente = leerAdmisiones()[turno.id];
  if (existente) return existente; // registrar dos veces no duplica la admisión

  const admision = nuevaAdmision(turno, 'en-espera');
  guardarAdmision(admision);
  return admision;
}

// ---------- Tótem: demanda espontánea (DEV-33) ----------

const activa = (a: Admision | undefined) => !!a && (a.estado === 'en-espera' || a.estado === 'llamado');

/** Admisión vigente de un documento: su turno ya registrado o una demanda espontánea en curso. */
function admisionActivaDe(documento: string): Admision | undefined {
  const registradas = leerAdmisiones();
  const delTurno = turnosDelDia()
    .filter((t) => t.documento === documento)
    .map((t) => registradas[t.id])
    .find(activa);
  if (delTurno) return delTurno;
  return Object.values(registradas).find((a) => a.tipo === 'demanda' && a.documento === documento && activa(a));
}

/** Identifica con DNI a quien dice no tener turno. No registra nada todavía. */
export async function identificarSinTurno(documento: string, ahora = new Date()): Promise<ResultadoSinTurno> {
  verificarConexion();
  await esperar(600);
  if (diaCerrado()) return { tipo: 'dia-cerrado' };
  const yaRegistrada = admisionActivaDe(documento);
  if (yaRegistrada) return { tipo: 'ya-registrado', admision: yaRegistrada };

  const sucursal = sucursalActiva();
  const turno = turnosDelDia().find((t) => t.documento === documento && t.sucursal === sucursal);
  if (turno) {
    const existente = leerAdmisiones()[turno.id];
    const vencido = existente?.estado === 'cancelado-tolerancia' || evaluarTolerancia(turno.horario, ahora) === 'vencida';
    if (vencido) return { tipo: 'turno-vencido' };
    if (!existente) return { tipo: 'tiene-turno', turno };
  }

  const afiliado = padron().find((p) => p.documento === documento);
  return afiliado ? { tipo: 'identificado', paciente: afiliado.paciente } : { tipo: 'no-encontrado' };
}

/**
 * Registra como demanda espontánea a quien llega sin turno, en la cola del servicio elegido.
 * Queda sin profesional hasta que la secretaría lo asigna. No duplica admisiones del mismo DNI.
 */
export async function registrarDemandaTotem(documento: string, paciente: string, servicio: string): Promise<Admision> {
  verificarConexion();
  await esperar(1000);
  verificarDiaAbierto();
  const existente = admisionActivaDe(documento);
  if (existente) return existente;
  const ahora = new Date().toISOString();
  const admision: Admision = {
    numero: siguienteNumero(),
    turnoId: `d-${documento}-${Date.now()}`,
    paciente,
    profesional: '',
    consultorio: '',
    horaTurno: ahora,
    registradaEn: ahora,
    estado: 'en-espera',
    tipo: 'demanda',
    servicio,
    documento,
    sucursal: sucursalActiva(),
  };
  guardarAdmision(admision);
  return admision;
}

// ---------- Secretaría ----------

/** Turnos del proveedor sin llegada y con la tolerancia vencida: se muestran como ausentes. */
function ausentes(registrados: Record<string, Admision>, ahora: Date): Admision[] {
  const sucursal = sucursalActiva();
  return turnosDelDia()
    .filter((t) => t.sucursal === sucursal && !registrados[t.id] && evaluarTolerancia(t.horario, ahora) === 'vencida')
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
      sucursal,
      documento: t.documento,
    }));
}

/** Admisiones vigentes de la sucursal (las anuladas ya quedan fuera al leer). */
const admisionesVigentes = leerAdmisiones;

export async function obtenerColaCentro(ahora = new Date()): Promise<ColaCentro> {
  verificarConexion();
  await esperar(700);
  verificarServicio();
  refrescarProfesionales();
  const registradas = admisionesVigentes();
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
  verificarDiaAbierto();
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
    sucursal: sucursalActiva(),
    documento: cancelada.documento,
    servicio: p.especialidad,
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
  verificarDiaAbierto();
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
    servicio: p.especialidad,
    sucursal: sucursalActiva(),
    derivaciones: [{ desde: '', hacia: p.nombre, motivo: 'Demanda espontánea', fecha: ahora, usuario: quienSoy() }],
  };
  guardarAdmision(admision);
  return admision;
}

/**
 * #58: deriva a un paciente en espera a otro profesional. Conserva su número y su hora de llegada
 * (el tiempo que ya esperó). La demanda espontánea usa el mismo mecanismo para asignar profesional.
 */
export async function derivarPaciente(admision: Admision, profesional: string, motivo: string): Promise<Admision> {
  verificarConexion();
  await esperar(600);
  verificarServicio();
  const actual = leerAdmisiones()[admision.turnoId] ?? admision;
  if (actual.estado !== 'en-espera') throw new OperacionNoPermitidaError('Solo se puede derivar a un paciente que está en espera.');
  const p = profesionalPorNombre(profesional);
  if (p.nombre === actual.profesional) return actual;
  const fecha = new Date().toISOString();
  const usuario = quienSoy();
  const derivada: Admision = {
    ...actual,
    profesional: p.nombre,
    consultorio: p.consultorio,
    servicio: actual.servicio || p.especialidad,
    derivaciones: [...(actual.derivaciones ?? []), { desde: actual.profesional, hacia: p.nombre, motivo, fecha, usuario }],
  };
  guardarAdmision(derivada);
  registrarAuditoria({
    accion: 'derivacion',
    usuario,
    fecha,
    sucursal: sucursalDe(actual),
    numero: actual.numero,
    detalle: `${actual.profesional || 'Sin asignar'} → ${p.nombre} · ${motivo}`,
  });
  return derivada;
}

/** DEV-33: la secretaría asigna profesional a una demanda espontánea del tótem. Conserva número y llegada. */
export async function asignarProfesional(admision: Admision, profesional: string): Promise<Admision> {
  const actual = leerAdmisiones()[admision.turnoId] ?? admision;
  if (actual.estado !== 'en-espera') return actual;
  return derivarPaciente(actual, profesional, 'Asignación de demanda espontánea');
}

/** #64: el paciente se fue sin ser atendido. Sale de la cola y de la espera estimada. */
export async function marcarSeRetiro(admision: Admision, motivo: string): Promise<Admision> {
  verificarConexion();
  await esperar(500);
  verificarServicio();
  const actual = leerAdmisiones()[admision.turnoId] ?? admision;
  if (actual.estado !== 'en-espera') throw new OperacionNoPermitidaError('Solo se puede marcar a un paciente que está en espera.');
  const retirada: Admision = { ...actual, estado: 'se-retiro', retiradoEn: new Date().toISOString(), motivoRetiro: motivo || undefined };
  guardarAdmision(retirada);
  registrarAuditoria({ accion: 'se-retiro', usuario: quienSoy(), sucursal: sucursalDe(actual), numero: actual.numero, detalle: motivo || 'Sin motivo informado' });
  return retirada;
}

/** #64: el paciente volvió. Recupera su lugar con su número y su hora de llegada original. */
export async function reincorporarPaciente(admision: Admision): Promise<Admision> {
  verificarConexion();
  await esperar(500);
  verificarServicio();
  verificarDiaAbierto();
  const actual = leerAdmisiones()[admision.turnoId] ?? admision;
  if (actual.estado !== 'se-retiro') throw new OperacionNoPermitidaError('Solo se puede reincorporar a un paciente que se retiró.');
  const vuelta: Admision = { ...actual, estado: 'en-espera', retiradoEn: undefined, motivoRetiro: undefined };
  guardarAdmision(vuelta);
  registrarAuditoria({ accion: 'reincorporado', usuario: quienSoy(), sucursal: sucursalDe(actual), numero: actual.numero });
  return vuelta;
}

/**
 * #65: anula una llegada registrada por error. El turno vuelve a quedar disponible para
 * registrar; no se puede anular a alguien que ya fue llamado o atendido.
 */
export async function anularLlegada(admision: Admision, motivo: string): Promise<void> {
  verificarConexion();
  await esperar(500);
  verificarServicio();
  const actual = leerAdmisiones()[admision.turnoId] ?? admision;
  if (actual.estado !== 'en-espera') throw new OperacionNoPermitidaError('No se puede anular: el paciente ya fue llamado o atendido.');
  if (!motivo.trim()) throw new OperacionNoPermitidaError('Indique el motivo de la anulación.');
  if (actual.tipo === 'contraturno' && actual.contraturnoDe) {
    const origen = leerAdmisiones()[actual.contraturnoDe];
    if (origen) guardarAdmision({ ...origen, contraturnoAsignado: undefined });
  }
  eliminarAdmision(actual.turnoId);
  registrarAuditoria({ accion: 'llegada-anulada', usuario: quienSoy(), sucursal: sucursalDe(actual), numero: actual.numero, detalle: motivo.trim() });
}

/** RF-06: demora del profesional según el paciente que más espera desde su horario. */
export function calcularDemoras(registros: Admision[], ahora: Date): { profesional: string; consultorio: string; minutos: number }[] {
  const porProfesional = new Map<string, Admision>();
  for (const a of registros) {
    if (a.estado !== 'en-espera' || sinProfesional(a)) continue;
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

// ---------- Profesional ausente o demorado (#63) ----------

export type EstadoProfesional = { estado: 'ausente' | 'demorado'; minutos?: number; desde: string; usuario: string };

const claveEstado = (sucursal: string, profesional: string) => `${hoy()}|${sucursal}|${profesional}`;

/** Avisos cargados hoy en la sucursal activa, por nombre de profesional. */
export function estadosProfesionales(): Record<string, EstadoProfesional> {
  const sucursal = sucursalActiva();
  const prefijo = `${hoy()}|${sucursal}|`;
  const todos = leerJSON<Record<string, EstadoProfesional>>(CLAVE_ESTADOS, {});
  return Object.fromEntries(Object.entries(todos).filter(([k]) => k.startsWith(prefijo)).map(([k, v]) => [k.slice(prefijo.length), v]));
}

/** Marca al profesional como ausente o demorado; con `null` quita el aviso. */
export async function marcarEstadoProfesional(profesional: string, estado: EstadoProfesional['estado'] | null, minutos?: number): Promise<void> {
  verificarConexion();
  await esperar(400);
  verificarServicio();
  const sucursal = sucursalActiva();
  const todos = leerJSON<Record<string, EstadoProfesional>>(CLAVE_ESTADOS, {});
  const k = claveEstado(sucursal, profesional);
  if (estado) todos[k] = { estado, minutos: estado === 'demorado' ? minutos : undefined, desde: new Date().toISOString(), usuario: quienSoy() };
  else delete todos[k];
  escribirJSON(CLAVE_ESTADOS, todos);
  registrarAuditoria({
    accion: 'estado-profesional',
    usuario: quienSoy(),
    sucursal,
    detalle: `${profesional}: ${estado === 'ausente' ? 'ausente' : estado === 'demorado' ? `demorado ${minutos ?? '?'} min` : 'sin aviso'}`,
  });
}

/** #63: deriva en un paso a todos los pacientes en espera de un profesional a otro. */
export async function derivarTodos(desde: string, hacia: string, motivo: string): Promise<number> {
  verificarConexion();
  await esperar(700);
  verificarServicio();
  const p = profesionalPorNombre(hacia);
  const fecha = new Date().toISOString();
  const usuario = quienSoy();
  const pendientes = Object.values(admisionesVigentes()).filter((a) => a.profesional === desde && a.estado === 'en-espera');
  for (const a of pendientes) {
    guardarAdmision({
      ...a,
      profesional: p.nombre,
      consultorio: p.consultorio,
      derivaciones: [...(a.derivaciones ?? []), { desde, hacia: p.nombre, motivo, fecha, usuario }],
    });
  }
  registrarAuditoria({ accion: 'derivacion-masiva', usuario, fecha, sucursal: sucursalActiva(), detalle: `${pendientes.length === 1 ? '1 paciente' : `${pendientes.length} pacientes`} · ${desde} → ${p.nombre} · ${motivo}` });
  return pendientes.length;
}

// ---------- Pantalla de sala de espera ----------

export type Llamado = { numero: string; consultorio: string; llamadoEn: string; llamados: number };

export type DatosSala = {
  actual: Llamado | null;
  anteriores: Llamado[]; // hasta 4, del más reciente al más antiguo
  esperas: { especialidad: string; minutos: number }[];
  demoras: { especialidad: string; minutos: number }[];
  avisos: { consultorio: string; texto: string }[]; // #63: profesional ausente o demorado
  actualizadoEn: Date;
};

/** La sala muestra solo número y consultorio: nunca nombres ni datos de salud. */
export async function obtenerSala(ahora = new Date()): Promise<DatosSala> {
  verificarConexion();
  await esperar(600);
  verificarServicio();
  refrescarProfesionales();
  const todas = Object.values(admisionesVigentes());
  const llamados: Llamado[] = todas
    .filter((a) => a.llamadoEn)
    .sort((a, b) => b.llamadoEn!.localeCompare(a.llamadoEn!))
    .map((a) => ({ numero: a.numero, consultorio: a.consultorio, llamadoEn: a.llamadoEn!, llamados: a.llamados ?? 1 }));
  const repetidas = (esp: string) => PROFESIONALES.filter((p) => p.especialidad === esp).length > 1;
  const etiqueta = (p: Profesional) => (repetidas(p.especialidad) ? `${p.especialidad} · consultorio ${p.consultorio}` : p.especialidad);
  const estados = estadosProfesionales();
  const esperas = PROFESIONALES.filter((p) => estados[p.nombre]?.estado !== 'ausente').map((p) => ({
    especialidad: etiqueta(p),
    minutos:
      estimarEspera(
        todas.filter((a) => a.profesional === p.nombre && a.estado === 'en-espera').length,
        todas.some((a) => a.profesional === p.nombre && a.estado === 'llamado'),
      ) + (estados[p.nombre]?.estado === 'demorado' ? estados[p.nombre].minutos ?? 0 : 0),
  }));
  const demoras = calcularDemoras(todas, ahora)
    .filter((d) => !estados[d.profesional])
    .map((d) => ({ especialidad: etiqueta(profesionalPorNombre(d.profesional)), minutos: d.minutos }));
  const avisos = PROFESIONALES.filter((p) => estados[p.nombre]).map((p) => {
    const e = estados[p.nombre];
    return {
      consultorio: p.consultorio,
      texto:
        e.estado === 'ausente'
          ? `Consultorio ${p.consultorio} (${p.especialidad}): hoy no atiende. Los pacientes serán reasignados; consulte en secretaría.`
          : `Consultorio ${p.consultorio} (${p.especialidad}): demora estimada de ${e.minutos ?? 0} minutos.`,
    };
  });
  return { actual: llamados[0] ?? null, anteriores: llamados.slice(1, 5), esperas, demoras, avisos, actualizadoEn: new Date() };
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
  const delConsultorio = Object.values(admisionesVigentes()).filter((a) => a.consultorio === consultorio);
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
  const llamado: Admision = { ...siguiente, estado: 'llamado', llamadoEn: new Date().toISOString(), llamados: 1 };
  guardarAdmision(llamado);
  return llamado;
}

/**
 * #42: llama al paciente elegido en la tabla. Si no es el primero de la cola, el llamado
 * fuera de orden queda registrado en la auditoría (quién, cuándo y a qué paciente).
 */
export async function llamarPaciente(consultorio: string, turnoId: string, usuario: string): Promise<Admision> {
  verificarConexion();
  await esperar(500);
  const cola = await obtenerCola(consultorio);
  if (cola.enAtencion) throw new PacienteEnAtencionError(cola.enAtencion);
  const elegido = cola.enEspera.find((a) => a.turnoId === turnoId);
  if (!elegido) throw new PacienteNoDisponibleError();
  const saltados = pacientesSaltados(cola.enEspera, turnoId);
  const ahora = new Date().toISOString();
  const llamado: Admision = { ...elegido, estado: 'llamado', llamadoEn: ahora, llamados: 1 };
  guardarAdmision(llamado);
  if (saltados.length > 0) {
    registrarAuditoria({
      accion: 'llamado-fuera-de-orden',
      usuario,
      fecha: ahora,
      sucursal: sucursalDe(llamado),
      consultorio,
      numero: llamado.numero,
      turnoId: llamado.turnoId,
      saltados: saltados.map((a) => a.numero),
    });
  }
  return llamado;
}

/** #41: repite el llamado del paciente en atención. No cambia el orden ni crea otra admisión. */
export async function volverALlamar(admision: Admision): Promise<Admision> {
  verificarConexion();
  await esperar(400);
  verificarServicio();
  const actual = leerAdmisiones()[admision.turnoId] ?? admision;
  if (actual.estado !== 'llamado') return actual;
  const llamado: Admision = { ...actual, llamadoEn: new Date().toISOString(), llamados: (actual.llamados ?? 1) + 1 };
  guardarAdmision(llamado);
  return llamado;
}

/** Cantidad de llamados después de la cual el profesional puede marcar al paciente como ausente (#77). */
export let LLAMADOS_ANTES_DE_AUSENTE = parametros().llamadosAntesDeAusente;
escucharConfiguracion(() => {
  LLAMADOS_ANTES_DE_AUSENTE = parametros().llamadosAntesDeAusente;
});

/** #41: el paciente no se presentó después de los llamados. */
export async function marcarAusente(admision: Admision): Promise<void> {
  verificarConexion();
  await esperar(400);
  verificarServicio();
  const actual = leerAdmisiones()[admision.turnoId] ?? admision;
  guardarAdmision({ ...actual, estado: 'ausente', ausenteEn: new Date().toISOString() });
}

/** #46: pacientes adelante y espera estimada de una admisión en espera. */
export function esperaDe(admision: Admision): { pacientesAntes: number; minutos: number } {
  const delConsultorio = Object.values(admisionesVigentes()).filter((a) => a.consultorio === admision.consultorio);
  const cola = delConsultorio.filter((a) => a.estado === 'en-espera').sort(ordenarCola);
  const posicion = cola.findIndex((a) => a.turnoId === admision.turnoId);
  const pacientesAntes = posicion === -1 ? cola.length : posicion;
  return { pacientesAntes, minutos: estimarEspera(pacientesAntes, delConsultorio.some((a) => a.estado === 'llamado')) };
}

export async function finalizarAtencion(admision: Admision): Promise<void> {
  verificarConexion();
  await esperar(400);
  guardarAdmision({ ...admision, estado: 'finalizado', finalizadoEn: new Date().toISOString() });
}

// ---------- Cierre del día (#69) ----------

export type Cierre = { fecha: string; sucursal: string; cerradoEn: string; usuario: string; resumen: ResumenDia };

const claveCierre = (sucursal: string, fecha = hoy()) => `${fecha}|${sucursal}`;

export function cierres(): Record<string, Cierre> {
  return leerJSON<Record<string, Cierre>>(CLAVE_CIERRES, {});
}

export function cierreDeHoy(sucursal = sucursalActiva()): Cierre | null {
  return cierres()[claveCierre(sucursal)] ?? null;
}

export function diaCerrado(sucursal = sucursalActiva()): boolean {
  return cierreDeHoy(sucursal) !== null;
}

/** Pacientes que siguen en la cola: hay que darles un estado final antes de cerrar. */
export function pendientesDelDia(): Admision[] {
  return Object.values(admisionesVigentes())
    .filter((a) => a.estado === 'en-espera' || a.estado === 'llamado')
    .sort(ordenarCola);
}

/** Todas las admisiones del día de una sucursal (o de todas), para resúmenes y reportes. */
export function admisionesDelDia(sucursal?: string): Admision[] {
  return Object.values(leerTodas()).filter((a) => !sucursal || sucursalDe(a) === sucursal);
}

/** Resumen del día de la sucursal activa, con los ausentes del proveedor incluidos. */
export function resumenDeHoy(ahora = new Date()): ResumenDia {
  const vigentes = admisionesVigentes();
  return resumirDia([...Object.values(vigentes), ...ausentes(vigentes, ahora)], especialidadDe);
}

export async function cerrarDia(decisiones: Record<string, 'no-atendido' | 'reprogramado'>): Promise<Cierre> {
  verificarConexion();
  await esperar(800);
  verificarServicio();
  const sucursal = sucursalActiva();
  if (diaCerrado(sucursal)) return cierreDeHoy(sucursal)!;
  for (const a of pendientesDelDia()) guardarAdmision({ ...a, estado: decisiones[a.turnoId] ?? 'no-atendido' });
  const cierre: Cierre = { fecha: hoy(), sucursal, cerradoEn: new Date().toISOString(), usuario: quienSoy(), resumen: resumenDeHoy() };
  escribirJSON(CLAVE_CIERRES, { ...cierres(), [claveCierre(sucursal)]: cierre });
  registrarAuditoria({ accion: 'cierre-dia', usuario: cierre.usuario, sucursal, detalle: `${cierre.resumen.total.atendidos} atendidos · ${cierre.resumen.total.noAtendidos} no atendidos` });
  return cierre;
}

/** Solo dirección: vuelve a abrir el día (por ejemplo, si se cerró por error). */
export async function reabrirDia(): Promise<void> {
  verificarConexion();
  await esperar(400);
  const sucursal = sucursalActiva();
  const todos = cierres();
  delete todos[claveCierre(sucursal)];
  escribirJSON(CLAVE_CIERRES, todos);
  registrarAuditoria({ accion: 'reapertura-dia', usuario: quienSoy(), sucursal });
}

/** Avisa cuando otra pestaña cambia la cola, los avisos de profesionales o el cierre. */
export function escucharCambios(alCambiar: () => void): () => void {
  return escucharClaves([CLAVE, CLAVE_ESTADOS, CLAVE_CIERRES, CLAVE_ANULADAS], alCambiar);
}
