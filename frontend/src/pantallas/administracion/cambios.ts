/** Cambios de configuración con su registro de auditoría (#60). */
import { actualizarConfiguracion, type Configuracion } from '../../servicios/configuracion';
import { registrarAuditoria } from '../../servicios/auditoria';
import { usuarioActual } from '../../servicios/sesion';

export function cambiar(detalle: string, cambio: (c: Configuracion) => Configuracion, accion = 'configuracion') {
  actualizarConfiguracion(cambio);
  registrarAuditoria({ accion, usuario: usuarioActual()?.usuario ?? 'sin-usuario', detalle });
}

/** Identificador legible a partir de un nombre: "Centro Güemes" → "centro-guemes". */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
