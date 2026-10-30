/**
 * Registro de auditoría (RF-09): quién hizo qué, cuándo y en qué sucursal.
 * Solo agrega registros: no hay funciones para editarlos ni borrarlos.
 * Nunca guarda datos de salud; los pacientes se identifican por su número de orden.
 */
import { escribirJSON, leerJSON } from './almacen';

export type RegistroAuditoria = {
  accion: string;
  usuario: string;
  fecha: string; // ISO
  sucursal?: string;
  detalle?: string;
  [dato: string]: unknown;
};

export const CLAVE_AUDITORIA = 'saludplus.auditoria';

export function registrarAuditoria(r: { accion: string; usuario: string; fecha?: string; sucursal?: string; detalle?: string; [dato: string]: unknown }) {
  const registro: RegistroAuditoria = { ...r, accion: r.accion, usuario: r.usuario, fecha: r.fecha ?? new Date().toISOString() };
  escribirJSON(CLAVE_AUDITORIA, [...obtenerAuditoria(), registro]);
}

export function obtenerAuditoria(): RegistroAuditoria[] {
  return leerJSON<RegistroAuditoria[]>(CLAVE_AUDITORIA, []);
}

/** Texto en español para cada acción registrada. */
export const ETIQUETA_ACCION: Record<string, string> = {
  'llamado-fuera-de-orden': 'Llamado fuera de orden',
  'inicio-sesion': 'Inicio de sesión',
  'inicio-sesion-fallido': 'Intento de ingreso fallido',
  'usuario-bloqueado': 'Usuario bloqueado por intentos fallidos',
  'cambio-clave': 'Cambio de contraseña',
  'restablecer-clave': 'Contraseña restablecida',
  'desbloquear-usuario': 'Usuario desbloqueado',
  configuracion: 'Cambio de configuración',
  parametros: 'Cambio de parámetros',
  derivacion: 'Paciente derivado',
  'derivacion-masiva': 'Pacientes derivados por ausencia o demora',
  'estado-profesional': 'Estado del profesional',
  'se-retiro': 'Paciente se retiró',
  reincorporado: 'Paciente reincorporado',
  'llegada-anulada': 'Llegada anulada',
  'cierre-dia': 'Cierre del día',
  'reapertura-dia': 'Reapertura del día',
  exportacion: 'Exportación de reporte',
  'aviso-sala': 'Aviso publicado en la sala', // DEV-55
  'aviso-sala-quitado': 'Aviso quitado de la sala',
  'llegada-deshecha': 'Registro deshecho en el tótem', // DEV-53
  prioridad: 'Prioridad de atención', // DEV-49
  'prioridad-quitada': 'Prioridad quitada',
  'pausa-consultorio': 'Pausa del consultorio', // DEV-58
  'reanudar-consultorio': 'Consultorio reanudado',
  'cambio-consultorio': 'Cambio de consultorio del día', // DEV-60
  'derivacion-consultorio': 'Derivación desde el consultorio', // DEV-59
  'ausente-box': 'Ausente en el box de admisión', // DEV-44
};
