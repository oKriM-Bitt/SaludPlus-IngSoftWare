/**
 * Reglas de la cola de atención (S3 y S4): prioridad, box de admisión, pausa, rotación de
 * consultorio, derivación desde el consultorio, turnos del día y deshacer en el tótem.
 * Cada prueba carga los módulos de nuevo, así empieza con la demo en su estado inicial.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Turnos = typeof import('./turnos');
type Config = typeof import('./configuracion');
let T: Turnos;
let C: Config;

/** Las funciones simulan la demora de la red con setTimeout: se adelanta el reloj. */
async function ya<V>(p: Promise<V>): Promise<V> {
  const resultado = p.then(
    (valor) => ({ ok: true as const, valor }),
    (error: unknown) => ({ ok: false as const, error }),
  );
  await vi.runAllTimersAsync();
  const r = await resultado;
  if (!r.ok) throw r.error;
  return r.valor;
}

beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['setTimeout'] });
  vi.stubGlobal('navigator', { onLine: true });
  vi.resetModules();
  C = await import('./configuracion');
  T = await import('./turnos');
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const FERRER = 'Dra. Lucía Ferrer'; // consultorio 4: Sofía M. (A021) y Carlos B. (A022) en espera
const VIDAL = 'Dr. Tomás Vidal'; // consultorio 2

describe('prioridad de atención (DEV-49)', () => {
  it('el paciente con prioridad pasa adelante en la cola de su profesional', async () => {
    const antes = await ya(T.obtenerCola('4'));
    expect(antes.enEspera.map((a) => a.numero)).toEqual(['A021', 'A022']);
    const carlos = antes.enEspera[1];
    await ya(T.marcarPrioridad(carlos, 'Embarazo'));
    const despues = await ya(T.obtenerCola('4'));
    expect(despues.enEspera.map((a) => a.numero)).toEqual(['A022', 'A021']);
  });
  it('queda registrado quién, cuándo y por qué', async () => {
    const [sofia] = (await ya(T.obtenerCola('4'))).enEspera;
    const r = await ya(T.marcarPrioridad(sofia, 'Persona con discapacidad'));
    expect(r.prioridad).toMatchObject({ motivo: 'Persona con discapacidad', usuario: 'sin-usuario' });
    expect(T.obtenerAuditoria().slice(-1)[0]).toMatchObject({ accion: 'prioridad', numero: 'A021', detalle: 'Persona con discapacidad' });
  });
  it('solo acepta los motivos que configuró dirección', async () => {
    const [sofia] = (await ya(T.obtenerCola('4'))).enEspera;
    await expect(ya(T.marcarPrioridad(sofia, 'Es amigo'))).rejects.toThrow(/motivos aprobados/);
  });
  it('la sala no recibe el motivo de la prioridad', async () => {
    const [sofia] = (await ya(T.obtenerCola('4'))).enEspera;
    await ya(T.marcarPrioridad(sofia, 'Embarazo'));
    await ya(T.llamarSiguiente('4'));
    expect(JSON.stringify(await ya(T.obtenerSala()))).not.toContain('Embarazo');
  });
});

