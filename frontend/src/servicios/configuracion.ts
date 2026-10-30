/**
 * Configuración del sistema que administra dirección (#60) y parámetros (#77).
 * Datos FICTICIOS guardados en el navegador; con el backend pasan a la base de datos.
 * Nada se borra: lo que ya no se usa se da de baja (activo = false).
 */
import { borrar, escribirJSON, escucharClaves, leerJSON, parametroURL } from './almacen';

export type Rol = 'secretaria' | 'profesional' | 'direccion';

export type Sucursal = { id: string; nombre: string; direccion: string; prefijo: string; activa: boolean };
export type Consultorio = { id: string; sucursal: string; numero: string; activo: boolean };
export type Box = { id: string; sucursal: string; numero: string; activo: boolean };
export type ProfesionalRegistrado = { id: string; nombre: string; especialidad: string; activo: boolean };

/** Qué profesional atiende en qué consultorio, qué días (0 = domingo) y en qué franja. */
export type Asignacion = { id: string; profesional: string; consultorio: string; dias: number[]; desde: string; hasta: string };

export type UsuarioRegistrado = {
  usuario: string;
  nombre: string;
  rol: Rol;
  sucursales: string[];
  profesional?: string; // id del profesional, solo para el rol profesional
  activo: boolean;
  claveHash: string;
  debeCambiarClave?: boolean;
  intentosFallidos?: number;
  bloqueadoHasta?: string; // ISO
};

export type Parametros = {
  toleranciaMinutos: number;
  minutosPorConsulta: number;
  esperaLargaMinutos: number;
  inactividadMinutos: number;
  anticipacionMaximaMinutos: number; // #75
  llamadosAntesDeAusente: number;
  motivosPrioridad: string[];
};

export type Configuracion = {
  version: number;
  sucursales: Sucursal[];
  consultorios: Consultorio[];
  boxes: Box[];
  profesionales: ProfesionalRegistrado[];
  asignaciones: Asignacion[];
  usuarios: UsuarioRegistrado[];
  parametros: Parametros;
};

export const PARAMETROS_POR_DEFECTO: Parametros = {
  toleranciaMinutos: 15,
  minutosPorConsulta: 10,
  esperaLargaMinutos: 30,
  inactividadMinutos: 15,
  anticipacionMaximaMinutos: 60,
  llamadosAntesDeAusente: 2,
  motivosPrioridad: ['Embarazo', 'Persona mayor de 70 años', 'Persona con discapacidad', 'Niña o niño menor de 2 años'],
};

/** Límites de cada parámetro numérico: [mínimo, máximo, etiqueta, unidad]. */
export const LIMITES: Record<Exclude<keyof Parametros, 'motivosPrioridad'>, [number, number, string, string]> = {
  toleranciaMinutos: [0, 60, 'Tolerancia de llegada', 'minutos'],
  minutosPorConsulta: [5, 60, 'Duración estimada de una consulta', 'minutos'],
  esperaLargaMinutos: [10, 180, 'Espera larga a partir de', 'minutos'],
  inactividadMinutos: [5, 120, 'Cierre de sesión por inactividad', 'minutos'],
  anticipacionMaximaMinutos: [10, 240, 'Llegada aceptada desde antes del turno', 'minutos'],
  llamadosAntesDeAusente: [1, 5, 'Llamados antes de poder marcar ausente', 'llamados'],
};

/** Devuelve los errores por campo; vacío si los parámetros son válidos. */
export function validarParametros(p: Parametros): Partial<Record<keyof Parametros, string>> {
  const errores: Partial<Record<keyof Parametros, string>> = {};
  for (const [clave, [min, max, , unidad]] of Object.entries(LIMITES) as [keyof typeof LIMITES, [number, number, string, string]][]) {
    const v = p[clave];
    if (!Number.isInteger(v)) errores[clave] = 'Ingrese un número entero.';
    else if (v < min || v > max) errores[clave] = `Debe estar entre ${min} y ${max} ${unidad}.`;
  }
  const motivos = p.motivosPrioridad.map((m) => m.trim()).filter(Boolean);
  if (motivos.length === 0) errores.motivosPrioridad = 'Cargue al menos un motivo de prioridad.';
  else if (new Set(motivos.map((m) => m.toLowerCase())).size !== motivos.length) errores.motivosPrioridad = 'Hay motivos repetidos.';
  return errores;
}

