/**
 * Usuarios FICTICIOS para la demo del inicio de sesión (#47).
 * Cuando exista la autenticación del backend (#17), la validación pasa al servidor
 * y este archivo se elimina; los tipos se mantienen.
 */

export type Rol = 'secretaria' | 'profesional' | 'direccion';

export type Usuario = {
  usuario: string;
  nombre: string;
  rol: Rol;
  centro: string;
  consultorio?: string; // solo profesionales
};

export const ETIQUETA_ROL: Record<Rol, string> = {
  secretaria: 'Admisión',
  profesional: 'Profesional',
  direccion: 'Dirección',
};

const CENTRO = 'Centro Villa Norte';

/** Contraseña común de la demo. Nunca se usan datos reales. */
export const CLAVE_DEMO = 'saludplus';

export const USUARIOS_DEMO: Usuario[] = [
  { usuario: 'jbenitez', nombre: 'Julia Benítez', rol: 'secretaria', centro: CENTRO },
  { usuario: 'lferrer', nombre: 'Dra. Lucía Ferrer', rol: 'profesional', centro: CENTRO, consultorio: '4' },
  { usuario: 'tvidal', nombre: 'Dr. Tomás Vidal', rol: 'profesional', centro: CENTRO, consultorio: '2' },
  { usuario: 'prios', nombre: 'Dra. Paula Ríos', rol: 'profesional', centro: CENTRO, consultorio: '6' },
  { usuario: 'direccion', nombre: 'Dirección médica', rol: 'direccion', centro: CENTRO },
];

/** Devuelve el usuario si el nombre (sin distinguir mayúsculas) y la contraseña coinciden. */
export function validarCredenciales(usuario: string, clave: string): Usuario | null {
  const nombre = usuario.trim().toLowerCase();
  const encontrado = USUARIOS_DEMO.find((u) => u.usuario === nombre);
  return encontrado && clave === CLAVE_DEMO ? encontrado : null;
}

export type Destino = { ruta: string; titulo: string; descripcion: string; icono: 'users' | 'user-check' | 'monitor' | 'hand' | 'grid'; nuevaPestana?: boolean };

/** Opciones del menú según el rol (#48). El tótem y la sala se abren en otra pestaña. */
export function destinosPorRol(u: Usuario): Destino[] {
  const sala: Destino = { ruta: '/sala', titulo: 'Pantalla de sala', descripcion: 'Llamados y espera estimada para la TV de la sala.', icono: 'monitor', nuevaPestana: true };
  const totem: Destino = { ruta: '/totem', titulo: 'Tótem de autogestión', descripcion: 'Registro de llegada de los pacientes.', icono: 'hand', nuevaPestana: true };
  const admision: Destino = { ruta: '/secretaria', titulo: 'Admisión y sala de espera', descripcion: 'Cola del centro, llegadas, demanda espontánea y contraturnos.', icono: 'users' };
  const consultorio = (c: string, nombre: string): Destino => ({
    ruta: `/profesional?consultorio=${c}`,
    titulo: `Consultorio ${c}`,
    descripcion: `${nombre}: pacientes en espera y llamados.`,
    icono: 'user-check',
  });

  if (u.rol === 'secretaria') return [admision, sala, totem];
  if (u.rol === 'profesional') return [{ ...consultorio(u.consultorio ?? '4', 'Su consultorio'), titulo: 'Mi consultorio' }, sala];
  return [
    admision,
    ...USUARIOS_DEMO.filter((p) => p.rol === 'profesional').map((p) => consultorio(p.consultorio!, p.nombre)),
    sala,
    totem,
    { ruta: '/componentes', titulo: 'Lámina de componentes', descripcion: 'Sistema visual de SaludPlus.', icono: 'grid' },
  ];
}

/** Rutas internas que puede abrir cada rol. */
export function puedeAcceder(u: Usuario, ruta: string): boolean {
  if (ruta === '/inicio') return true;
  if (u.rol === 'direccion') return true;
  if (u.rol === 'secretaria') return ruta === '/secretaria';
  return ruta === '/profesional';
}