describe('llamado a los boxes de admisión (DEV-44)', () => {
  it('cada secretaria elige su box y no puede tomar uno ocupado', async () => {
    await ya(T.elegirBox('jbenitez', '1'));
    expect(T.boxDe('jbenitez')).toBe('1');
    await expect(ya(T.elegirBox('mcastro', '1'))).rejects.toThrow(/lo está usando Julia Benítez/);
    await ya(T.elegirBox('mcastro', '2'));
    expect(T.ocupacionBoxes()).toEqual({ '1': 'jbenitez', '2': 'mcastro' });
  });
  it('la pantalla de boxes muestra número y box, y al terminar queda en espera del profesional', async () => {
    const proximo = T.colaDeBox()[0];
    const esperaban = T.colaDeBox().length;
    const llamado = await ya(T.llamarAlBox('1', proximo.turnoId));
    const boxes = await ya(T.obtenerSala(new Date(), 'boxes'));
    expect(boxes.actual).toMatchObject({ numero: llamado.numero, lugar: 'box', destino: '1' });
    expect(T.textoDestino(boxes.actual!)).toBe('Box 1');
    expect(boxes.boxes.find((b) => b.numero === '1')).toMatchObject({ atendiendo: llamado.numero });
    expect(boxes.esperanBox).toBe(esperaban - 1);
    expect([boxes.actual, ...boxes.anteriores].every((l) => l!.lugar === 'box')).toBe(true);
    // La sala de espera sigue mostrando solo los llamados a consultorio.
    const sala = await ya(T.obtenerSala());
    expect([sala.actual, ...sala.anteriores].filter(Boolean).every((l) => l!.lugar === 'consultorio')).toBe(true);
    // Mientras está en el box, el profesional no lo puede llamar.
    expect((await ya(T.obtenerCola(llamado.consultorio))).enEspera.some((a) => a.turnoId === llamado.turnoId)).toBe(false);
    await ya(T.finalizarBox(llamado));
    const cola = await ya(T.obtenerCola(llamado.consultorio));
    expect(cola.enEspera.some((a) => a.turnoId === llamado.turnoId)).toBe(true);
    expect(T.colaDeBox().some((a) => a.turnoId === llamado.turnoId)).toBe(false);
  });
  it('no llama a otro mientras hay alguien en el box; puede volver a llamar y marcar ausente', async () => {
    const llamado = await ya(T.llamarAlBox('1'));
    await expect(ya(T.llamarAlBox('1'))).rejects.toBeInstanceOf(T.PacienteEnAtencionError);
    const otra = await ya(T.volverALlamarBox(llamado));
    expect(otra.box?.llamados).toBe(2);
    const ausente = await ya(T.ausenteEnBox(otra));
    expect(ausente.estado).toBe('ausente');
    expect(T.pacienteEnBox('1')).toBeNull();
  });
});

describe('ocupación de los boxes de admisión (DEV-72)', () => {
  const auditoria = (accion: string) => T.obtenerAuditoria().filter((r) => r.accion === accion);

  it('los boxes ocupados figuran con el nombre de quien atiende y no se pueden elegir', async () => {
    await ya(T.elegirBox('jbenitez', '1'));
    const paraMarcela = T.opcionesDeBox('mcastro');
    expect(paraMarcela.find((b) => b.numero === '1')).toMatchObject({ ocupadoPor: 'Julia Benítez', mio: false });
    expect(paraMarcela.find((b) => b.numero === '2')).toMatchObject({ ocupadoPor: null });
    // Para quien lo tiene, su box no figura ocupado.
    expect(T.opcionesDeBox('jbenitez').find((b) => b.numero === '1')).toMatchObject({ ocupadoPor: null, mio: true });
    await expect(ya(T.elegirBox('mcastro', '1'))).rejects.toThrow('El box 1 lo está usando Julia Benítez. Elija otro.');
    expect(T.boxDe('mcastro')).toBeNull();
  });

  it('si dos personas eligen el mismo box casi a la vez, solo una lo toma y la otra recibe el aviso', async () => {
    // Las dos vieron el box 1 libre y lo eligen antes de que termine la primera.
    const julia = T.elegirBox('jbenitez', '1');
    const marcela = T.elegirBox('mcastro', '1');
    const resultados = await ya(Promise.allSettled([julia, marcela]));
    expect(resultados[0].status).toBe('fulfilled');
    expect(resultados[1]).toMatchObject({ status: 'rejected', reason: { message: 'El box 1 lo está usando Julia Benítez. Elija otro.' } });
    expect(T.ocupacionBoxes()).toEqual({ '1': 'jbenitez' });
    expect(auditoria('toma-box')).toHaveLength(1);
  });

  it('al dejar el box queda libre para otra persona', async () => {
    await ya(T.elegirBox('jbenitez', '1'));
    await ya(T.elegirBox('jbenitez', null));
    expect(T.ocupacionBoxes()).toEqual({});
    await ya(T.elegirBox('mcastro', '1'));
    expect(T.boxDe('mcastro')).toBe('1');
  });

  it('al cambiar de box deja el anterior libre', async () => {
    await ya(T.elegirBox('jbenitez', '1'));
    await ya(T.elegirBox('jbenitez', '2'));
    expect(T.ocupacionBoxes()).toEqual({ '2': 'jbenitez' });
  });

  it('al cerrar sesión el box queda libre', async () => {
    const S = await import('./sesion');
    S.abrirSesion(C.configuracion().usuarios.find((u) => u.usuario === 'jbenitez')!, 'villa-norte');
    await ya(T.elegirBox('jbenitez', '1'));
    S.cerrarSesion();
    expect(T.ocupacionBoxes()).toEqual({});
    expect(T.opcionesDeBox('mcastro').every((b) => b.ocupadoPor === null)).toBe(true);
    expect(auditoria('deja-box').slice(-1)[0]).toMatchObject({ usuario: 'jbenitez', box: '1', detalle: 'Box 1 · al cerrar sesión' });
  });

  it('la auditoría registra quién tomó y quién dejó cada box', async () => {
    await ya(T.elegirBox('jbenitez', '1'));
    await ya(T.elegirBox('jbenitez', null));
    await ya(T.elegirBox('mcastro', '1'));
    expect(auditoria('toma-box').map((r) => [r.usuario, r.box])).toEqual([
      ['jbenitez', '1'],
      ['mcastro', '1'],
    ]);
    expect(auditoria('deja-box').map((r) => [r.usuario, r.box, r.detalle])).toEqual([['jbenitez', '1', 'Box 1 · lo dejó libre']]);
  });

  it('no puede dejar el box con un paciente en atención', async () => {
    await ya(T.elegirBox('jbenitez', '1'));
    await ya(T.llamarAlBox('1'));
    await expect(ya(T.elegirBox('jbenitez', null))).rejects.toThrow(/Finalice la atención del box/);
    expect(T.boxDe('jbenitez')).toBe('1');
  });
});

