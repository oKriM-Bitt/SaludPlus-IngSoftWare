import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { StatusChip } from '../../componentes/StatusChip';
import { MenuUsuario } from '../../componentes/MenuUsuario';
import { TiempoEspera } from '../../componentes/TiempoEspera';
import { MarcaPrioridad } from '../../componentes/MarcaPrioridad';
import { useConfirmar } from '../../componentes/Confirmar';
import { EstadoDatos } from '../../componentes/EstadoDatos';
import { useUsuario } from '../../servicios/sesion';
import {
  ausenteEnBox,
  boxDe,
  colaDeBox,
  elegirBox,
  escucharCambios,
  finalizarBox,
  hayConexion,
  llamarAlBox,
  LLAMADOS_ANTES_DE_AUSENTE,
  opcionesDeBox,
  pacienteEnBox,
  PacienteEnAtencionError,
  PacienteNoDisponibleError,
  SinConexionError,
  volverALlamarBox,
  type Admision,
} from '../../servicios/turnos';
import { ATAJOS, atajoDeTecla } from '../../servicios/llamados';
import { fechaLarga, hora, minutosEntre } from '../../utilidades/fechas';
import '../profesional/profesional.css';
import './box.css';

const ACTUALIZAR_CADA_MS = 5_000;

type Accion = 'llamando' | 'rellamando' | 'finalizando' | 'ausente' | 'eligiendo';

/**
 * Llamado a box (devolución del 11/11): la secretaria que atiende en un box de admisión llama a
 * los pacientes que esperan, igual que el profesional desde su consultorio. La sala anuncia el
 * número y el box con aviso visual, sonoro y por voz.
 */
