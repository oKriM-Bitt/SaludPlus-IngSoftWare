import { useCallback, useEffect, useRef, useState, type KeyboardEvent as KeyboardEventReact, type ReactNode } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { StatusChip } from '../../componentes/StatusChip';
import { MenuUsuario } from '../../componentes/MenuUsuario';
import { TiempoEspera } from '../../componentes/TiempoEspera';
import { useUsuario } from '../../servicios/sesion';
import { profesionalesDelDia } from '../../servicios/configuracion';
import { ubicacionActual } from '../../utilidades/rutas';
import {
  escucharCambios,
  finalizarAtencion,
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

type Accion = 'llamando' | 'rellamando' | 'finalizando' | 'ausente';

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
      : new URLSearchParams(ubicacionActual().search).get('consultorio') ?? profesionalesDelDia(usuario?.sucursal ?? 'villa-norte')[0]?.consultorio ?? '';
  const datos = profesionalPorConsultorio(consultorio);

  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [accion, setAccion] = useState<Accion | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
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
    } catch (e) {
      setEstado(e instanceof SinConexionError ? { tipo: 'sin-conexion' } : { tipo: 'error' });
    }
  }, [consultorio]);

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
      else if (e instanceof PacienteEnAtencionError) setAlerta(`${e.enAtencion.numero} sigue en atención. Finalícela antes de llamar a otro paciente.`);
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
  const puedeLlamar = libre && enEspera.length > 0;
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
                      aria-label={`${a.numero}, ${a.paciente}${i === 0 ? ', próximo paciente' : ''}`}
                      onFocus={(e) => e.target === e.currentTarget && setFilaActiva(a.turnoId)}
                      onKeyDown={(e) => teclaEnFila(e, i, a)}
                    >
                      <td data-label="Número" className="prof__tabla-numero">
                        {a.numero}
                      </td>
                      <td data-label="Paciente" className="prof__tabla-paciente">
                        {a.paciente}
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
    </div>
  );
}

/** Horario del turno para la tabla. Demanda espontánea y contraturno no tienen horario del proveedor. */
function textoTurno(a: Admision) {
  if (a.tipo === 'demanda') return 'Sin turno';
  if (a.tipo === 'contraturno') return 'Contraturno';
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