describe('pausa del consultorio (DEV-58)', () => {
  it('durante la pausa no se puede llamar y la sala muestra la demora', async () => {
    const antes = (await ya(T.obtenerSala())).esperas.find((e) => e.especialidad.includes('consultorio 4'))!.minutos;
    await ya(T.pausarConsultorio('4', 10));
    await expect(ya(T.llamarSiguiente('4'))).rejects.toBeInstanceOf(T.ConsultorioEnPausaError);
    const sala = await ya(T.obtenerSala());
    expect(sala.avisos.some((a) => a.texto.includes('Consultorio 4: pausa breve'))).toBe(true);
    expect(sala.esperas.find((e) => e.especialidad.includes('consultorio 4'))!.minutos).toBe(antes + 10);
    expect(T.pausasDeHoy()[FERRER]).toMatchObject({ minutos: 10, consultorio: '4' });
  });
  it('al reanudar se puede llamar y la espera estimada se recalcula', async () => {
    const antes = (await ya(T.obtenerSala())).esperas.find((e) => e.especialidad.includes('consultorio 4'))!.minutos;
    await ya(T.pausarConsultorio('4', 15));
    await ya(T.reanudarConsultorio('4'));
    expect((await ya(T.obtenerSala())).esperas.find((e) => e.especialidad.includes('consultorio 4'))!.minutos).toBe(antes);
    expect((await ya(T.llamarSiguiente('4'))).numero).toBe('A021');
  });
  it('solo acepta 5, 10 o 15 minutos y no con un paciente en atención', async () => {
    await expect(ya(T.pausarConsultorio('4', 30))).rejects.toThrow(/5, 10 o 15/);
    await ya(T.llamarSiguiente('4'));
    await expect(ya(T.pausarConsultorio('4', 5))).rejects.toBeInstanceOf(T.PacienteEnAtencionError);
  });
});

