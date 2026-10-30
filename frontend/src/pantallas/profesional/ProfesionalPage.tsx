import { useCallback, useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { StatusChip } from '../../componentes/StatusChip';
import { MenuUsuario } from '../../componentes/MenuUsuario';
import { TiempoEspera } from '../../componentes/TiempoEspera';
import { MarcaPrioridad } from '../../componentes/MarcaPrioridad';
import { useUsuario } from '../../servicios/sesion';
import { profesionalesDelDia } from '../../servicios/configuracion';
import {
  ConsultorioEnPausaError,
  derivarAlFinalizar,
  escucharCambios,
  finalizarAtencion,
  MINUTOS_DE_PAUSA,
  minutosRestantesPausa,
  pausaDe,
  pausarConsultorio,
  PROFESIONALES,
  reanudarConsultorio,
  turnosDelProfesional,
  type EstadoTurnoDia,
  type Pausa,
  type TurnoDelDia,
  hayConexion,
  LLAMADOS_ANTES_DE_AUSENTE,
  llamarPaciente,
  marcarAusente,
  obtenerCola,
  PacienteEnAtencionError,
  PacienteNoDisponibleError,
  profesionalPorConsultorio,
  SinConexionError,
  volverALlamar,
  type Admision,
  type ColaConsultorio,
} from '../../servicios/turnos';
import { ATAJOS, atajoDeTecla, moverEnLista, pacientesSaltados } from '../../servicios/llamados';
import { fechaLarga, hora, minutosEntre } from '../../utilidades/fechas';
import { Modal } from '../secretaria/Modal';
import './profesional.css';

const ACTUALIZAR_CADA_MS = 5_000;

type Accion = 'llamando' | 'rellamando' | 'finalizando' | 'ausente' | 'pausando' | 'reanudando' | 'derivando';

type Estado =
  | { tipo: 'cargando' } // P04
  | { tipo: 'error' } // P05
  | { tipo: 'sin-conexion' } // P06
  | { tipo: 'datos'; cola: ColaConsultorio }; // P01, P02 o P03

/** #42: confirmación antes de llamar si hay alguien en atención o si el llamado es fuera de orden. */
type Pendiente = { objetivo: Admision; enAtencion: Admision | null; saltados: Admision[] };

export function ProfesionalPage() {
  const usuario = useUsuario();
  // El profesional ve siempre su consultorio; dirección puede elegirlo por la dirección web.
  // Un profesional sin consultorio asignado hoy (#60) no ve la cola de otro.
  const consultorio =
    usuario?.rol === 'profesional'
      ? usuario.consultorio ?? ''
      : new URLSearchParams(window.location.search).get('consultorio') ?? profesionalesDelDia(usuario?.sucursal ?? 'villa-norte')[0]?.consultorio ?? '';
  const datos = profesionalPorConsultorio(consultorio);

  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [accion, setAccion] = useState<Accion | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const [pausa, setPausa] = useState<Pausa | null>(null); // DEV-58
  const [eligiendoPausa, setEligiendoPausa] = useState(false);
  const [derivando, setDerivando] = useState(false); // DEV-59
  const [turnosDia, setTurnosDia] = useState<TurnoDelDia[]>([]); // DEV-57
  const [filaActiva, setFilaActiva] = useState<string | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [ahora, setAhora] = useState(new Date());
  const ocupado = useRef(false);
  const filas = useRef(new Map<string, HTMLTableRowElement>());

  const actualizar = useCallback(async () => {
    if (ocupado.current) return;
    if (!hayConexion()) return setEstado({ tipo: 'sin-conexion' });
    try {
      const cola = await obtenerCola(consultorio);
      setEstado({ tipo: 'datos', cola });
      setUltimaActualizacion(cola.actualizadoEn);
      setPausa(pausaDe(datos.nombre));
      setTurnosDia(turnosDelProfesional(datos.nombre));
    } catch (e) {
      setEstado(e instanceof SinConexionError ? { tipo: 'sin-conexion' } : { tipo: 'error' });
    }
  }, [consultorio, datos.nombre]);

  // Actualización periódica, al cambiar la cola en otra pestaña (tótem o secretaría) y al volver la conexión.
  useEffect(() => {
    actualizar();
    const intervalo = window.setInterval(() => {
      setAhora(new Date());
      actualizar();
    }, ACTUALIZAR_CADA_MS);
    const dejarDeEscuchar = escucharCambios(actualizar);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.clearInterval(intervalo);
      dejarDeEscuchar();
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, [actualizar]);

  // Los avisos de la última acción desaparecen solos.
  useEffect(() => {
    if (!confirmacion && !alerta) return;
    const t = window.setTimeout(() => {
      setConfirmacion(null);
      setAlerta(null);
    }, 6_000);
    return () => window.clearTimeout(t);
  }, [confirmacion, alerta]);

  const ejecutar = async (tipo: Accion, operacion: () => Promise<unknown>, aviso?: string) => {
    ocupado.current = true;
    setAccion(tipo);
    setConfirmacion(null);
    setAlerta(null);
    let ok = false;
    try {
      await operacion();
      ok = true;
    } catch (e) {
      if (e instanceof PacienteNoDisponibleError) setAlerta('Ese paciente ya no está en espera. La lista se actualizó.');
      else if (e instanceof PacienteEnAtencionError) setAlerta(`${e.enAtencion.numero} sigue en atención. Finalícela antes de ${tipo === 'pausando' ? 'tomar una pausa' : 'llamar a otro paciente'}.`);
      else if (e instanceof ConsultorioEnPausaError) setAlerta('El consultorio está en pausa. Toque "Reanudar atención" para volver a llamar.');
      else if (e instanceof Error && e.name === 'OperacionNoPermitidaError') setAlerta(e.message);
      else setEstado(e instanceof SinConexionError ? { tipo: 'sin-conexion' } : { tipo: 'error' });
    } finally {
      ocupado.current = false;
      setAhora(new Date());
      // La pantalla muestra el resultado confirmado antes de habilitar otra acción.
      if (ok) await actualizar();
      else actualizar();
      setAccion(null);
      if (ok && aviso) setConfirmacion(aviso);
    }
  };

  const cola = estado.tipo === 'datos' ? estado.cola : null;
  const sinConexion = estado.tipo === 'sin-conexion';
  const enAtencion = cola?.enAtencion ?? null;
  const enEspera = cola?.enEspera ?? [];
  const proximo = enEspera[0] ?? null;
  const esperando = cola ? enEspera.length : null;
  const mayorEspera = enEspera.length > 0 ? Math.max(...enEspera.map((a) => minutosEntre(a.registradaEn, ahora))) : null;
  const llamados = enAtencion?.llamados ?? 1;
  const puedeMarcarAusente = llamados >= LLAMADOS_ANTES_DE_AUSENTE;
  const textoSinConexion = ultimaActualizacion
    ? `Sin conexión – última actualización ${hora(ultimaActualizacion)}`
    : 'Sin conexión';

  // Mismas condiciones para el mouse y para el teclado (DEV-38).
  const libre = !!cola && accion === null && pendiente === null;
  const puedeLlamar = libre && enEspera.length > 0 && !pausa; // DEV-58: en pausa no se llama
  const restantePausa = pausa ? minutosRestantesPausa(pausa, ahora) : 0;
  const pendientesDeLlegar = turnosDia.filter((t) => t.estado === 'pendiente').length;
  const porAtender = turnosDia.filter((t) => t.estado === 'pendiente' || t.estado === 'en-espera' || t.estado === 'en-atencion').length;
  const puedeAtender = libre && !!enAtencion;

  // Fila de la tabla que recibe el foco con Tab (foco itinerante: una sola fila en el orden de tabulación).
  const filaConFoco = enEspera.some((a) => a.turnoId === filaActiva) ? filaActiva : proximo?.turnoId ?? null;

  /** #42: llamar al paciente elegido o, sin elegir, al próximo. Pide confirmación cuando corresponde. */
  const pedirLlamado = (elegido?: Admision) => {
    if (!puedeLlamar) return;
    const objetivo = elegido ?? proximo!;
    const saltados = pacientesSaltados(enEspera, objetivo.turnoId);
    if (enAtencion || saltados.length > 0) setPendiente({ objetivo, enAtencion, saltados });
    else llamar({ objetivo, enAtencion: null, saltados: [] });
  };

  const llamar = ({ objetivo, enAtencion: aFinalizar, saltados }: Pendiente) => {
    setPendiente(null);
    ejecutar(
      'llamando',
      async () => {
        if (aFinalizar) await finalizarAtencion(aFinalizar);
        await llamarPaciente(consultorio, objetivo.turnoId, usuario?.usuario ?? 'sin-usuario');
      },
      saltados.length > 0 ? `Se llamó a ${objetivo.numero} fuera de orden. Quedó registrado quién, cuándo y a qué paciente.` : undefined,
    );
  };

  const finalizar = () => {
    if (puedeAtender) ejecutar('finalizando', () => finalizarAtencion(enAtencion!));
  };

  const rellamar = () => {
    if (puedeAtender) ejecutar('rellamando', () => volverALlamar(enAtencion!), `Se volvió a llamar a ${enAtencion!.numero} en la pantalla de sala.`);
  };

  /** DEV-58: pausa breve sin cerrar el consultorio. */
  const pausar = (minutos: number) => {
    setEligiendoPausa(false);
    ejecutar('pausando', () => pausarConsultorio(consultorio, minutos), `Consultorio en pausa por ${minutos} minutos. La sala y la secretaría ya lo ven.`);
  };

  const reanudar = () => ejecutar('reanudando', () => reanudarConsultorio(consultorio), 'Atención reanudada. La espera estimada de la sala se recalculó.');

  /** DEV-59: finaliza y deriva al paciente a otro profesional del día. */
  const derivar = async (profesional: string, motivo: string) => {
    if (!enAtencion) return;
    const numero = enAtencion.numero;
    setDerivando(false);
    await ejecutar('derivando', () => derivarAlFinalizar(enAtencion, profesional, motivo), `${numero} quedó en la cola de ${profesional}. La secretaría ve la derivación.`);
  };

  const enfocarFila = (turnoId: string | null) => {
    if (!turnoId) return;
    setFilaActiva(turnoId);
    filas.current.get(turnoId)?.focus();
  };

  // DEV-38: atajos de teclado. Se lee siempre la versión más reciente de las acciones.
  const alPresionar = useRef<(e: KeyboardEvent) => void>(() => {});
  alPresionar.current = (e: KeyboardEvent) => {
    const atajo = atajoDeTecla(e, e.target as HTMLElement | null);
    if (!atajo || pendiente) return;
    e.preventDefault();
    if (atajo === 'ir-a-lista') return enfocarFila(filaConFoco);
    if (atajo === 'llamar-siguiente') {
      if (puedeLlamar) pedirLlamado();
      else if (libre && pausa) setAlerta('El consultorio está en pausa. Toque "Reanudar atención" para volver a llamar.');
      else if (libre) setAlerta('No hay pacientes esperando para llamar.');
      return;
    }
    if (!puedeAtender) {
      if (libre) setAlerta('No hay un paciente en atención.');
      return;
    }
    if (atajo === 'finalizar') finalizar();
    else rellamar();
  };

  useEffect(() => {
    const f = (e: KeyboardEvent) => alPresionar.current(e);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, []);

  /** DEV-38: flechas, Inicio y Fin recorren la tabla; Enter llama al paciente de la fila. */
  const teclaEnFila = (e: KeyboardEventReact<HTMLTableRowElement>, indice: number, paciente: Admision) => {
    if (e.target !== e.currentTarget) return; // Enter sobre el botón "Llamar" lo maneja el botón
    if (e.key === 'Enter') {
      e.preventDefault();
      pedirLlamado(paciente);
      return;
    }
    const nuevo = moverEnLista(e.key, indice, enEspera.length);
    if (nuevo === null) return;
    e.preventDefault();
    enfocarFila(enEspera[nuevo].turnoId);
  };

  return (
    <div className="prof">
      <header className="prof__header">
        <Logo size={40} />
        <span className="prof__header-derecha">
        {sinConexion ? (
          <span className="prof__conexion prof__conexion--off">
            <Icon name="wifi-off" size={24} />
            {textoSinConexion}
          </span>
        ) : (
          <span className="prof__conexion prof__conexion--on">
            <Icon name="wifi" size={24} />
            Conectado
          </span>
        )}
        <MenuUsuario />
        </span>
      </header>

      <main className="prof__main">
        <div className="prof__titulo">
          <div>
            <h1>Consultorio {consultorio}</h1>
            <p>
              {datos.nombre} · {datos.especialidad}
            </p>
          </div>
          <div className="prof__contadores">
            <div className="prof__contador" aria-live="polite">
              <strong>{esperando ?? '—'}</strong>
              <span>pacientes esperando</span>
            </div>
            <div className="prof__contador">
              <strong>{mayorEspera === null ? '—' : <TiempoEspera minutos={mayorEspera} className="prof__mayor" />}</strong>
              <span>mayor espera</span>
            </div>
          </div>
        </div>

        {sinConexion && (
          <div className="prof__aviso" role="alert">
            <Icon name="alert-triangle" size={28} />
            <div>
              <strong>{textoSinConexion}</strong>
              <span>No puede llamar ni finalizar atenciones sin confirmación del servidor.</span>
            </div>
          </div>
        )}

        <div className="prof__grilla">
          <div className="prof__columna">
            <section className="prof__card" aria-live="polite">
              {estado.tipo === 'cargando' && (
                <Mensaje icono={<span className="spinner prof__spinner" aria-hidden="true" />} titulo="Consultando pacientes…">
                  No hay un llamado disponible mientras se actualiza.
                </Mensaje>
              )}
              {estado.tipo === 'error' && (
                <Mensaje icono={<Icon name="x-circle" size={96} className="prof__icono--error" />} titulo="No pudimos consultar el próximo paciente">
                  No se realizó ningún llamado. La consulta se actualizará al recuperar el servicio.
                </Mensaje>
              )}
              {sinConexion && (
                <Mensaje icono={<Icon name="wifi-off" size={96} className="prof__icono--alerta" />} titulo="Esperando conexión">
                  La lista anterior no confirma una nueva atención.
                </Mensaje>
              )}
              {cola && !enAtencion && !proximo && (
                <Mensaje icono={<Icon name="users" size={96} className="prof__icono--info" />} titulo="No hay pacientes esperando">
                  Cuando se registre una llegada, verá al próximo paciente aquí.
                </Mensaje>
              )}
              {cola && (enAtencion || proximo) && (
                <div className="prof__paciente">
                  <div className="prof__paciente-encabezado">
                    <span>{enAtencion ? 'Paciente en atención' : 'Próximo paciente'}</span>
                    <StatusChip estado={enAtencion ? 'llamado' : 'en-espera'} />
                  </div>
                  <span className="prof__numero">{(enAtencion ?? proximo)!.numero}</span>
                  <span className="prof__nombre">{(enAtencion ?? proximo)!.paciente}</span>
                  {(enAtencion ?? proximo)!.prioridad && <MarcaPrioridad motivo={(enAtencion ?? proximo)!.prioridad!.motivo} />}
                  {(enAtencion ?? proximo)!.tipo === 'derivacion' && (
                    <span className="prof__derivado">
                      <Icon name="swap" size={18} /> Derivado por {(enAtencion ?? proximo)!.derivaciones?.slice(-1)[0]?.desde}
                    </span>
                  )}
                  <span className="prof__detalle">
                    {enAtencion ? (
                      <>
                        {llamados === 1 ? 'Llamado 1 vez' : `Llamado ${llamados} veces`} · último llamado a las {hora(enAtencion.llamadoEn ?? ahora)} · esperó{' '}
                        {minutosEntre(enAtencion.registradaEn, new Date(enAtencion.llamadoEn ?? ahora))} min
                      </>
                    ) : (
                      <>
                        Llegada {hora(proximo!.registradaEn)} · {textoTurno(proximo!)} · en espera{' '}
                        <TiempoEspera minutos={minutosEntre(proximo!.registradaEn, ahora)} />
                      </>
                    )}
                  </span>
                </div>
              )}
            </section>

            {pausa && (
              <div className="prof__pausa" role="status">
                <Icon name="pause" size={32} />
                <div>
                  <strong>Consultorio en pausa</strong>
                  <span>
                    {restantePausa > 0 ? `Vuelve en unos ${restantePausa} minutos` : 'Pasó el tiempo estimado'} · desde las {hora(pausa.desde)}. La sala muestra la demora y no se puede
                    llamar.
                  </span>
                </div>
                <Button className="prof__reanudar" icon={<Icon name="play" size={28} />} loading={accion === 'reanudando'} disabled={accion !== null && accion !== 'reanudando'} onClick={reanudar}>
                  Reanudar atención
                </Button>
              </div>
            )}

            {confirmacion && (
              <p className="prof__confirmacion" role="status">
                <Icon name="check-circle" size={24} /> {confirmacion}
              </p>
            )}
            {alerta && (
              <p className="prof__alerta" role="status">
                <Icon name="alert-triangle" size={24} /> {alerta}
              </p>
            )}

            {enAtencion ? (
              <div className="prof__acciones">
                <Button
                  className="prof__accion"
                  icon={<Icon name="check" size={40} />}
                  loading={accion === 'finalizando'}
                  disabled={!puedeAtender && accion !== 'finalizando'}
                  aria-keyshortcuts={ATAJOS.finalizar}
                  onClick={finalizar}
                >
                  {accion === 'finalizando' ? 'Finalizando…' : 'Finalizar atención'}
                  <Tecla>{ATAJOS.finalizar}</Tecla>
                </Button>
                <div className="prof__secundarias">
                  <Button
                    variant="secondary"
                    className="prof__secundaria"
                    icon={<Icon name="repeat" size={28} />}
                    loading={accion === 'rellamando'}
                    disabled={!puedeAtender && accion !== 'rellamando'}
                    aria-keyshortcuts={ATAJOS['volver-a-llamar']}
                    onClick={rellamar}
                  >
                    {accion === 'rellamando' ? 'Llamando…' : 'Llamar nuevamente'}
                    <Tecla>{ATAJOS['volver-a-llamar']}</Tecla>
                  </Button>
                  <Button
                    variant="secondary"
                    className="prof__secundaria"
                    icon={<Icon name="swap" size={28} />}
                    loading={accion === 'derivando'}
                    disabled={(!puedeAtender && accion !== 'derivando') || PROFESIONALES.length < 2}
                    onClick={() => setDerivando(true)}
                  >
                    {accion === 'derivando' ? 'Derivando…' : 'Finalizar y derivar'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="prof__secundaria"
                    icon={<Icon name="user-x" size={28} />}
                    loading={accion === 'ausente'}
                    disabled={!puedeMarcarAusente || (!puedeAtender && accion !== 'ausente')}
                    aria-describedby={puedeMarcarAusente ? undefined : 'prof-ayuda-ausente'}
                    onClick={() => ejecutar('ausente', () => marcarAusente(enAtencion), `${enAtencion.numero} quedó como ausente. La secretaría lo ve en la cola.`)}
                  >
                    {accion === 'ausente' ? 'Registrando…' : 'No se presentó'}
                  </Button>
                  <Button
                    variant="secondary"
                    className="prof__secundaria"
                    icon={<Icon name="megaphone" size={28} />}
                    loading={accion === 'llamando'}
                    disabled={!puedeLlamar && accion !== 'llamando'}
                    aria-keyshortcuts={ATAJOS['llamar-siguiente']}
                    onClick={() => pedirLlamado()}
                  >
                    {accion === 'llamando' ? 'Llamando…' : 'Llamar al siguiente'}
                    <Tecla>{ATAJOS['llamar-siguiente']}</Tecla>
                  </Button>
                </div>
                {!puedeMarcarAusente && (
                  <p id="prof-ayuda-ausente" className="prof__ayuda">
                    Si el paciente no se presenta, vuelva a llamarlo. Después de {LLAMADOS_ANTES_DE_AUSENTE} llamados puede marcarlo como ausente.
                  </p>
                )}
              </div>
            ) : (
              <>
              <Button
                className={`prof__accion ${estado.tipo === 'cargando' ? 'prof__accion--consultando' : ''}`}
                icon={<Icon name="megaphone" size={40} />}
                loading={estado.tipo === 'cargando' || accion === 'llamando'}
                disabled={!puedeLlamar}
                aria-keyshortcuts={ATAJOS['llamar-siguiente']}
                onClick={() => pedirLlamado()}
              >
                {estado.tipo === 'cargando' ? 'Consultando…' : accion === 'llamando' ? 'Llamando…' : 'Llamar al siguiente'}
                {estado.tipo !== 'cargando' && accion !== 'llamando' && <Tecla>{ATAJOS['llamar-siguiente']}</Tecla>}
              </Button>
              {!pausa && (
                <Button
                  variant="secondary"
                  className="prof__secundaria"
                  icon={<Icon name="pause" size={28} />}
                  loading={accion === 'pausando'}
                  disabled={!libre && accion !== 'pausando'}
                  onClick={() => setEligiendoPausa(true)}
                >
                  {accion === 'pausando' ? 'Pausando…' : 'Pausa'}
                </Button>
              )}
              </>
            )}
          </div>

          {/* #42: tabla de pacientes en espera para elegir a quién llamar */}
          <section className="prof__lista" aria-labelledby="prof-lista-titulo">
            <div className="prof__lista-encabezado">
              <h2 id="prof-lista-titulo">Pacientes en espera</h2>
              <span>{cola ? `${enEspera.length} en espera · se actualiza solo` : 'Actualización pendiente'}</span>
            </div>
            {cola && enEspera.length > 0 ? (
              <table className="prof__tabla" aria-describedby="prof-ayuda-tabla">
                <thead>
                  <tr>
                    <th scope="col">Número</th>
                    <th scope="col">Paciente</th>
                    <th scope="col">Turno</th>
                    <th scope="col">Llegada</th>
                    <th scope="col">En espera</th>
                    <th scope="col">
                      <span className="visually-hidden">Acción</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {enEspera.map((a, i) => (
                    <tr
                      key={a.turnoId}
                      ref={(el) => {
                        if (el) filas.current.set(a.turnoId, el);
                        else filas.current.delete(a.turnoId);
                      }}
                      className={`prof__fila ${i === 0 ? 'prof__fila--proxima' : ''}`}
                      tabIndex={a.turnoId === filaConFoco ? 0 : -1}
                      aria-label={`${a.numero}, ${a.paciente}${a.prioridad ? ', con prioridad' : ''}${i === 0 ? ', próximo paciente' : ''}`}
                      onFocus={(e) => e.target === e.currentTarget && setFilaActiva(a.turnoId)}
                      onKeyDown={(e) => teclaEnFila(e, i, a)}
                    >
                      <td data-label="Número" className="prof__tabla-numero">
                        {a.numero}
                      </td>
                      <td data-label="Paciente" className="prof__tabla-paciente">
                        {a.paciente}
                        {a.prioridad && (
                          <>
                            {' '}
                            <MarcaPrioridad motivo={a.prioridad.motivo} conMotivo={false} />
                          </>
                        )}
                      </td>
                      <td data-label="Turno">{a.tipo === 'demanda' || a.tipo === 'contraturno' ? textoTurno(a) : hora(a.horaTurno)}</td>
                      <td data-label="Llegada">{hora(a.registradaEn)}</td>
                      <td data-label="En espera">
                        <TiempoEspera minutos={minutosEntre(a.registradaEn, ahora)} />
                      </td>
                      <td className="prof__tabla-accion">
                        <Button
                          variant={i === 0 ? 'primary' : 'secondary'}
                          className="prof__llamar"
                          icon={<Icon name="megaphone" size={20} />}
                          disabled={!puedeLlamar}
                          aria-label={`Llamar a ${a.numero}, ${a.paciente}`}
                          onClick={() => pedirLlamado(a)}
                        >
                          Llamar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="prof__lista-vacia">{cola ? 'No hay pacientes esperando.' : sinConexion ? 'La lista se mostrará al recuperar la conexión.' : 'Consultando pacientes…'}</p>
            )}
            <p id="prof-ayuda-tabla" className="visually-hidden">
              Use las flechas para recorrer la lista y Enter para llamar al paciente.
            </p>
          </section>
        </div>

        {/* DEV-57: turnos del día, también los que todavía no llegaron. Sin datos de salud. */}
        <section className="prof__lista prof__turnos" aria-labelledby="prof-turnos-titulo">
          <div className="prof__lista-encabezado">
            <h2 id="prof-turnos-titulo">Turnos de hoy</h2>
            <span aria-live="polite">
              {turnosDia.length === 0
                ? 'Sin turnos para hoy'
                : `${turnosDia.length} turnos · faltan llegar ${pendientesDeLlegar} · por atender ${porAtender} · se actualiza solo`}
            </span>
          </div>
          {turnosDia.length > 0 ? (
            <table className="prof__tabla">
              <thead>
                <tr>
                  <th scope="col">Hora</th>
                  <th scope="col">Número</th>
                  <th scope="col">Paciente</th>
                  <th scope="col">Estado</th>
                </tr>
              </thead>
              <tbody>
                {turnosDia.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Hora">{hora(t.horario)}</td>
                    <td data-label="Número" className="prof__tabla-numero">
                      {t.numero ?? '—'}
                    </td>
                    <td data-label="Paciente">{t.paciente}</td>
                    <td data-label="Estado">
                      <EstadoTurno estado={t.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="prof__lista-vacia">{cola ? 'No hay turnos asignados para hoy.' : 'Consultando turnos…'}</p>
          )}
        </section>

        {/* DEV-38: atajos visibles en pantalla */}
        <section className="prof__atajos" aria-label="Atajos de teclado">
          <span className="prof__atajos-titulo">
            <Icon name="info" size={20} /> Teclado
          </span>
          <span>
            <Tecla>{ATAJOS['llamar-siguiente']}</Tecla> Llamar al siguiente
          </span>
          <span>
            <Tecla>{ATAJOS['volver-a-llamar']}</Tecla> Llamar nuevamente
          </span>
          <span>
            <Tecla>{ATAJOS.finalizar}</Tecla> Finalizar atención
          </span>
          <span>
            <Tecla>{ATAJOS['ir-a-lista']}</Tecla> Ir a la lista
          </span>
          <span>
            <Tecla>↑</Tecla>
            <Tecla>↓</Tecla> Elegir paciente · <Tecla>Enter</Tecla> Llamar
          </span>
          <span className="prof__atajos-nota">No funcionan mientras se escribe en un campo.</span>
        </section>

        <footer className="prof__footer">
          <span>{usuario?.centro}</span>
          <span>{sinConexion ? 'Datos no actualizados' : `${fechaLarga(ahora)} · ${hora(ahora)}`}</span>
        </footer>
      </main>

      {pendiente && (
        <ConfirmarLlamado pendiente={pendiente} onCancelar={() => setPendiente(null)} onConfirmar={() => llamar(pendiente)} />
      )}
      {eligiendoPausa && <ElegirPausa onCancelar={() => setEligiendoPausa(false)} onElegir={pausar} />}
      {derivando && enAtencion && (
        <DerivarPaciente admision={enAtencion} actual={datos.nombre} especialidad={datos.especialidad} onCancelar={() => setDerivando(false)} onConfirmar={derivar} />
      )}
    </div>
  );
}

/** Horario del turno para la tabla. Demanda espontánea y contraturno no tienen horario del proveedor. */
function textoTurno(a: Admision) {
  if (a.tipo === 'demanda') return 'Sin turno';
  if (a.tipo === 'contraturno') return 'Contraturno';
  if (a.tipo === 'derivacion') return 'Derivado';
  return `turno ${hora(a.horaTurno)}`;
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="tecla" aria-hidden="true">
      {children}
    </kbd>
  );
}

type ConfirmarProps = { pendiente: Pendiente; onCancelar: () => void; onConfirmar: () => void };

/** #42: la misma confirmación con mouse o con teclado (DEV-38). */
function ConfirmarLlamado({ pendiente, onCancelar, onConfirmar }: ConfirmarProps) {
  const { objetivo, enAtencion, saltados } = pendiente;
  const fueraDeOrden = saltados.length > 0;
  return (
    <Modal
      titulo={enAtencion ? 'Finalizar la atención actual' : 'Llamar fuera de orden'}
      subtitulo={`${objetivo.numero} · ${objetivo.paciente}`}
      onCerrar={onCancelar}
    >
      {enAtencion && (
        <p className="prof__modal-texto">
          <strong>{enAtencion.numero} · {enAtencion.paciente}</strong> sigue en atención. Para llamar a {objetivo.numero} primero se finaliza esa atención.
        </p>
      )}
      {fueraDeOrden && (
        <p className="prof__modal-texto">
          {objetivo.numero} no es el próximo de la cola: antes {saltados.length === 1 ? 'está' : 'están'} {saltados.map((a) => a.numero).join(', ')}. El llamado
          fuera de orden queda registrado (quién, cuándo y a qué paciente).
        </p>
      )}
      <div className="modal__acciones">
        <Button variant="secondary" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button onClick={onConfirmar}>{enAtencion ? `Finalizar y llamar a ${objetivo.numero}` : `Llamar a ${objetivo.numero}`}</Button>
      </div>
    </Modal>
  );
}

function Mensaje({ icono, titulo, children }: { icono: ReactNode; titulo: string; children: ReactNode }) {
  return (
    <div className="prof__mensaje">
      {icono}
      <h2>{titulo}</h2>
      <p>{children}</p>
    </div>
  );
}

const ETIQUETA_TURNO: Record<EstadoTurnoDia, string> = {
  pendiente: 'Pendiente de llegada',
  'en-espera': 'Llegó · en espera',
  'en-atencion': 'En atención',
  atendido: 'Atendido',
  ausente: 'Ausente',
  'se-retiro': 'Se retiró',
  derivado: 'Derivado a otro profesional',
};

const ICONO_TURNO: Record<EstadoTurnoDia, 'clock' | 'megaphone' | 'check-circle' | 'user-x' | 'log-out' | 'swap' | 'calendar-check'> = {
  pendiente: 'calendar-check',
  'en-espera': 'clock',
  'en-atencion': 'megaphone',
  atendido: 'check-circle',
  ausente: 'user-x',
  'se-retiro': 'log-out',
  derivado: 'swap',
};

/** DEV-57: estado del turno con ícono y texto. */
function EstadoTurno({ estado }: { estado: EstadoTurnoDia }) {
  return (
    <span className={`estado-turno estado-turno--${estado}`}>
      <Icon name={ICONO_TURNO[estado]} size={16} />
      {ETIQUETA_TURNO[estado]}
    </span>
  );
}

/** DEV-58: duración estimada de la pausa. */
function ElegirPausa({ onCancelar, onElegir }: { onCancelar: () => void; onElegir: (minutos: number) => void }) {
  return (
    <Modal titulo="Pausa breve" subtitulo="El consultorio no se cierra. La sala muestra la demora y no se puede llamar hasta reanudar." onCerrar={onCancelar}>
      <div className="prof__pausas" role="group" aria-label="Duración estimada">
        {MINUTOS_DE_PAUSA.map((m) => (
          <Button key={m} variant="secondary" className="prof__secundaria" onClick={() => onElegir(m)}>
            {m} minutos
          </Button>
        ))}
      </div>
      <div className="modal__acciones">
        <Button variant="secondary" onClick={onCancelar}>
          Cancelar
        </Button>
      </div>
    </Modal>
  );
}

const MOTIVOS_DERIVAR = ['Requiere otra especialidad', 'Interconsulta', 'Control con otro profesional', 'Otro'];

type DerivarProps = {
  admision: Admision;
  actual: string;
  especialidad: string;
  onCancelar: () => void;
  onConfirmar: (profesional: string, motivo: string) => void;
};

/** DEV-59: el profesional elige a quién derivar. El paciente pasa directo a esa cola. */
function DerivarPaciente({ admision, actual, especialidad, onCancelar, onConfirmar }: DerivarProps) {
  // Primero los de otra especialidad: es el caso más común.
  const opciones = PROFESIONALES.filter((p) => p.nombre !== actual).sort((a, b) => Number(a.especialidad === especialidad) - Number(b.especialidad === especialidad));
  const [profesional, setProfesional] = useState(opciones[0]?.nombre ?? '');
  const [motivo, setMotivo] = useState(MOTIVOS_DERIVAR[0]);
  const [detalle, setDetalle] = useState('');
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    if (!profesional) return setError('Elija el profesional de destino.');
    if (motivo === 'Otro' && !detalle.trim()) return setError('Escriba el motivo de la derivación.');
    onConfirmar(profesional, motivo === 'Otro' ? detalle.trim() : motivo);
  };

  return (
    <Modal titulo="Finalizar y derivar" subtitulo={`${admision.numero} · ${admision.paciente}`} onCerrar={onCancelar}>
      <p className="prof__modal-texto">Se finaliza esta atención y el paciente pasa directo a la cola del profesional elegido, sin volver a secretaría. Conserva su número.</p>
      <div className="campo">
        <label htmlFor="prof-derivar-a">Derivar a</label>
        <select id="prof-derivar-a" className="select" value={profesional} onChange={(e) => setProfesional(e.target.value)}>
          {opciones.map((p) => (
            <option key={p.nombre} value={p.nombre}>
              {p.especialidad} · {p.nombre} · Consultorio {p.consultorio}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="prof-derivar-motivo">Motivo</label>
        <select id="prof-derivar-motivo" className="select" value={motivo} onChange={(e) => setMotivo(e.target.value)}>
          {MOTIVOS_DERIVAR.map((m) => (
            <option key={m}>{m}</option>
          ))}
        </select>
      </div>
      {motivo === 'Otro' && (
        <div className="campo">
          <label htmlFor="prof-derivar-detalle">Detalle (sin datos de salud)</label>
          <input id="prof-derivar-detalle" className="input" maxLength={80} value={detalle} onChange={(e) => setDetalle(e.target.value)} />
        </div>
      )}
      {error && (
        <p className="campo__error" role="alert">
          {error}
        </p>
      )}
      <p className="modal__nota">La derivación queda registrada: quién, cuándo, desde y hacia qué profesional.</p>
      <div className="modal__acciones">
        <Button variant="secondary" onClick={onCancelar}>
          Cancelar
        </Button>
        <Button onClick={confirmar}>Finalizar y derivar</Button>
      </div>
    </Modal>
  );
}
