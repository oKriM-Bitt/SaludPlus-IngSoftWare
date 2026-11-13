/**
 * Usuarios, credenciales y permisos (#47, #48, #59, #79).
 * Los usuarios se administran en la configuración (#60). Cuando exista la autenticación
 * del backend (#17), la validación pasa al servidor; los tipos se mantienen.
 */
import { INTENTOS_ANTES_DE_BLOQUEO, MINUTOS_DE_BLOQUEO, minutosDeBloqueo, resumenClave } from './claves';
import { actualizarConfiguracion, configuracion, type Rol, type UsuarioRegistrado } from './configuracion';
import { registrarAuditoria } from './auditoria';

export type { Rol };

/** Usuario con sesión abierta, ya ubicado en una sucursal. */
export type Usuario = {
  usuario: string;
  nombre: string;
  rol: Rol;
  sucursal: string; // id de la sucursal en la que trabaja ahora
  centro: string; // nombre de esa sucursal
  sucursales: string[]; // sucursales en las que puede trabajar
  consultorio?: string; // solo profesionales: consultorio asignado hoy en la sucursal
  profesional?: string; // solo profesionales: nombre como profesional
  profesionalId?: string; // solo profesionales: id en la configuración (DEV-60)
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  secretaria: 'Admisión',
  profesional: 'Profesional',
  direccion: 'Dirección',
};

/** Contraseña común de la demo. Nunca se usan datos reales. */
export const CLAVE_DEMO = 'saludplus';

/** Usuarios activos de la configuración, para el ingreso rápido de la demo. */
export function usuariosDemo(): UsuarioRegistrado[] {
  return configuracion().usuarios.filter((u) => u.activo);
}

export type ResultadoCredenciales =
  | { tipo: 'ok'; registrado: UsuarioRegistrado }
  | { tipo: 'incorrecto' }
  | { tipo: 'inactivo' }
  | { tipo: 'bloqueado'; minutos: number };

/**
 * Valida usuario y contraseña. Cuenta los intentos fallidos y bloquea al usuario
 * después de 5 intentos durante 15 minutos (#79).
 */
export async function verificarCredenciales(usuario: string, clave: string, ahora = new Date()): Promise<ResultadoCredenciales> {
  const nombre = usuario.trim().toLowerCase();
  const registrado = configuracion().usuarios.find((u) => u.usuario === nombre);
  if (!registrado) return { tipo: 'incorrecto' };
  if (!registrado.activo) return { tipo: 'inactivo' };
  const bloqueo = minutosDeBloqueo(registrado.bloqueadoHasta, ahora);
  if (bloqueo > 0) return { tipo: 'bloqueado', minutos: bloqueo };

  const correcta = (await resumenClave(nombre, clave)) === registrado.claveHash;
  if (correcta) {
    if (registrado.intentosFallidos || registrado.bloqueadoHasta) modificarUsuario(nombre, (u) => ({ ...u, intentosFallidos: 0, bloqueadoHasta: undefined }));
    return { tipo: 'ok', registrado: configuracion().usuarios.find((u) => u.usuario === nombre)! };
  }

  const intentos = (registrado.intentosFallidos ?? 0) + 1;
  const bloquear = intentos >= INTENTOS_ANTES_DE_BLOQUEO;
  modificarUsuario(nombre, (u) => ({
    ...u,
    intentosFallidos: bloquear ? 0 : intentos,
    bloqueadoHasta: bloquear ? new Date(ahora.getTime() + MINUTOS_DE_BLOQUEO * 60_000).toISOString() : u.bloqueadoHasta,
  }));
  registrarAuditoria({ accion: bloquear ? 'usuario-bloqueado' : 'inicio-sesion-fallido', usuario: nombre, detalle: `Intento ${intentos} de ${INTENTOS_ANTES_DE_BLOQUEO}` });
  return bloquear ? { tipo: 'bloqueado', minutos: MINUTOS_DE_BLOQUEO } : { tipo: 'incorrecto' };
}