describe('el profesional elige el consultorio del día (DEV-60)', () => {
  it('propone el de su agenda y marca ocupados los de otros profesionales', () => {
    const opciones = T.opcionesDeConsultorio('p-ferrer', 'villa-norte');
    expect(opciones.find((o) => o.consultorio.numero === '4')).toMatchObject({ agenda: true, ocupadoPor: null });
    expect(opciones.find((o) => o.consultorio.numero === '2')?.ocupadoPor).toBe(VIDAL);
    expect(opciones.find((o) => o.consultorio.numero === '10')?.ocupadoPor).toBeNull();
    expect(T.consultorioPropuesto('p-ferrer', 'villa-norte')).toBe('vn-4');
  });
  it('al cambiar, la sala y la secretaría ven el consultorio nuevo y sus pacientes lo siguen', async () => {
    expect(await ya(T.elegirConsultorio('p-ferrer', 'vn-10', 'villa-norte'))).toBe('10');
    expect(C.profesionalesDelDia('villa-norte').find((p) => p.id === 'p-ferrer')?.consultorio).toBe('10');
    expect(T.PROFESIONALES.find((p) => p.nombre === FERRER)?.consultorio).toBe('10');
    expect((await ya(T.obtenerCola('10'))).enEspera.map((a) => a.numero)).toEqual(['A021', 'A022']);
    expect((await ya(T.obtenerCola('4'))).enEspera).toEqual([]);
    expect((await ya(T.obtenerSala())).esperas.some((e) => e.especialidad.includes('consultorio 10'))).toBe(true);
  });
  it('los llamados ya hechos conservan el consultorio donde se atendieron', async () => {
    await ya(T.elegirConsultorio('p-ferrer', 'vn-10', 'villa-norte'));
    const sala = await ya(T.obtenerSala());
    expect([sala.actual, ...sala.anteriores].find((l) => l?.numero === 'A016')).toMatchObject({ lugar: 'consultorio', destino: '4' });
  });
  it('no puede tomar un consultorio ocupado ni cambiar con un paciente en atención', async () => {
    await expect(ya(T.elegirConsultorio('p-ferrer', 'vn-2', 'villa-norte'))).rejects.toThrow(/lo está usando/);
    await ya(T.llamarSiguiente('4'));
    await expect(ya(T.elegirConsultorio('p-ferrer', 'vn-10', 'villa-norte'))).rejects.toBeInstanceOf(T.PacienteEnAtencionError);
    // Confirmar el mismo consultorio sí se puede.
    expect(await ya(T.elegirConsultorio('p-ferrer', 'vn-4', 'villa-norte'))).toBe('4');
  });
});

describe('derivar desde el consultorio (DEV-59)', () => {
  it('finaliza la atención y el paciente pasa directo a la cola del destino', async () => {
    const enAtencion = await ya(T.llamarSiguiente('4'));
    const derivada = await ya(T.derivarAlFinalizar(enAtencion, VIDAL, 'Requiere otra especialidad'));
    expect(derivada).toMatchObject({ numero: 'A021', profesional: VIDAL, consultorio: '2', tipo: 'derivacion', estado: 'en-espera' });
    expect((await ya(T.obtenerCola('4'))).enAtencion).toBeNull();
    expect((await ya(T.obtenerCola('2'))).enEspera.some((a) => a.turnoId === derivada.turnoId)).toBe(true);
    // No vuelve a pasar por la secretaría (box), pero la secretaría lo ve en la cola.
    expect(T.colaDeBox().some((a) => a.turnoId === derivada.turnoId)).toBe(false);
    expect((await ya(T.obtenerColaCentro())).registros.some((a) => a.turnoId === derivada.turnoId)).toBe(true);
  });
  it('la derivación queda registrada', async () => {
    const enAtencion = await ya(T.llamarSiguiente('4'));
    const derivada = await ya(T.derivarAlFinalizar(enAtencion, VIDAL, 'Interconsulta'));
    expect(derivada.derivaciones?.slice(-1)[0]).toMatchObject({ desde: FERRER, hacia: VIDAL, motivo: 'Interconsulta' });
    expect(T.obtenerAuditoria().slice(-1)[0]).toMatchObject({ accion: 'derivacion-consultorio', numero: 'A021' });
  });
  it('solo con un paciente en atención y hacia otro profesional', async () => {
    const [sofia] = (await ya(T.obtenerCola('4'))).enEspera;
    await expect(ya(T.derivarAlFinalizar(sofia, VIDAL, 'x'))).rejects.toThrow(/en atención/);
    const enAtencion = await ya(T.llamarSiguiente('4'));
    await expect(ya(T.derivarAlFinalizar(enAtencion, FERRER, 'x'))).rejects.toThrow(/otro profesional/);
  });
});