const TODOS_LOS_DIAS = [0, 1, 2, 3, 4, 5, 6];

/** Configuración inicial de la demo. Contraseña de todos los usuarios: "saludplus". */
export function configuracionInicial(): Configuracion {
  const u = (usuario: string, nombre: string, rol: Rol, sucursales: string[], claveHash: string, profesional?: string): UsuarioRegistrado => ({
    usuario,
    nombre,
    rol,
    sucursales,
    claveHash,
    activo: true,
    ...(profesional ? { profesional } : {}),
  });
  const asig = (profesional: string, consultorio: string): Asignacion => ({
    id: `a-${profesional}`,
    profesional,
    consultorio,
    dias: TODOS_LOS_DIAS,
    desde: '07:00',
    hasta: '21:00',
  });
  return {
    version: 1,
    sucursales: [
      { id: 'villa-norte', nombre: 'Centro Villa Norte', direccion: 'Av. Ficticia 1234', prefijo: 'A', activa: true },
      { id: 'guemes', nombre: 'Centro Güemes', direccion: 'Calle Inventada 567', prefijo: 'B', activa: true },
    ],
    consultorios: [
      ...['2', '4', '6', '8'].map((n) => ({ id: `vn-${n}`, sucursal: 'villa-norte', numero: n, activo: true })),
      ...['1', '3'].map((n) => ({ id: `gu-${n}`, sucursal: 'guemes', numero: n, activo: true })),
    ],
    boxes: [
      { id: 'vn-b1', sucursal: 'villa-norte', numero: '1', activo: true },
      { id: 'vn-b2', sucursal: 'villa-norte', numero: '2', activo: true },
      { id: 'gu-b1', sucursal: 'guemes', numero: '1', activo: true },
    ],
    profesionales: [
      { id: 'p-ferrer', nombre: 'Dra. Lucía Ferrer', especialidad: 'Clínica médica', activo: true },
      { id: 'p-vidal', nombre: 'Dr. Tomás Vidal', especialidad: 'Cardiología', activo: true },
      { id: 'p-rios', nombre: 'Dra. Paula Ríos', especialidad: 'Pediatría', activo: true },
      { id: 'p-luna', nombre: 'Dr. Andrés Luna', especialidad: 'Clínica médica', activo: true },
      { id: 'p-aguirre', nombre: 'Dr. Martín Aguirre', especialidad: 'Clínica médica', activo: true },
      { id: 'p-sosa', nombre: 'Dra. Inés Sosa', especialidad: 'Pediatría', activo: true },
    ],
    asignaciones: [
      asig('p-ferrer', 'vn-4'),
      asig('p-vidal', 'vn-2'),
      asig('p-rios', 'vn-6'),
      asig('p-luna', 'vn-8'),
      asig('p-aguirre', 'gu-1'),
      asig('p-sosa', 'gu-3'),
    ],
    usuarios: [
      u('jbenitez', 'Julia Benítez', 'secretaria', ['villa-norte'], '847b7ed374af5917931faa654356dedebef5c3edd91da2dfd38e2b324c4c3161'),
      u('mcastro', 'Marcela Castro', 'secretaria', ['villa-norte', 'guemes'], 'd168f2cd157fb5b55f470f904f98af98e44f7b10b6f47d62613e906a4e7ed152'),
      u('lferrer', 'Dra. Lucía Ferrer', 'profesional', ['villa-norte'], '0c0fa120045fcd2ae6afcc3fa72fa71038d219618f81cfd11117c7ea15da0f13', 'p-ferrer'),
      u('tvidal', 'Dr. Tomás Vidal', 'profesional', ['villa-norte'], '0570f596414d112d932a7c2b007611303438e95b5432650cdc7412ad0b909ccc', 'p-vidal'),
      u('prios', 'Dra. Paula Ríos', 'profesional', ['villa-norte'], '58f284006afccc829238e4a1ea9fd7f581272d61614905948a5b1e1eab039174', 'p-rios'),
      u('aluna', 'Dr. Andrés Luna', 'profesional', ['villa-norte'], 'c4e6e850c5d46469b40ca69e8b11867c5cf76f2afae037bf3fada57fde50e6bc', 'p-luna'),
      u('maguirre', 'Dr. Martín Aguirre', 'profesional', ['guemes'], 'a084ee90c15945c5f0085aca21598d97d718142a14cb3b141c1ef5f0f7248682', 'p-aguirre'),
      u('isosa', 'Dra. Inés Sosa', 'profesional', ['guemes'], '7f2f598dcc14c9cd1e1da2dcba3fd42ce59c58b86e60753a6981689f3fe85d10', 'p-sosa'),
      u('direccion', 'Dirección médica', 'direccion', ['villa-norte', 'guemes'], '30c3cc4c805f9dccc81670c5034f38e5644c3e34171ac03f065dcf66e7a198bb'),
    ],
    parametros: { ...PARAMETROS_POR_DEFECTO, motivosPrioridad: [...PARAMETROS_POR_DEFECTO.motivosPrioridad] },
  };
}