export function BoxPage() {
  const usuario = useUsuario();
  const yo = usuario?.usuario ?? 'sin-usuario';
  const { confirmar, dialogo } = useConfirmar();
  const [, setVersion] = useState(0);
  const [ahora, setAhora] = useState(new Date());
  const [actualizadoEn, setActualizadoEn] = useState<Date | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
  const [alerta, setAlerta] = useState<string | null>(null);

  // Los datos del box viven en el navegador (y en el registro compartido de boxes): se leen en cada dibujo.
  const refrescar = useCallback(() => {
    const momento = new Date();
    setAhora(momento);
    if (hayConexion()) setActualizadoEn(momento);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    refrescar();
    const intervalo = window.setInterval(refrescar, ACTUALIZAR_CADA_MS);
    const dejarDeEscuchar = escucharCambios(refrescar);
    window.addEventListener('online', refrescar);
    window.addEventListener('offline', refrescar);
    return () => {
      window.clearInterval(intervalo);
      dejarDeEscuchar();
      window.removeEventListener('online', refrescar);
      window.removeEventListener('offline', refrescar);
    };
  }, [refrescar]);

  // Los avisos de la última acción desaparecen solos.
  useEffect(() => {
    if (!confirmacion && !alerta) return;
    const t = window.setTimeout(() => {
      setConfirmacion(null);
      setAlerta(null);
    }, 6_000);
    return () => window.clearTimeout(t);
  }, [confirmacion, alerta]);

  const sinConexion = !hayConexion();
  const miBox = boxDe(yo);
  const enBox = miBox ? pacienteEnBox(miBox) : null;
  const cola = colaDeBox();
  const proximo = cola[0] ?? null;
  const opciones = opcionesDeBox(yo);
  const mayorEspera = cola.length > 0 ? Math.max(...cola.map((a) => minutosEntre(a.registradaEn, ahora))) : null;
  const llamados = enBox?.box?.llamados ?? 1;
  const puedeMarcarAusente = llamados >= LLAMADOS_ANTES_DE_AUSENTE;
  const libre = !!miBox && accion === null && !sinConexion;
  const puedeLlamar = libre && cola.length > 0;
  const puedeAtender = libre && !!enBox;

  const ejecutar = async (tipo: Accion, operacion: () => Promise<unknown>, aviso: string) => {
    setAccion(tipo);
    setConfirmacion(null);
    setAlerta(null);
    try {
      await operacion();
      setConfirmacion(aviso);
    } catch (e) {
      if (e instanceof PacienteNoDisponibleError) setAlerta('Ese paciente ya no está esperando. La lista se actualizó.');
      else if (e instanceof PacienteEnAtencionError) setAlerta(`${e.enAtencion.numero} sigue en el box. Finalice su atención antes de llamar a otro paciente.`);
      else if (e instanceof SinConexionError) setAlerta('Sin conexión: la acción no se completó. Vuelva a intentarlo cuando vuelva la conexión.');
      else if (e instanceof Error && e.name === 'OperacionNoPermitidaError') setAlerta(e.message);
      else setAlerta('No se pudo completar la acción. Vuelva a intentarlo.');
    } finally {
      setAccion(null);
      refrescar();
    }
  };

  const elegir = (numero: string | null) =>
    ejecutar('eligiendo', () => elegirBox(yo, numero), numero ? `Ahora atiende en el box ${numero}. La sala anuncia sus llamados.` : 'Dejó el box libre para otra persona.');

  /** Llama al paciente elegido o, sin elegir, al próximo. Si hay alguien en el box, primero se termina su atención. */
  const llamar = async (elegido?: Admision) => {
    if (!miBox || !puedeLlamar) return;
    const objetivo = elegido ?? proximo!;
    if (enBox) {
      const acepta = await confirmar({
        titulo: `¿Terminar con ${enBox.numero} y llamar a ${objetivo.numero}?`,
        mensaje: `${enBox.numero} sigue en el box. Para llamar a otro paciente, primero se termina su atención.`,
        aceptar: `Terminar y llamar a ${objetivo.numero}`,
      });
      if (!acepta) return;
      return ejecutar(
        'llamando',
        async () => {
          await finalizarBox(enBox);
          await llamarAlBox(miBox, objetivo.turnoId);
        },
        `${objetivo.numero} llamado al box ${miBox}. La sala muestra el número y el box.`,
      );
    }
    ejecutar('llamando', () => llamarAlBox(miBox, objetivo.turnoId), `${objetivo.numero} llamado al box ${miBox}. La sala muestra el número y el box.`);
  };

  const finalizar = () => {
    if (!enBox || !puedeAtender) return;
    ejecutar('finalizando', () => finalizarBox(enBox), `${enBox.numero} terminó en el box. ${enBox.profesional ? `Queda en espera de ${enBox.profesional}.` : 'Queda en espera: asígnele un profesional desde Admisión.'}`);
  };

  const rellamar = () => {
    if (!enBox || !puedeAtender) return;
    ejecutar('rellamando', () => volverALlamarBox(enBox), `Se volvió a llamar a ${enBox.numero} al box ${miBox}.`);
  };

  const ausente = async () => {
    if (!enBox || !puedeAtender || !puedeMarcarAusente) return;
    const acepta = await confirmar({
      titulo: `¿Marcar a ${enBox.numero} como ausente?`,
      mensaje: 'Deja de estar en la cola del box y queda como ausente.',
      aceptar: 'Marcar como ausente',
      peligro: true,
    });
    if (acepta) ejecutar('ausente', () => ausenteEnBox(enBox), `${enBox.numero} quedó como ausente.`);
  };

  // Los mismos atajos que en el consultorio: N llama, R vuelve a llamar, F finaliza.
  const alPresionar = useRef<(e: KeyboardEvent) => void>(() => {});
  alPresionar.current = (e: KeyboardEvent) => {
    const atajo = atajoDeTecla(e, e.target as HTMLElement | null);
    if (!atajo || atajo === 'ir-a-lista' || !miBox || document.querySelector('[aria-modal="true"]')) return;
    e.preventDefault();
    if (atajo === 'llamar-siguiente') {
      if (puedeLlamar) llamar();
      else if (libre) setAlerta('No hay pacientes esperando para el box.');
      return;
    }
    if (!puedeAtender) {
      if (libre) setAlerta('No hay un paciente en el box.');
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

  const paciente = enBox ?? proximo;

  return (
    <div className="prof box">
      <header className="prof__header">
        <Logo size={40} />
        <span className="prof__header-derecha">
          <EstadoDatos sinConexion={sinConexion} actualizadoEn={actualizadoEn} />
          <MenuUsuario />
        </span>
      </header>

      <main className="prof__main">
        <div className="prof__titulo">
          <div>
            <h1>{miBox ? `Box ${miBox}` : 'Llamado a box'}</h1>
            <p>Admisión · {usuario?.centro}</p>
          </div>
          <div className="prof__contadores">
            <div className="prof__contador" aria-live="polite">
              <strong>{cola.length}</strong>
              <span>esperan el box</span>
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
              <strong>{actualizadoEn ? `Sin conexión – última actualización ${hora(actualizadoEn)}` : 'Sin conexión'}</strong>
              <span>No se puede llamar al box hasta que vuelva la conexión.</span>
            </div>
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

        {!miBox ? (
          <section className="prof__card box__elegir" aria-labelledby="box-elegir-titulo">
            <h2 id="box-elegir-titulo">¿En qué box atiende hoy?</h2>
            <p>Cada box lo usa una sola persona por vez. Los ocupados muestran quién está atendiendo.</p>
            {opciones.length === 0 ? (
              <p className="prof__lista-vacia">Esta sucursal no tiene boxes de admisión. Dirección los agrega en Administración.</p>
            ) : (
              <div className="box__opciones">
                {opciones.map((o) => (
                  <button key={o.id} type="button" className="box__opcion" disabled={!!o.ocupadoPor || accion !== null || sinConexion} onClick={() => elegir(o.numero)}>
                    <Icon name="inbox" size={32} />
                    <strong>Box {o.numero}</strong>
                    <span className={o.ocupadoPor ? 'box__ocupado' : 'box__libre'}>{o.ocupadoPor ? `Ocupado · ${o.ocupadoPor}` : 'Libre'}</span>
                  </button>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="prof__grilla">
            <div className="prof__columna">
              <section className="prof__card" aria-live="polite">
                {!paciente ? (
                  <div className="prof__mensaje">
                    <Icon name="users" size={96} className="prof__icono--info" />
                    <h2>No hay pacientes esperando el box</h2>
                    <p>Cuando alguien registre su llegada, aparece aquí para llamarlo.</p>
                  </div>
                ) : (
                  <div className="prof__paciente">
                    <div className="prof__paciente-encabezado">
                      <span>{enBox ? 'Paciente en el box' : 'Próximo paciente'}</span>
                      <StatusChip estado={enBox ? 'llamado' : 'en-espera'} />
                    </div>
                    <span className="prof__numero">{paciente.numero}</span>
                    <span className="prof__nombre">{paciente.paciente}</span>
                    {paciente.prioridad && <MarcaPrioridad motivo={paciente.prioridad.motivo} />}
                    <span className="prof__detalle">
                      {enBox ? (
                        <>
                          {llamados === 1 ? 'Llamado 1 vez' : `Llamado ${llamados} veces`} · último llamado a las {hora(enBox.box?.llamadoEn ?? ahora)} · después pasa con{' '}
                          {destino(enBox)}
                        </>
                      ) : (
                        <>
                          Llegada {hora(proximo!.registradaEn)} · {textoTurno(proximo!)} · en espera <TiempoEspera minutos={minutosEntre(proximo!.registradaEn, ahora)} />
                        </>
                      )}
                    </span>
                  </div>
                )}
              </section>

              {enBox ? (
                <div className="prof__acciones">
                  <Button
                    className="prof__accion"
                    icon={<Icon name="check" size={40} />}
                    loading={accion === 'finalizando'}
                    disabled={!puedeAtender && accion !== 'finalizando'}
                    aria-keyshortcuts={ATAJOS.finalizar}
                    onClick={finalizar}
                  >
                    {accion === 'finalizando' ? 'Finalizando…' : 'Finalizar en el box'}
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
                      aria-describedby={puedeMarcarAusente ? undefined : 'box-ayuda-ausente'}
                      onClick={ausente}
                    >
                      {accion === 'ausente' ? 'Registrando…' : 'No se presentó'}
                    </Button>
                    <Button
                      variant="secondary"
                      className="prof__secundaria box__siguiente"
                      icon={<Icon name="megaphone" size={28} />}
                      loading={accion === 'llamando'}
                      disabled={!puedeLlamar && accion !== 'llamando'}
                      aria-keyshortcuts={ATAJOS['llamar-siguiente']}
                      onClick={() => llamar()}
                    >
                      {accion === 'llamando' ? 'Llamando…' : 'Llamar al siguiente'}
                      <Tecla>{ATAJOS['llamar-siguiente']}</Tecla>
                    </Button>
                  </div>
                  {!puedeMarcarAusente && (
                    <p id="box-ayuda-ausente" className="prof__ayuda">
                      Si el paciente no se presenta, vuelva a llamarlo. Después de {LLAMADOS_ANTES_DE_AUSENTE} llamados puede marcarlo como ausente.
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <Button
                    className="prof__accion"
                    icon={<Icon name="megaphone" size={40} />}
                    loading={accion === 'llamando'}
                    disabled={!puedeLlamar}
                    aria-keyshortcuts={ATAJOS['llamar-siguiente']}
                    onClick={() => llamar()}
                  >
                    {accion === 'llamando' ? 'Llamando…' : 'Llamar al siguiente'}
                    {accion !== 'llamando' && <Tecla>{ATAJOS['llamar-siguiente']}</Tecla>}
                  </Button>
                  <Button
                    variant="secondary"
                    className="prof__secundaria"
                    icon={<Icon name="log-out" size={28} />}
                    loading={accion === 'eligiendo'}
                    disabled={!libre && accion !== 'eligiendo'}
                    onClick={() => elegir(null)}
                  >
                    Dejar el box
                  </Button>
                </>
              )}
            </div>

            <section className="prof__lista" aria-labelledby="box-lista-titulo">
              <div className="prof__lista-encabezado">
                <h2 id="box-lista-titulo">Esperan el box</h2>
                <span>{cola.length === 0 ? 'Nadie esperando' : `${cola.length} en espera · primero los de prioridad · se actualiza solo`}</span>
              </div>
              {cola.length > 0 ? (
                <table className="prof__tabla">
                  <thead>
                    <tr>
                      <th scope="col">Número</th>
                      <th scope="col">Paciente</th>
                      <th scope="col">Turno</th>
                      <th scope="col">Después pasa con</th>
                      <th scope="col">En espera</th>
                      <th scope="col">
                        <span className="visually-hidden">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {cola.map((a, i) => (
                      <tr key={a.turnoId} className={`prof__fila ${i === 0 ? 'prof__fila--proxima' : ''}`}>
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
                        <td data-label="Turno">{textoTurno(a)}</td>
                        <td data-label="Después pasa con">{destino(a)}</td>
                        <td data-label="En espera">
                          <TiempoEspera minutos={minutosEntre(a.registradaEn, ahora)} />
                        </td>
                        <td className="prof__tabla-accion">
                          <Button
                            variant={i === 0 ? 'primary' : 'secondary'}
                            className="prof__llamar"
                            icon={<Icon name="megaphone" size={20} />}
                            disabled={!puedeLlamar}
                            aria-label={`Llamar a ${a.numero}, ${a.paciente}, al box ${miBox}`}
                            onClick={() => llamar(a)}
                          >
                            Llamar
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="prof__lista-vacia">No hay pacientes esperando el box.</p>
              )}
            </section>
          </div>
        )}

        {miBox && (
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
              <Tecla>{ATAJOS.finalizar}</Tecla> Finalizar en el box
            </span>
            <span className="prof__atajos-nota">No funcionan mientras se escribe en un campo.</span>
          </section>
        )}

        <footer className="prof__footer">
          <span>{usuario?.centro}</span>
          <span>{sinConexion ? 'Datos no actualizados' : `${fechaLarga(ahora)} · ${hora(ahora)}`}</span>
        </footer>
      </main>
      {dialogo}
    </div>
  );
}

/** Horario del turno. La demanda espontánea y el contraturno no tienen horario del proveedor. */
function textoTurno(a: Admision) {
  if (a.tipo === 'demanda') return 'Sin turno';
  if (a.tipo === 'contraturno') return 'Contraturno';
  return hora(a.horaTurno);
}

/** A quién ve el paciente después del box. */
function destino(a: Admision) {
  return a.profesional || (a.servicio ? `${a.servicio} (a asignar)` : 'Profesional a asignar');
}

function Tecla({ children }: { children: ReactNode }) {
  return (
    <kbd className="tecla" aria-hidden="true">
      {children}
    </kbd>
  );
}