describe('turnos del día del profesional (DEV-57)', () => {
  it('lista quién llegó, quién espera, quién fue atendido y quién falta llegar', () => {
    const turnos = T.turnosDelProfesional(FERRER);
    const por = (paciente: string) => turnos.find((t) => t.paciente === paciente)?.estado;
    expect(por('Sofía M.')).toBe('en-espera');
    expect(por('Inés C.')).toBe('atendido');
    expect(por('Carolina V.')).toBe('ausente');
    expect(por('Marta R.')).toBe('pendiente');
    expect(por('Raúl D.')).toBe('pendiente');
    // Ordenados por horario y sin datos de salud ni documento.
    expect(turnos.map((t) => t.horario)).toEqual([...turnos.map((t) => t.horario)].sort());
    expect(Object.keys(turnos[0]).sort()).toEqual(['estado', 'horario', 'id', 'numero', 'paciente']);
  });
  it('se actualiza cuando alguien registra su llegada', async () => {
    const r = await ya(T.buscarTurno('30111222'));
    expect(r.tipo).toBe('encontrado');
    if (r.tipo !== 'encontrado') return;
    const a = await ya(T.registrarLlegada(r.turno));
    expect(T.turnosDelProfesional(FERRER).find((t) => t.id === 't-1')).toMatchObject({ estado: 'en-espera', numero: a.numero });
  });
  it('estado de cada turno según su admisión', () => {
    expect(T.estadoTurnoDia(undefined, FERRER, false)).toBe('pendiente');
    expect(T.estadoTurnoDia(undefined, FERRER, true)).toBe('ausente');
  });
});

describe('deshacer el registro en el tótem (DEV-53)', () => {
  it('deshace sin dejar admisión duplicada ni número sin uso', async () => {
    const r = await ya(T.buscarTurno('30111222'));
    if (r.tipo !== 'encontrado') throw new Error('turno de prueba no encontrado');
    const primera = await ya(T.registrarLlegada(r.turno));
    await ya(T.deshacerLlegada(primera));
    const cola = await ya(T.obtenerColaCentro());
    expect(cola.registros.some((a) => a.turnoId === 't-1')).toBe(false);
    // Vuelve a registrarse: recibe el mismo número, no queda un hueco en la numeración.
    const segunda = await ya(T.registrarLlegada(r.turno));
    expect(segunda.numero).toBe(primera.numero);
    expect((await ya(T.obtenerColaCentro())).registros.filter((a) => a.turnoId === 't-1')).toHaveLength(1);
  });
  it('pasados los segundos para deshacer, ya no se puede', async () => {
    const r = await ya(T.buscarTurno('30111222'));
    if (r.tipo !== 'encontrado') throw new Error('turno de prueba no encontrado');
    const a = await ya(T.registrarLlegada(r.turno));
    expect(T.puedeDeshacer(a)).toBe(true);
    expect(T.puedeDeshacer(a, new Date(Date.now() + (T.SEGUNDOS_PARA_DESHACER + 1) * 1000))).toBe(false);
  });
});

describe('avisos generales en la sala (DEV-55)', () => {
  it('la sala recibe los avisos vigentes de su sucursal', async () => {
    const { publicarAviso, vencimiento } = await import('./avisos');
    publicarAviso({ sucursal: 'villa-norte', texto: 'Hay demoras en la atención.', hasta: vencimiento(30), usuario: 'jbenitez' });
    expect((await ya(T.obtenerSala())).generales.map((g) => g.texto)).toEqual(['Hay demoras en la atención.']);
  });
});

describe('mismo número para dos personas: se pide el CUIL (#54)', () => {
  it('sin CUIL pide confirmar quién es; con el CUIL encuentra el turno de esa persona', async () => {
    const r = await ya(T.buscarTurno('100200500'));
    expect(r.tipo).toBe('varias-personas');
    const elsa = await ya(T.buscarTurno('100200500', new Date(), undefined, '27201119990'));
    expect(elsa.tipo === 'encontrado' && elsa.turno.paciente).toBe('Elsa F.');
    const otro = await ya(T.buscarTurno('100200500', new Date(), undefined, '20111111112'));
    expect(otro.tipo).toBe('no-encontrado');
  });
});

describe('avisos de profesionales en la sala', () => {
  it('nombran al profesional, porque puede atender en otro consultorio cada día', async () => {
    await ya(T.marcarEstadoProfesional(VIDAL, 'demorado', 20));
    const sala = await ya(T.obtenerSala());
    expect(sala.avisos.some((a) => a.texto.startsWith(`${VIDAL} (Cardiología) · Consultorio 2: demora estimada de 20 minutos`))).toBe(true);
  });
});