export function modificarUsuario(usuario: string, cambio: (u: UsuarioRegistrado) => UsuarioRegistrado) {
  actualizarConfiguracion((c) => ({ ...c, usuarios: c.usuarios.map((u) => (u.usuario === usuario ? cambio(u) : u)) }));
}

export type Destino = {
  ruta: string;
  titulo: string;
  descripcion: string;
  icono: 'users' | 'user-check' | 'monitor' | 'hand' | 'grid' | 'chart' | 'settings' | 'calendar-check' | 'inbox';
  nuevaPestana?: boolean;
};

/**
 * Opciones del menú según lo que necesita cada rol para su trabajo (#48, #59):
 * - Secretaría: la cola de admisión, el cierre del día y poner en marcha el tótem, la sala y la pantalla de boxes de su sucursal.
 * - Profesional: solo su consultorio. La sala es un equipo de la sucursal, no una herramienta del médico.
 * - Dirección: todo, más reportes y administración.
 */
export function destinosPorRol(u: Usuario, profesionales: { nombre: string; consultorio: string }[] = []): Destino[] {
  const equipo = (ruta: string) => `${ruta}?sucursal=${u.sucursal}`;
  const sala: Destino = { ruta: equipo('/sala'), titulo: 'Pantalla de sala', descripcion: 'Abrir en la TV de la sala de espera de esta sucursal.', icono: 'monitor', nuevaPestana: true };
  const totem: Destino = { ruta: equipo('/totem'), titulo: 'Tótem de autogestión', descripcion: 'Abrir en el tótem de esta sucursal.', icono: 'hand', nuevaPestana: true };
  const admision: Destino = { ruta: '/secretaria', titulo: 'Admisión y sala de espera', descripcion: 'Cola del centro, llegadas, derivaciones y avisos de profesionales.', icono: 'users' };
  const cierre: Destino = { ruta: '/secretaria/cierre', titulo: 'Cierre del día', descripcion: 'Pacientes pendientes y resumen de la jornada.', icono: 'calendar-check' };
  const boxes: Destino = { ruta: equipo('/boxes'), titulo: 'Pantalla de boxes', descripcion: 'Abrir en la TV de admisión: anuncia a qué box pasa cada paciente.', icono: 'inbox', nuevaPestana: true };
  const consultorio = (c: string, nombre: string): Destino => ({
    ruta: `/profesional?consultorio=${c}`,
    titulo: `Consultorio ${c}`,
    descripcion: `${nombre}: pacientes en espera y llamados.`,
    icono: 'user-check',
  });

  if (u.rol === 'secretaria') return [admision, cierre, totem, sala, boxes];
  if (u.rol === 'profesional')
    return [{ ...consultorio(u.consultorio ?? '—', ''), titulo: 'Mi consultorio', descripcion: `Consultorio ${u.consultorio ?? '—'} · ${u.centro}. Vea sus pacientes en espera y llámelos.` }];
  return [
    admision,
    ...profesionales.map((p) => consultorio(p.consultorio, p.nombre)),
    cierre,
    { ruta: '/reportes', titulo: 'Reportes', descripcion: 'Indicadores por sucursal, especialidad y período. Exportar a Excel.', icono: 'chart' },
    { ruta: '/administracion', titulo: 'Administración', descripcion: 'Usuarios, sucursales, consultorios, profesionales y parámetros.', icono: 'settings' },
    totem,
    sala,
    boxes,
    { ruta: '/componentes', titulo: 'Lámina de componentes', descripcion: 'Sistema visual de SaludPlus.', icono: 'grid' },
  ];
}

/** Rutas internas que puede abrir cada rol. */
export function puedeAcceder(u: Pick<Usuario, 'rol'>, ruta: string): boolean {
  if (ruta === '/inicio' || ruta === '/cuenta') return true;
  if (u.rol === 'direccion') return true;
  if (u.rol === 'secretaria') return ruta === '/secretaria' || ruta === '/secretaria/cierre';
  return ruta === '/profesional';
}
