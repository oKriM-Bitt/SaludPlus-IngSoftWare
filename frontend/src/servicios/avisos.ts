/**
 * DEV-55: avisos generales que la secretaría muestra en la pantalla de sala
 * (demoras, cambios de consultorio). Nunca llevan datos personales de pacientes.
 */
import { borrar, escribirJSON, leerJSON, parametroURL } from './almacen';
import { registrarAuditoria } from './auditoria';
import { normalizar } from './busqueda';
import { hora } from '../utilidades/fechas';

export type AvisoSala = {
  id: string;
  sucursal: string;
  texto: string;
  hasta: string; // ISO: hasta cuándo se muestra
  creadoEn: string;
  usuario: string;
  quitadoEn?: string; // se quitó antes de vencer
};

export const CLAVE_AVISOS = 'saludplus.avisos.sala';
if (parametroURL('reset') === '1') borrar(CLAVE_AVISOS);

export const LARGO_MAXIMO_AVISO = 120;

export const MENSAJES_PREDEFINIDOS = [
  'Hay demoras en la atención. Gracias por su paciencia.',
  'Algunos consultorios cambiaron de número. Mire la pantalla al ser llamado.',
  'Si tiene dudas sobre su turno, acérquese a secretaría.',
  'Por favor, mantenga su celular en silencio.',
  'La atención de hoy finaliza pronto. Consulte en secretaría.',
];

/** Opciones de duración: minutos o null = hasta el fin del día. */
export const DURACIONES: { etiqueta: string; minutos: number | null }[] = [
  { etiqueta: '15 minutos', minutos: 15 },
  { etiqueta: '30 minutos', minutos: 30 },
  { etiqueta: '1 hora', minutos: 60 },
  { etiqueta: '2 horas', minutos: 120 },
  { etiqueta: 'Hasta el fin del día', minutos: null },
];

export function vencimiento(minutos: number | null, ahora = new Date()): Date {
  if (minutos !== null) return new Date(ahora.getTime() + minutos * 60_000);
  const fin = new Date(ahora);
  fin.setHours(23, 59, 0, 0);
  return fin;
}

/**
 * Motivo por el que el aviso no se puede publicar, o null si está bien.
 * Rechaza números largos (DNI, afiliado, teléfono), correos y nombres de pacientes del día.
 */
export function problemaConAviso(texto: string, nombresPacientes: string[] = []): string | null {
  const t = texto.trim();
  if (!t) return 'Escriba el mensaje.';
  if (t.length > LARGO_MAXIMO_AVISO) return `El mensaje debe tener como máximo ${LARGO_MAXIMO_AVISO} caracteres.`;
  const sinSeparadores = t.replace(/(\d)[.\s-](?=\d)/g, '$1');
  if (/\d{6,}/.test(sinSeparadores)) return 'No incluya números de documento, de afiliado ni teléfonos.';
  if (/\S+@\S+\.\S+/.test(t)) return 'No incluya direcciones de correo.';
  const palabras = new Set(normalizar(t).split(/[^a-zñ]+/).filter(Boolean));
  const nombre = nombresPacientes
    .map((n) => normalizar(n).split(/\s+/)[0]?.replace(/[^a-zñ]/g, ''))
    .find((n) => n && n.length >= 3 && palabras.has(n));
  if (nombre) return 'No incluya nombres de pacientes. La sala es pública.';
  return null;
}

const todos = () => leerJSON<AvisoSala[]>(CLAVE_AVISOS, []);

/** Avisos que se ven ahora en la sala de una sucursal, del más nuevo al más viejo. */
export function avisosVigentes(sucursal: string, ahora = new Date()): AvisoSala[] {
  return todos()
    .filter((a) => a.sucursal === sucursal && !a.quitadoEn && new Date(a.hasta) > ahora)
    .sort((a, b) => b.creadoEn.localeCompare(a.creadoEn));
}

export function publicarAviso(datos: { sucursal: string; texto: string; hasta: Date; usuario: string }, nombresPacientes: string[] = []): AvisoSala {
  const problema = problemaConAviso(datos.texto, nombresPacientes);
  if (problema) throw new Error(problema);
  const aviso: AvisoSala = {
    id: `av-${Date.now()}`,
    sucursal: datos.sucursal,
    texto: datos.texto.trim(),
    hasta: datos.hasta.toISOString(),
    creadoEn: new Date().toISOString(),
    usuario: datos.usuario,
  };
  escribirJSON(CLAVE_AVISOS, [...todos(), aviso]);
  registrarAuditoria({ accion: 'aviso-sala', usuario: datos.usuario, sucursal: datos.sucursal, detalle: `${aviso.texto} · hasta ${hora(aviso.hasta)}` });
  return aviso;
}

/** Quita un aviso antes de que venza. Queda guardado como quitado (no se borra). */
export function quitarAviso(id: string, usuario: string) {
  const lista = todos();
  const aviso = lista.find((a) => a.id === id);
  if (!aviso || aviso.quitadoEn) return;
  escribirJSON(
    CLAVE_AVISOS,
    lista.map((a) => (a.id === id ? { ...a, quitadoEn: new Date().toISOString() } : a)),
  );
  registrarAuditoria({ accion: 'aviso-sala-quitado', usuario, sucursal: aviso.sucursal, detalle: aviso.texto });
}