export const CLAVE_CONFIG = 'saludplus.config';

// ?reset=1 vuelve la demo a su estado inicial, también la configuración.
if (parametroURL('reset') === '1') borrar(CLAVE_CONFIG);

let cache: Configuracion | null = null;
const oyentes = new Set<() => void>();

export function configuracion(): Configuracion {
  if (!cache) {
    const guardada = leerJSON<Configuracion | null>(CLAVE_CONFIG, null);
    const inicial = configuracionInicial();
    // Completa lo que falte si la configuración guardada es de una versión anterior.
    cache = guardada && guardada.version === inicial.version ? { ...inicial, ...guardada, parametros: { ...inicial.parametros, ...guardada.parametros } } : inicial;
  }
  return cache;
}

export function parametros(): Parametros {
  return configuracion().parametros;
}

/** Aplica un cambio y lo guarda. El cambio recibe una copia y devuelve la nueva configuración. */
export function actualizarConfiguracion(cambio: (c: Configuracion) => Configuracion) {
  const actual = structuredClone(configuracion());
  cache = cambio(actual);
  escribirJSON(CLAVE_CONFIG, cache);
  oyentes.forEach((f) => f());
}

export function restaurarConfiguracion() {
  cache = configuracionInicial();
  escribirJSON(CLAVE_CONFIG, cache);
  oyentes.forEach((f) => f());
}

export function escucharConfiguracion(alCambiar: () => void): () => void {
  oyentes.add(alCambiar);
  return () => oyentes.delete(alCambiar);
}

// Otra pestaña cambió la configuración: se vuelve a leer.
escucharClaves([CLAVE_CONFIG], () => {
  cache = null;
  oyentes.forEach((f) => f());
});

// ---------- Consultas de uso frecuente ----------

export const sucursalesActivas = () => configuracion().sucursales.filter((s) => s.activa);

export const sucursalPorId = (id: string) => configuracion().sucursales.find((s) => s.id === id);

export const nombreSucursal = (id: string) => sucursalPorId(id)?.nombre ?? id;

export const profesionalPorId = (id: string) => configuracion().profesionales.find((p) => p.id === id);

export const consultorioPorId = (id: string) => configuracion().consultorios.find((c) => c.id === id);

/** "HH:MM" de una fecha, para comparar con las franjas de las asignaciones. */
const horaMinutos = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;

/** Asignación vigente de un profesional en una sucursal para un momento dado (o la primera del día). */
export function asignacionDe(profesionalId: string, sucursal: string, cuando = new Date()) {
  const c = configuracion();
  const delDia = c.asignaciones.filter((a) => {
    const cons = consultorioPorId(a.consultorio);
    return a.profesional === profesionalId && cons?.sucursal === sucursal && cons.activo && a.dias.includes(cuando.getDay());
  });
  const hm = horaMinutos(cuando);
  return delDia.find((a) => a.desde <= hm && hm < a.hasta) ?? delDia[0];
}

export type ProfesionalDelDia = { id: string; nombre: string; especialidad: string; consultorio: string };

/** Profesionales activos que atienden hoy en la sucursal, con el número de consultorio. */
export function profesionalesDelDia(sucursal: string, cuando = new Date()): ProfesionalDelDia[] {
  const c = configuracion();
  return c.profesionales
    .filter((p) => p.activo)
    .map((p) => {
      const a = asignacionDe(p.id, sucursal, cuando);
      const cons = a ? consultorioPorId(a.consultorio) : undefined;
      return cons ? { id: p.id, nombre: p.nombre, especialidad: p.especialidad, consultorio: cons.numero } : null;
    })
    .filter((p): p is ProfesionalDelDia => p !== null)
    .sort((a, b) => Number(a.consultorio) - Number(b.consultorio) || a.nombre.localeCompare(b.nombre));
}
