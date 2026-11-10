import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { StatusChip, type EstadoTurno } from '../../componentes/StatusChip';
import { MenuUsuario } from '../../componentes/MenuUsuario';
import { TiempoEspera } from '../../componentes/TiempoEspera';
import { MarcaPrioridad } from '../../componentes/MarcaPrioridad';
import { useConfirmar } from '../../componentes/Confirmar';
import { EstadoDatos } from '../../componentes/EstadoDatos';
import {
  anularLlegada,
  asignarProfesional,
  ausenteEnBox,
  boxDe,
  boxesDeSucursal,
  colaDeBox,
  elegirBox,
  finalizarBox,
  LLAMADOS_ANTES_DE_AUSENTE,
  llamarAlBox,
  marcarPrioridad,
  minutosRestantesPausa,
  opcionesDeBox,
  PacienteEnAtencionError,
  PacienteNoDisponibleError,
  pacienteEnBox,
  pausasDeHoy,
  volverALlamarBox,
  buscarTurno,
  calcularDemoras,
  derivarPaciente,
  derivarTodos,
  diaCerrado,
  DiaCerradoError,
  elegirTurno,
  escucharCambios,
  especialidadDe,
  estadosProfesionales,
  hayConexion,
  marcarEstadoProfesional,
  marcarSeRetiro,
  obtenerColaCentro,
  PROFESIONALES,
  RegistroError,
  registrarContraturno,
  registrarDemandaEspontanea,
  registrarLlegada,
  reincorporarPaciente,
  SinConexionError,
  sinProfesional,
  turnosHoyDe,
  type Admision,
  type ColaCentro,
  type EstadoProfesional,
  type Profesional,
  type ResultadoBusqueda,
  type Turno,
} from '../../servicios/turnos';
import { useUsuario } from '../../servicios/sesion';
import { avisosVigentes, publicarAviso, quitarAviso, type AvisoSala } from '../../servicios/avisos';
import { coincideBusqueda, partesResaltadas } from '../../servicios/busqueda';
import { TOLERANCIA_MINUTOS } from '../../servicios/tolerancia';
import { fechaLarga, hora, minutosEntre } from '../../utilidades/fechas';
import { ModalAsignar, ModalContraturno, ModalDemanda } from './Modales';
import { ModalAnular, ModalDerivar, ModalEstadoProfesional, ModalSeRetiro } from './ModalesOperacion';
import { ModalAvisoSala, ModalPrioridad } from './ModalesSala';
import './secretaria.css';

const ACTUALIZAR_CADA_MS = 5_000;
const MIN_DIGITOS = 7;

type Carga = 'cargando' | 'ok' | 'error' | 'sin-conexion';
type Opcion = { etiqueta: string; accion: () => void };
type Aviso = { tono: 'success' | 'info' | 'warning' | 'error'; titulo: string; texto?: string; contraturnoPara?: Admision; opciones?: Opcion[] };
type ModalAbierto =
  | null
  | { tipo: 'contraturno'; admision?: Admision }
  | { tipo: 'demanda' }
  | { tipo: 'asignar'; admision: Admision }
  | { tipo: 'derivar'; admision: Admision } // #58
  | { tipo: 'retiro'; admision: Admision } // #64
  | { tipo: 'anular'; admision: Admision } // #65
  | { tipo: 'estado-profesional'; profesional: Profesional } // #63
  | { tipo: 'prioridad'; admision: Admision } // DEV-49
  | { tipo: 'aviso-sala' }; // DEV-55

/** Valor del filtro de profesional para las demandas espontáneas del tótem todavía sin asignar (DEV-33). */
const SIN_ASIGNAR = '__sin-asignar__';

const ESTADOS: { valor: EstadoTurno | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'en-espera', etiqueta: 'En espera' },
  { valor: 'llamado', etiqueta: 'Llamado' },
  { valor: 'cancelado-tolerancia', etiqueta: 'Cancelado por tolerancia' },
  { valor: 'ausente', etiqueta: 'Ausente' },
  { valor: 'contraturno', etiqueta: 'Contraturno' },
  { valor: 'se-retiro', etiqueta: 'Se retiró' },
];

/** Estado visible de una fila: un contraturno en espera se muestra como "Contraturno". */
function estadoVisible(a: Admision): EstadoTurno {
  if (a.tipo === 'contraturno' && a.estado === 'en-espera') return 'contraturno';
  return a.estado === 'finalizado' ? 'llamado' : a.estado;
}

const ordenEstado: Record<EstadoTurno, number> = {
  'en-espera': 0,
  contraturno: 0,
  llamado: 1,
  'se-retiro': 2,
  'cancelado-tolerancia': 3,
  ausente: 4,
  'no-atendido': 5,
  reprogramado: 5,
};

function ordenarFilas(a: Admision, b: Admision) {
  // DEV-49: dentro del mismo estado, los pacientes con prioridad van primero.
  return ordenEstado[estadoVisible(a)] - ordenEstado[estadoVisible(b)] || Number(!!b.prioridad) - Number(!!a.prioridad) || a.horaTurno.localeCompare(b.horaTurno);
}

/** DEV-54: nombre con lo buscado resaltado. */
function Resaltado({ texto, busqueda }: { texto: string; busqueda: string }) {
  return (
    <span>
      {partesResaltadas(texto, busqueda).map((p, i) => (p.marca ? <mark key={i}>{p.texto}</mark> : p.texto))}
    </span>
  );
}

const esperando = (a: Admision) => a.estado === 'en-espera';

export function SecretariaPage() {
  const usuario = useUsuario();
  const { confirmar, dialogo } = useConfirmar(); // #87
  const [carga, setCarga] = useState<Carga>('cargando');
  const [cola, setCola] = useState<ColaCentro | null>(null);
  const [ahora, setAhora] = useState(new Date());
  const [filtroProfesional, setFiltroProfesional] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoTurno | ''>('');
  const [busqueda, setBusqueda] = useState(''); // DEV-54
  const [accionBox, setAccionBox] = useState<string | null>(null); // DEV-44
  const campoBusqueda = useRef<HTMLInputElement>(null);
  const [documento, setDocumento] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [registrando, setRegistrando] = useState(false);
  const [resultado, setResultado] = useState<Aviso | null>(null);
  const [mensaje, setMensaje] = useState<Aviso | null>(null);
  const [resaltado, setResaltado] = useState<string | null>(null);
  const [modal, setModal] = useState<ModalAbierto>(null);
  const ocupado = useRef(false);

  const actualizar = useCallback(async (mostrarCarga = false) => {
    if (ocupado.current) return;
    if (!hayConexion()) return setCarga('sin-conexion');
    if (mostrarCarga) setCarga('cargando');
    try {
      const nueva = await obtenerColaCentro();
      setCola(nueva);
      setCarga('ok');
    } catch (e) {
      setCarga(e instanceof SinConexionError ? 'sin-conexion' : 'error');
    }
  }, []);

  useEffect(() => {
    actualizar(true);
    const intervalo = window.setInterval(() => {
      setAhora(new Date());
      actualizar();
    }, ACTUALIZAR_CADA_MS);
    const dejar = escucharCambios(() => actualizar());
    const alCambiarRed = () => actualizar();
    window.addEventListener('online', alCambiarRed);
    window.addEventListener('offline', alCambiarRed);
    return () => {
      window.clearInterval(intervalo);
      dejar();
      window.removeEventListener('online', alCambiarRed);
      window.removeEventListener('offline', alCambiarRed);
    };
  }, [actualizar]);

  // Los mensajes de confirmación desaparecen solos.
  useEffect(() => {
    if (!mensaje) return;
    const t = window.setTimeout(() => setMensaje(null), 8_000);
    return () => window.clearTimeout(t);
  }, [mensaje]);

  const registros = cola?.registros ?? [];
  const filas = useMemo(
    () =>
      registros
        .filter((a) => !filtroProfesional || (filtroProfesional === SIN_ASIGNAR ? sinProfesional(a) : a.profesional === filtroProfesional))
        .filter((a) => !filtroEstado || estadoVisible(a) === filtroEstado)
        .filter((a) => coincideBusqueda(a, busqueda)) // DEV-54: se combina con los filtros
        .sort(ordenarFilas),
    [registros, filtroProfesional, filtroEstado, busqueda],
  );
  const buscando = busqueda.trim().length > 0;
  const enEspera = registros.filter(esperando).length;
  const demandasSinAsignar = registros.filter((a) => esperando(a) && sinProfesional(a));
  const canceladasSinContraturno = registros.filter((a) => a.estado === 'cancelado-tolerancia' && !a.contraturnoAsignado);
  const demoras = carga === 'ok' ? calcularDemoras(registros, ahora) : [];
  const estados = carga === 'ok' || cola ? estadosProfesionales() : {};
  const pausas = carga === 'ok' || cola ? pausasDeHoy() : {}; // DEV-58
  const cerrado = diaCerrado();
  // DEV-44: box de admisión de esta secretaria.
  const yo = usuario?.usuario ?? 'sin-usuario';
  const miBox = boxDe(yo);
  const enMiBox = miBox ? pacienteEnBox(miBox) : null;
  const colaBox = carga === 'ok' || cola ? colaDeBox() : [];
  const opcionesBox = opcionesDeBox(yo); // DEV-72: ocupados con el nombre de quien atiende
  // DEV-55: avisos generales vigentes en la sala de esta sucursal.
  const avisosSala: AvisoSala[] = usuario ? avisosVigentes(usuario.sucursal, ahora) : [];

  const operativo = carga === 'ok';
  const puedeRegistrar = operativo && !cerrado;
  const sinConexion = carga === 'sin-conexion';
  const horaDatos = cola ? hora(cola.actualizadoEn) : '—';

  const conBloqueo = async (operacion: () => Promise<void>) => {
    ocupado.current = true;
    try {
      await operacion();
    } finally {
      ocupado.current = false;
      setAhora(new Date());
      await actualizar();
    }
  };

  /** Refleja un cambio en la tabla al instante, sin esperar la próxima consulta. */
  const aplicarLocal = (nuevos: Admision[]) =>
    setCola((c) => {
      if (!c) return c;
      const porId = new Map(c.registros.map((r) => [r.turnoId, r]));
      nuevos.forEach((n) => porId.set(n.turnoId, n));
      return { ...c, registros: [...porId.values()] };
    });

  /** Muestra el resultado de buscar un turno y, si corresponde, registra la llegada. */
  const procesarResultado = async (r: ResultadoBusqueda) => {
    if (r.tipo === 'no-encontrado') {
      setResultado({ tono: 'error', titulo: 'No encontramos un turno para ese número', texto: 'Revise el número. Si el paciente no tiene turno, regístrelo como demanda espontánea.' });
    } else if (r.tipo === 'ya-registrado') {
      setResultado({ tono: 'info', titulo: `La llegada ya estaba registrada · ${r.admision.numero}`, texto: `${r.admision.paciente} · Consultorio ${r.admision.consultorio}` });
      setResaltado(r.admision.numero);
    } else if (r.tipo === 'tolerancia-vencida') {
      aplicarLocal([r.admision]);
      setResultado({
        tono: 'warning',
        titulo: `Turno cancelado por tolerancia · ${r.admision.paciente}`,
        texto: `Pasaron más de ${TOLERANCIA_MINUTOS} minutos del horario (${hora(r.turno.horario)}).`,
        contraturnoPara: r.admision.contraturnoAsignado ? undefined : r.admision,
      });
      setResaltado(r.admision.numero);
    } else if (r.tipo === 'varias-personas') {
      // #54: el número coincide con más de una persona (por ejemplo, el afiliado del grupo familiar).
      setResultado({
        tono: 'info',
        titulo: 'Ese número corresponde a más de una persona',
        texto: 'Confirme con el paciente quién es.',
        opciones: r.personas.map((p) => ({ etiqueta: p.paciente, accion: () => buscarYProcesar(p.documento) })),
      });
    } else if (r.tipo === 'varios-turnos') {
      // #54: la misma persona tiene más de un turno hoy.
      setResultado({
        tono: 'info',
        titulo: `${r.turnos[0].paciente} tiene ${r.turnos.length + r.registrados.length} turnos hoy`,
        texto: r.registrados.length
          ? `Ya registró ${r.registrados.map((a) => a.numero).join(', ')}. ¿Registrar también ${r.turnos.length === 1 ? 'este turno' : 'otro turno'}?`
          : '¿A cuál llegó ahora? Registrar uno no marca como presente al otro.',
        opciones: r.turnos.map((t) => ({ etiqueta: `${hora(t.horario)} · ${t.especialidad} · ${t.profesional}`, accion: () => elegirYProcesar(t) })),
      });
    } else if (r.tipo === 'otra-sucursal') {
      setResultado({ tono: 'warning', titulo: `El turno de ${r.turno.paciente} es en ${r.sucursal}`, texto: `${hora(r.turno.horario)} · ${r.turno.especialidad}. No se registró la llegada en esta sucursal.` });
    } else if (r.tipo === 'muy-temprano') {
      setResultado({
        tono: 'info',
        titulo: `${r.turno.paciente} llegó muy temprano`,
        texto: `Su turno es a las ${hora(r.turno.horario)}. Puede registrar la llegada y que espere en la sala.`,
        opciones: [{ etiqueta: 'Registrar llegada', accion: () => registrarTurno(r.turno) }],
      });
    } else if (r.tipo === 'dia-cerrado') {
      setResultado({ tono: 'warning', titulo: 'El día ya está cerrado', texto: 'No se pueden registrar llegadas después del cierre.' });
    } else if (r.tipo === 'otro-servicio') {
      await registrarTurno(r.turno);
    } else {
      await registrarTurno(r.turno);
    }
  };

  const registrarTurno = async (turno: Turno) => {
    setRegistrando(true);
    setResultado(null);
    await conBloqueo(async () => {
      try {
        const admision = await registrarLlegada(turno);
        aplicarLocal([admision]);
        setResultado({ tono: 'success', titulo: `Llegada registrada · ${admision.numero}`, texto: `${admision.paciente} · ${admision.profesional} · Consultorio ${admision.consultorio}` });
        setResaltado(admision.numero);
        setDocumento('');
      } catch (err) {
        mostrarErrorRegistro(err);
      } finally {
        setRegistrando(false);
      }
    });
  };

  const mostrarErrorRegistro = (err: unknown) => {
    if (err instanceof SinConexionError) setCarga('sin-conexion');
    setResultado({
      tono: 'error',
      titulo: err instanceof DiaCerradoError ? 'El día ya está cerrado' : err instanceof RegistroError ? 'No se pudo registrar la llegada' : 'No se pudo consultar el turno',
      texto: err instanceof DiaCerradoError ? 'No se pueden registrar llegadas después del cierre.' : 'Intente nuevamente. La llegada aún no está confirmada.',
    });
  };

  const buscarYProcesar = async (numero: string) => {
    setRegistrando(true);
    setResultado(null);
    try {
      const r = await buscarTurno(numero);
      setRegistrando(false);
      await procesarResultado(r);
    } catch (err) {
      setRegistrando(false);
      mostrarErrorRegistro(err);
    }
  };

  const elegirYProcesar = async (turno: Turno) => {
    setResultado(null);
    try {
      await procesarResultado(await elegirTurno(turno));
    } catch (err) {
      mostrarErrorRegistro(err);
    }
  };

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    setResultado(null);
    if (!documento) return setErrorCampo('Ingrese el número de documento o de afiliado.');
    if (documento.length < MIN_DIGITOS) return setErrorCampo(`El número debe tener al menos ${MIN_DIGITOS} dígitos, sin puntos.`);
    await buscarYProcesar(documento);
  };

  const confirmarContraturno = async (cancelada: Admision, profesional: string, motivo: string) => {
    await conBloqueo(async () => {
      const nuevo = await registrarContraturno(cancelada, profesional, motivo);
      aplicarLocal([nuevo, { ...cancelada, contraturnoAsignado: nuevo.numero }]);
      setModal(null);
      setResultado(null);
      setResaltado(nuevo.numero);
      setMensaje({ tono: 'success', titulo: `Contraturno registrado · ${nuevo.numero}`, texto: `${nuevo.paciente} · ${nuevo.profesional} · Consultorio ${nuevo.consultorio}` });
    });
  };

  const confirmarDemanda = async (paciente: string, profesional: string) => {
    await conBloqueo(async () => {
      const nuevo = await registrarDemandaEspontanea(paciente, profesional);
      aplicarLocal([nuevo]);
      setModal(null);
      setResaltado(nuevo.numero);
      setMensaje({ tono: 'success', titulo: `Demanda espontánea registrada · ${nuevo.numero}`, texto: `${nuevo.paciente} · ${nuevo.profesional} · Consultorio ${nuevo.consultorio}` });
    });
  };

  const confirmarAsignacion = async (admision: Admision, profesional: string) => {
    await conBloqueo(async () => {
      const asignada = await asignarProfesional(admision, profesional);
      aplicarLocal([asignada]);
      setModal(null);
      setResaltado(asignada.numero);
      setMensaje({ tono: 'success', titulo: `Profesional asignado · ${asignada.numero}`, texto: `${asignada.paciente} · ${asignada.profesional} · Consultorio ${asignada.consultorio}` });
    });
  };

  /** Ejecuta una operación de la cola, muestra el resultado y cierra la ventana. */
  const operar = async (operacion: () => Promise<Admision | void>, aviso: (a: Admision | void) => Aviso) => {
    await conBloqueo(async () => {
      const r = await operacion();
      if (r) aplicarLocal([r]);
      setModal(null);
      if (r) setResaltado(r.numero);
      setMensaje(aviso(r));
    });
  };

  const guardarEstadoProfesional = async (p: Profesional, estado: EstadoProfesional['estado'] | null, minutos: number | undefined, derivarA: string | null) => {
    await conBloqueo(async () => {
      await marcarEstadoProfesional(p.nombre, estado, minutos);
      const derivados = derivarA ? await derivarTodos(p.nombre, derivarA, estado === 'ausente' ? 'Profesional ausente' : 'Profesional demorado') : 0;
      setModal(null);
      setMensaje({
        tono: 'success',
        titulo: estado === null ? `${p.nombre} atiende con normalidad` : estado === 'ausente' ? `${p.nombre} figura como ausente` : `${p.nombre} figura con ${minutos} minutos de demora`,
        texto: `${derivados ? `${derivados === 1 ? '1 paciente derivado' : `${derivados} pacientes derivados`} a ${derivarA}. ` : ''}La sala ya muestra el aviso.`,
      });
    });
  };

  const enEsperaDe = (nombre: string) => registros.filter((a) => esperando(a) && a.profesional === nombre).length;

  /** DEV-44: operaciones del box con aviso del resultado. */
  const operarBox = async (accion: string, operacion: () => Promise<Admision | void>, aviso: (a: Admision | void) => Aviso) => {
    setAccionBox(accion);
    try {
      await conBloqueo(async () => {
        const r = await operacion();
        if (r) aplicarLocal([r]);
        if (r) setResaltado(r.numero);
        setMensaje(aviso(r));
      });
    } catch (e) {
      setMensaje({
        tono: 'warning',
        titulo:
          e instanceof PacienteEnAtencionError
            ? `${e.enAtencion.numero} sigue en su box. Finalice esa atención primero.`
            : e instanceof PacienteNoDisponibleError
              ? 'No hay pacientes para llamar al box'
              : e instanceof Error && e.name === 'OperacionNoPermitidaError'
                ? e.message
                : 'No se pudo completar la operación del box',
      });
    } finally {
      setAccionBox(null);
    }
  };

  const llamarBox = (a?: Admision) =>
    miBox &&
    operarBox(
      'llamar',
      () => llamarAlBox(miBox, a?.turnoId),
      (r) => ({ tono: 'success', titulo: r ? `${r.numero} llamado al box ${miBox}` : 'Llamado', texto: 'La sala muestra el número y el box.' }),
    );

  return (
    <div className="sec">
      <header className="sec__header">
        <Logo size={40} />
        <span className="sec__header-item sec__centro">
          <Icon name="building" size={24} />
          {usuario?.centro}
        </span>
        <EstadoDatos className="sec__conexion" sinConexion={sinConexion} actualizadoEn={cola?.actualizadoEn ?? null} />
        <span className="sec__usuaria">
          <MenuUsuario />
        </span>
      </header>

      <main className="sec__main">
        <div className="sec__titulo">
          <h1>Admisión y sala de espera</h1>
          <div className="sec__fecha">
            <strong>
              {capitalizar(ahora.toLocaleDateString('es-AR', { weekday: 'long' }))} {fechaLarga(ahora)} · {hora(ahora)}
            </strong>
            <span>Datos ficticios · {sinConexion && cola ? `Vista de las ${horaDatos}` : 'Cola del día'}</span>
            <Link to="/secretaria/cierre" className="sec__link sec__cierre-link">
              <Icon name="calendar-check" size={18} /> {cerrado ? 'Ver el cierre del día' : 'Cerrar el día'}
            </Link>
          </div>
        </div>

        {cerrado && (
          <Alerta tono="info" titulo="El día está cerrado">
            No se registran más llegadas en esta sucursal. El resumen está en "Ver el cierre del día".
          </Alerta>
        )}

        <form className="sec__registro" onSubmit={registrar} noValidate>
          <label htmlFor="sec-documento">DNI o número de afiliado</label>
          <div className="sec__registro-fila">
            <input
              id="sec-documento"
              className={`input ${errorCampo ? 'input--error' : ''}`}
              placeholder="Ingrese el número, sin puntos"
              inputMode="numeric"
              autoComplete="off"
              value={documento}
              disabled={sinConexion || cerrado}
              aria-invalid={!!errorCampo}
              aria-describedby={errorCampo ? 'sec-documento-error' : undefined}
              onChange={(e) => {
                setErrorCampo(null);
                setDocumento(e.target.value.replace(/\D/g, '').slice(0, 11));
              }}
            />
            <Button type="submit" className="sec__btn" icon={<Icon name="user-check" size={24} />} loading={registrando} disabled={!puedeRegistrar}>
              {registrando ? 'Registrando…' : 'Registrar llegada'}
            </Button>
            <span className="sec__ayuda">Para pacientes que no utilizan el tótem.</span>
          </div>
          {errorCampo && (
            <p id="sec-documento-error" className="campo__error" role="alert">
              <Icon name="x-circle" size={18} /> {errorCampo}
            </p>
          )}
          {resultado && (
            <Alerta
              tono={resultado.tono}
              titulo={resultado.titulo}
              className="sec__resultado"
              accion={
                resultado.contraturnoPara ? (
                  <button type="button" className="sec__link" onClick={() => setModal({ tipo: 'contraturno', admision: resultado.contraturnoPara })}>
                    Registrar contraturno
                  </button>
                ) : resultado.opciones ? (
                  <span className="sec__opciones">
                    {resultado.opciones.map((o) => (
                      <button key={o.etiqueta} type="button" className="sec__opcion" onClick={o.accion}>
                        {o.etiqueta}
                      </button>
                    ))}
                  </span>
                ) : undefined
              }
            >
              {resultado.texto}
            </Alerta>
          )}
        </form>

        <div className="sec__filtros">
          <div className="campo sec__buscar">
            <label htmlFor="sec-buscar">Buscar en la cola</label>
            <div className="sec__buscar-control">
              <Icon name="search" size={20} className="sec__buscar-icono" />
              <input
                ref={campoBusqueda}
                id="sec-buscar"
                type="search"
                className="input"
                placeholder="Número, DNI o nombre"
                autoComplete="off"
                value={busqueda}
                aria-describedby="sec-buscar-resultado"
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && setBusqueda('')}
              />
              {buscando && (
                <button
                  type="button"
                  className="sec__buscar-limpiar"
                  aria-label="Limpiar búsqueda"
                  onClick={() => {
                    setBusqueda('');
                    campoBusqueda.current?.focus();
                  }}
                >
                  <Icon name="x-circle" size={20} />
                </button>
              )}
            </div>
            <span id="sec-buscar-resultado" className="sec__buscar-resultado" aria-live="polite">
              {buscando ? (filas.length === 1 ? '1 coincidencia' : `${filas.length} coincidencias`) : ''}
            </span>
          </div>
          <div className="campo">
            <label htmlFor="sec-profesional">Profesional</label>
            <select id="sec-profesional" className="select" value={filtroProfesional} onChange={(e) => setFiltroProfesional(e.target.value)}>
              <option value="">Todos los profesionales</option>
              <option value={SIN_ASIGNAR}>Sin asignar (demanda espontánea)</option>
              {PROFESIONALES.map((p) => (
                <option key={p.nombre} value={p.nombre}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="sec-estado">Estado</label>
            <select id="sec-estado" className="select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value as EstadoTurno | '')}>
              {ESTADOS.map((s) => (
                <option key={s.valor} value={s.valor}>
                  {s.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="sec__acciones">
            <Button variant="secondary" className="sec__btn" disabled={!puedeRegistrar} onClick={() => setModal({ tipo: 'demanda' })}>
              Demanda espontánea
            </Button>
            <Button variant="secondary" className="sec__btn" disabled={!puedeRegistrar} onClick={() => setModal({ tipo: 'contraturno' })}>
              Registrar contraturno
            </Button>
          </div>
        </div>

        {carga === 'error' ? (
          <Alerta tono="error" titulo="No pudimos actualizar la cola">
            Se conservaron el centro y los filtros. No se realizó ningún registro.
          </Alerta>
        ) : sinConexion ? (
          <Alerta tono="warning" titulo={`Sin conexión${cola ? ` – última actualización ${horaDatos}` : ''}`}>
            Datos anteriores. Los registros y cambios están deshabilitados hasta recuperar la conexión.
          </Alerta>
        ) : carga === 'cargando' ? (
          <Alerta tono="info" titulo="Consultando la cola del centro…" />
        ) : mensaje ? (
          <Alerta tono={mensaje.tono} titulo={mensaje.titulo}>
            {mensaje.texto}
          </Alerta>
        ) : demandasSinAsignar.length > 0 ? (
          <Alerta
            tono="warning"
            titulo={
              demandasSinAsignar.length === 1
                ? `Demanda espontánea sin profesional · ${demandasSinAsignar[0].numero}`
                : `${demandasSinAsignar.length} demandas espontáneas sin profesional`
            }
            accion={
              <button type="button" className="sec__link" onClick={() => setModal({ tipo: 'asignar', admision: demandasSinAsignar[0] })}>
                Asignar profesional
              </button>
            }
          >
            {demandasSinAsignar[0].paciente} se anotó en el tótem para {demandasSinAsignar[0].servicio ?? 'atención sin turno'}.
          </Alerta>
        ) : demoras.length > 0 ? (
          <Alerta tono="warning" titulo={`${demoras[0].profesional} · ${demoras[0].minutos} minutos de demora`}>
            Consultorio {demoras[0].consultorio} · informe a los pacientes que esperan atención.
            {demoras.length > 1 && ` También hay demora en ${demoras.slice(1).map((d) => d.profesional).join(', ')}.`}
          </Alerta>
        ) : (
          <Alerta tono="info" titulo={`La consulta se actualizó a las ${horaDatos}`} />
        )}

        {/* DEV-44: llamado a los boxes de admisión */}
        {(carga === 'ok' || cola) && boxesDeSucursal().length > 0 && (
          <section className="sec__box" aria-labelledby="sec-box-titulo">
            <div className="sec__box-encabezado">
              <h2 id="sec-box-titulo">
                <Icon name="inbox" size={22} /> {miBox ? `Atiendo en: Box ${miBox}` : 'Box de admisión'}
              </h2>
              <div className="campo sec__box-elegir">
                <label htmlFor="sec-box">{miBox ? 'Cambiar de box' : 'Elegir box'}</label>
                <select
                  id="sec-box"
                  className="select"
                  value={miBox ?? ''}
                  disabled={!operativo || !!enMiBox || accionBox !== null}
                  onChange={(e) => {
                    const elegido = e.target.value || null; // se lee antes de esperar: después React vuelve a dibujar el select
                    operarBox('elegir', () => elegirBox(yo, elegido), () => ({ tono: 'success', titulo: elegido ? `Ahora atiende en el box ${elegido}` : 'Dejó el box' }));
                  }}
                >
                  <option value="">Sin box (solo panel)</option>
                  {opcionesBox.map((b) => (
                    <option key={b.id} value={b.numero} disabled={!!b.ocupadoPor}>
                      {b.ocupadoPor ? `Box ${b.numero} · Ocupado · ${b.ocupadoPor}` : b.mio ? `Box ${b.numero}` : `Box ${b.numero} · Libre`}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!miBox ? (
              <p className="sec__box-texto">Elija su box para llamar pacientes. La sala los anuncia igual que a los consultorios.</p>
            ) : enMiBox ? (
              <div className="sec__box-atencion">
                <span className="sec__box-numero">{enMiBox.numero}</span>
                <span className="sec__box-datos">
                  <strong>{enMiBox.paciente}</strong>
                  <span>
                    {enMiBox.box!.llamados === 1 ? 'Llamado 1 vez' : `Llamado ${enMiBox.box!.llamados} veces`} · {enMiBox.profesional || enMiBox.servicio || 'Sin profesional'}
                  </span>
                </span>
                <span className="sec__box-acciones">
                  <Button
                    className="sec__btn"
                    icon={<Icon name="check" size={22} />}
                    loading={accionBox === 'finalizar'}
                    disabled={!operativo || (accionBox !== null && accionBox !== 'finalizar')}
                    onClick={() =>
                      operarBox(
                        'finalizar',
                        () => finalizarBox(enMiBox),
                        (r) => ({ tono: 'success', titulo: `${enMiBox.numero} terminó en el box`, texto: r && r.profesional ? `Queda en espera de ${r.profesional}.` : 'Queda en espera. Asígnele un profesional.' }),
                      )
                    }
                  >
                    Finalizar en box
                  </Button>
                  <Button
                    variant="secondary"
                    className="sec__btn"
                    icon={<Icon name="repeat" size={22} />}
                    loading={accionBox === 'rellamar'}
                    disabled={!operativo || (accionBox !== null && accionBox !== 'rellamar')}
                    onClick={() => operarBox('rellamar', () => volverALlamarBox(enMiBox), () => ({ tono: 'success', titulo: `Se volvió a llamar a ${enMiBox.numero} al box ${miBox}` }))}
                  >
                    Volver a llamar
                  </Button>
                  <Button
                    variant="secondary"
                    className="sec__btn"
                    icon={<Icon name="user-x" size={22} />}
                    loading={accionBox === 'ausente'}
                    disabled={!operativo || enMiBox.box!.llamados < LLAMADOS_ANTES_DE_AUSENTE || (accionBox !== null && accionBox !== 'ausente')}
                    title={enMiBox.box!.llamados < LLAMADOS_ANTES_DE_AUSENTE ? `Disponible después de ${LLAMADOS_ANTES_DE_AUSENTE} llamados` : undefined}
                    onClick={async () => {
                      const acepta = await confirmar({
                        titulo: `¿Marcar a ${enMiBox.numero} como ausente?`,
                        mensaje: 'Deja de estar en la cola del box y queda como ausente.',
                        aceptar: 'Marcar como ausente',
                        peligro: true,
                      });
                      if (acepta) operarBox('ausente', () => ausenteEnBox(enMiBox), () => ({ tono: 'success', titulo: `${enMiBox.numero} quedó como ausente` }));
                    }}
                  >
                    No se presentó
                  </Button>
                </span>
              </div>
            ) : (
              <div className="sec__box-atencion">
                <span className="sec__box-texto">
                  {colaBox.length === 0 ? 'No hay pacientes esperando pasar por un box.' : `${colaBox.length} por pasar por box · próximo ${colaBox[0].numero}${colaBox[0].prioridad ? ' (prioridad)' : ''}`}
                </span>
                <Button className="sec__btn" icon={<Icon name="megaphone" size={22} />} loading={accionBox === 'llamar'} disabled={!operativo || colaBox.length === 0 || accionBox !== null} onClick={() => llamarBox()}>
                  Llamar al siguiente
                </Button>
              </div>
            )}
          </section>
        )}

        {/* DEV-55: avisos generales en la pantalla de sala */}
        {(carga === 'ok' || cola) && (
          <section className="sec__avisos" aria-labelledby="sec-avisos-titulo">
            <div className="sec__box-encabezado">
              <h2 id="sec-avisos-titulo">
                <Icon name="monitor" size={22} /> Avisos en la sala
              </h2>
              <Button variant="secondary" className="sec__btn sec__btn--auto" disabled={!operativo} onClick={() => setModal({ tipo: 'aviso-sala' })}>
                Nuevo aviso
              </Button>
            </div>
            {avisosSala.length === 0 ? (
              <p className="sec__box-texto">No hay avisos en la pantalla de sala.</p>
            ) : (
              <ul className="sec__avisos-lista">
                {avisosSala.map((a) => (
                  <li key={a.id}>
                    <span>
                      <strong>{a.texto}</strong>
                      <span>
                        Hasta las {hora(a.hasta)} · {a.usuario}
                      </span>
                    </span>
                    <button
                      type="button"
                      className="sec__link"
                      disabled={!operativo}
                      onClick={async () => {
                        const acepta = await confirmar({
                          titulo: '¿Quitar el aviso de la sala?',
                          mensaje: `"${a.texto}" deja de verse en la pantalla de sala.`,
                          aceptar: 'Quitar aviso',
                          peligro: true,
                        });
                        if (!acepta) return;
                        quitarAviso(a.id, yo);
                        setMensaje({ tono: 'success', titulo: 'Se quitó el aviso de la sala' });
                        setAhora(new Date());
                      }}
                    >
                      Quitar
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(carga === 'ok' || cola) && PROFESIONALES.length > 0 && (
          <section className="sec__profesionales" aria-labelledby="sec-prof-titulo">
            <h2 id="sec-prof-titulo">Profesionales de hoy</h2>
            <ul>
              {PROFESIONALES.map((p) => {
                const e = estados[p.nombre];
                const pausa = pausas[p.nombre];
                return (
                  <li key={p.nombre} className={e ? `sec__prof sec__prof--${e.estado}` : pausa ? 'sec__prof sec__prof--demorado' : 'sec__prof'}>
                    <span className="sec__prof-datos">
                      <strong>{p.nombre}</strong>
                      <span>
                        {p.especialidad} · Consultorio {p.consultorio} · {enEsperaDe(p.nombre)} en espera
                      </span>
                    </span>
                    <span className={`sec__prof-estado sec__prof-estado--${e?.estado ?? (pausa ? 'demorado' : 'normal')}`}>
                      <Icon name={e?.estado === 'ausente' ? 'user-x' : e?.estado === 'demorado' ? 'clock' : pausa ? 'pause' : 'check-circle'} size={18} />
                      {e?.estado === 'ausente'
                        ? 'Ausente'
                        : e?.estado === 'demorado'
                          ? `Demorado ${e.minutos ?? ''} min`
                          : pausa
                            ? `En pausa · ${minutosRestantesPausa(pausa, ahora) > 0 ? `vuelve en ${minutosRestantesPausa(pausa, ahora)} min` : 'por volver'}`
                            : 'Atiende'}
                    </span>
                    <button type="button" className="sec__link" disabled={!operativo} onClick={() => setModal({ tipo: 'estado-profesional', profesional: p })}>
                      {e ? 'Cambiar aviso' : 'Avisar ausencia o demora'}
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="sec__tabla-card" aria-labelledby="sec-cola-titulo">
          <div className="sec__tabla-encabezado">
            <h2 id="sec-cola-titulo">{sinConexion && cola ? `Cola guardada · ${horaDatos}` : 'Cola de atención'}</h2>
            <span>
              {carga === 'cargando' || carga === 'error' || (sinConexion && !cola)
                ? 'Actualización pendiente'
                : registros.length === 0
                  ? '0 pacientes en espera'
                  : `${registros.length} registros · ${enEspera} en espera`}
            </span>
          </div>

          <table className="sec__tabla">
            <thead>
              <tr>
                <th scope="col">Número</th>
                <th scope="col">Paciente</th>
                <th scope="col">Profesional</th>
                <th scope="col">Consultorio</th>
                <th scope="col">Hora del turno</th>
                <th scope="col">Minutos de espera</th>
                <th scope="col">Estado</th>
                <th scope="col">
                  <span className="visually-hidden">Acciones</span>
                </th>
              </tr>
            </thead>
            {(carga === 'ok' || (sinConexion && cola)) && filas.length > 0 && (
              <tbody>
                {filas.map((a) => (
                  <tr key={a.turnoId} className={[a.numero === resaltado ? 'sec__fila--resaltada' : '', buscando ? 'sec__fila--coincide' : '', a.prioridad ? 'sec__fila--prioridad' : ''].join(' ').trim()}>
                    <td data-label="Número" className="sec__numero">{buscando && coincideBusqueda({ ...a, paciente: '', documento: undefined }, busqueda) ? <mark>{a.numero}</mark> : a.numero}</td>
                    <td data-label="Paciente">
                      <span className="sec__paciente">
                        <Resaltado texto={a.paciente} busqueda={busqueda} />
                        {a.prioridad && <MarcaPrioridad motivo={a.prioridad.motivo} />}
                        {a.tipo === 'derivacion' && (
                          <span className="sec__badge" title="Derivado desde un consultorio: no vuelve a pasar por secretaría">
                            Derivado por {a.derivaciones?.slice(-1)[0]?.desde ?? 'consultorio'}
                          </span>
                        )}
                        {turnosHoyDe(a.documento) > 1 && (
                          <span className="sec__badge" title="El paciente tiene más de un turno hoy">
                            {turnosHoyDe(a.documento)} turnos hoy
                          </span>
                        )}
                      </span>
                    </td>
                    <td data-label="Profesional">
                      {sinProfesional(a) ? (
                        <span className="sec__sin-asignar">
                          <span>Sin asignar · {a.servicio ?? 'Demanda espontánea'}</span>
                          {esperando(a) && operativo && (
                            <button type="button" className="sec__link" onClick={() => setModal({ tipo: 'asignar', admision: a })}>
                              Asignar profesional
                            </button>
                          )}
                        </span>
                      ) : (
                        a.profesional
                      )}
                    </td>
                    <td data-label="Consultorio">{a.consultorio || '—'}</td>
                    <td data-label="Hora del turno">{a.tipo === 'demanda' ? 'Sin turno' : a.tipo === 'derivacion' ? `Derivado ${hora(a.horaTurno)}` : hora(a.horaTurno)}</td>
                    <td data-label="Minutos de espera">{esperando(a) ? <TiempoEspera minutos={minutosEntre(a.registradaEn, sinConexion && cola ? cola.actualizadoEn : ahora)} /> : '—'}</td>
                    <td data-label="Estado">
                      <StatusChip estado={estadoVisible(a)} />
                      {a.box?.estado === 'llamado' && <span className="sec__box-estado">En box {a.box.numero}</span>}
                      {a.box?.estado === 'finalizado' && a.estado === 'en-espera' && <span className="sec__box-estado">Pasó por box {a.box.numero}</span>}
                    </td>
                    <td data-label="Acciones" className="sec__acciones-fila">
                      {operativo && a.numero !== '—' && (
                        <AccionesFila
                          admision={a}
                          onLlamarBox={miBox && !enMiBox && esperando(a) && !a.box && a.tipo !== 'derivacion' ? () => llamarBox(a) : undefined}
                          onPrioridad={() => setModal({ tipo: 'prioridad', admision: a })}
                          onDerivar={() => setModal({ tipo: 'derivar', admision: a })}
                          onRetiro={() => setModal({ tipo: 'retiro', admision: a })}
                          onReincorporar={() =>
                            operar(
                              () => reincorporarPaciente(a),
                              () => ({ tono: 'success', titulo: `${a.numero} volvió a la cola`, texto: `${a.paciente} conserva su número y su hora de llegada.` }),
                            )
                          }
                          onAnular={() => setModal({ tipo: 'anular', admision: a })}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {carga === 'cargando' && (
            <div className="sec__vacio">
              <span className="spinner sec__spinner" aria-hidden="true" />
              <div className="sec__esqueleto" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <p>Cargando pacientes. Espere un momento.</p>
            </div>
          )}
          {carga === 'error' && (
            <div className="sec__vacio">
              <Icon name="x-circle" size={56} className="sec__icono--error" />
              <h3>No se pudo consultar la cola</h3>
              <p>Revise la conexión e intente nuevamente.</p>
              <Button className="sec__btn sec__btn--auto" onClick={() => actualizar(true)}>
                Reintentar consulta
              </Button>
            </div>
          )}
          {sinConexion && !cola && (
            <div className="sec__vacio">
              <Icon name="wifi-off" size={56} className="sec__icono--alerta" />
              <h3>Sin datos guardados</h3>
              <p>La cola se mostrará al recuperar la conexión.</p>
            </div>
          )}
          {carga === 'ok' && registros.length === 0 && (
            <div className="sec__vacio">
              <Icon name="users" size={56} className="sec__icono--info" />
              <h3>No hay pacientes en espera</h3>
              <p>Las llegadas registradas aparecerán en esta tabla.</p>
            </div>
          )}
          {carga === 'ok' && registros.length > 0 && filas.length === 0 && (
            <div className="sec__vacio">
              <Icon name="info" size={56} className="sec__icono--info" />
              <h3>{buscando ? `No hay pacientes que coincidan con "${busqueda.trim()}"` : 'No hay registros con estos filtros'}</h3>
              <p>{buscando ? 'Revise lo que escribió o limpie la búsqueda. La búsqueda se combina con los filtros de profesional y estado.' : 'Cambie el profesional o el estado para ver más pacientes.'}</p>
              {buscando && (
                <Button variant="secondary" className="sec__btn sec__btn--auto" onClick={() => setBusqueda('')}>
                  Limpiar búsqueda
                </Button>
              )}
            </div>
          )}
        </section>

        <p className="sec__nota">
          <Icon name="info" size={22} />
          Tolerancia: {TOLERANCIA_MINUTOS} minutos. La cancelación se aplica solo al superar ese plazo. Contraturno sujeto a confirmación.
        </p>
      </main>

      {modal?.tipo === 'contraturno' && (
        <ModalContraturno
          candidatas={canceladasSinContraturno}
          inicial={modal.admision}
          onCerrar={() => setModal(null)}
          onConfirmar={confirmarContraturno}
        />
      )}
      {modal?.tipo === 'demanda' && <ModalDemanda onCerrar={() => setModal(null)} onConfirmar={confirmarDemanda} />}
      {modal?.tipo === 'asignar' && <ModalAsignar admision={modal.admision} onCerrar={() => setModal(null)} onConfirmar={confirmarAsignacion} />}
      {modal?.tipo === 'derivar' && (
        <ModalDerivar
          admision={modal.admision}
          especialidad={especialidadDe(modal.admision)}
          onCerrar={() => setModal(null)}
          onConfirmar={(a, profesional, motivo) =>
            operar(
              () => derivarPaciente(a, profesional, motivo),
              (r) => ({ tono: 'success', titulo: `${a.numero} derivado a ${profesional}`, texto: r ? `${r.paciente} · Consultorio ${r.consultorio} · conserva su número y su espera.` : undefined }),
            )
          }
        />
      )}
      {modal?.tipo === 'retiro' && (
        <ModalSeRetiro
          admision={modal.admision}
          onCerrar={() => setModal(null)}
          onConfirmar={(a, motivo) =>
            operar(
              () => marcarSeRetiro(a, motivo),
              () => ({ tono: 'success', titulo: `${a.numero} se retiró`, texto: 'Si vuelve, use "Reincorporar" en su fila.' }),
            )
          }
        />
      )}
      {modal?.tipo === 'anular' && (
        <ModalAnular
          admision={modal.admision}
          onCerrar={() => setModal(null)}
          onConfirmar={async (a, motivo) => {
            await conBloqueo(async () => {
              await anularLlegada(a, motivo);
              setCola((c) => (c ? { ...c, registros: c.registros.filter((r) => r.turnoId !== a.turnoId) } : c));
              setModal(null);
              setMensaje({ tono: 'success', titulo: `Llegada ${a.numero} anulada`, texto: 'El turno volvió a quedar disponible para registrar.' });
            });
          }}
        />
      )}
      {modal?.tipo === 'prioridad' && (
        <ModalPrioridad
          admision={modal.admision}
          onCerrar={() => setModal(null)}
          onConfirmar={(a, motivo) =>
            operar(
              () => marcarPrioridad(a, motivo),
              () => ({
                tono: 'success',
                titulo: motivo ? `${a.numero} tiene prioridad` : `Se quitó la prioridad de ${a.numero}`,
                texto: motivo ? `Pasa adelante en la cola de ${a.profesional || 'su profesional'}. Quedó registrado el motivo.` : 'Vuelve a su lugar según el horario del turno.',
              }),
            )
          }
        />
      )}
      {modal?.tipo === 'aviso-sala' && usuario && (
        <ModalAvisoSala
          sucursales={usuario.sucursales}
          sucursalActual={usuario.sucursal}
          nombresPacientes={registros.map((r) => r.paciente)}
          onCerrar={() => setModal(null)}
          onConfirmar={async ({ texto, hasta, sucursal }) => {
            publicarAviso({ texto, hasta, sucursal, usuario: yo }, registros.map((r) => r.paciente));
            setModal(null);
            setAhora(new Date());
            setMensaje({ tono: 'success', titulo: 'El aviso ya se muestra en la sala', texto: `Hasta las ${hora(hasta)}.` });
          }}
        />
      )}
      {modal?.tipo === 'estado-profesional' && (
        <ModalEstadoProfesional
          profesional={modal.profesional}
          estadoActual={estados[modal.profesional.nombre]}
          enEspera={enEsperaDe(modal.profesional.nombre)}
          onCerrar={() => setModal(null)}
          onConfirmar={(estado, minutos, derivarA) => guardarEstadoProfesional(modal.profesional, estado, minutos, derivarA)}
        />
      )}
      {dialogo}
    </div>
  );
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type AccionesFilaProps = {
  admision: Admision;
  onLlamarBox?: () => void; // DEV-44
  onPrioridad: () => void; // DEV-49
  onDerivar: () => void;
  onRetiro: () => void;
  onReincorporar: () => void;
  onAnular: () => void;
};

/** Acciones de una fila de la cola (#58, #64, #65), en un menú para no recargar la tabla. */
function AccionesFila({ admision, onLlamarBox, onPrioridad, onDerivar, onRetiro, onReincorporar, onAnular }: AccionesFilaProps) {
  const [posicion, setPosicion] = useState<{ top: number; left: number } | null>(null);
  const abierto = posicion !== null;
  const caja = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);

  // La lista se ubica respecto de la pantalla para que la tabla, que se desplaza, no la recorte.
  const abrir = () => {
    if (!boton.current) return setPosicion(null);
    const r = boton.current.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) return setPosicion(null); // el botón salió de la vista
    const ancho = 270;
    const alto = 280;
    const left = Math.max(8, Math.min(r.right - ancho, window.innerWidth - ancho - 8));
    const top = r.bottom + alto > window.innerHeight ? Math.max(8, r.top - alto - 4) : r.bottom + 4;
    setPosicion({ top, left });
  };

  useEffect(() => {
    if (!abierto) return;
    const cerrar = () => setPosicion(null);
    const seguir = () => abrir();
    const fuera = (e: PointerEvent) => !caja.current?.contains(e.target as Node) && cerrar();
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      cerrar();
      boton.current?.focus();
    };
    document.addEventListener('pointerdown', fuera);
    document.addEventListener('keydown', escape);
    window.addEventListener('scroll', seguir, true);
    window.addEventListener('resize', seguir);
    return () => {
      document.removeEventListener('pointerdown', fuera);
      document.removeEventListener('keydown', escape);
      window.removeEventListener('scroll', seguir, true);
      window.removeEventListener('resize', seguir);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto]);

  const acciones: { etiqueta: string; icono: 'swap' | 'log-out' | 'undo' | 'x-circle' | 'flag' | 'megaphone'; hacer: () => void; peligro?: boolean }[] = [];
  if (onLlamarBox) acciones.push({ etiqueta: 'Llamar a mi box', icono: 'megaphone', hacer: onLlamarBox });
  if (admision.estado === 'en-espera') acciones.push({ etiqueta: admision.prioridad ? 'Cambiar o quitar prioridad' : 'Dar prioridad', icono: 'flag', hacer: onPrioridad });
  if (admision.estado === 'en-espera' && !sinProfesional(admision)) acciones.push({ etiqueta: 'Derivar a otro profesional', icono: 'swap', hacer: onDerivar });
  if (admision.estado === 'en-espera') acciones.push({ etiqueta: 'Se retiró sin ser atendido', icono: 'log-out', hacer: onRetiro });
  if (admision.estado === 'se-retiro') acciones.push({ etiqueta: 'Reincorporar a la cola', icono: 'undo', hacer: onReincorporar });
  if (admision.estado === 'en-espera') acciones.push({ etiqueta: 'Anular llegada (error)', icono: 'x-circle', hacer: onAnular, peligro: true });
  if (acciones.length === 0) return null;

  return (
    <div className="sec__menu-fila" ref={caja}>
      <button ref={boton} type="button" className="sec__menu-boton" aria-expanded={abierto} aria-label={`Acciones para ${admision.numero}`} onClick={() => (abierto ? setPosicion(null) : abrir())}>
        <Icon name="more" size={22} />
        <span className="sec__menu-texto">Acciones</span>
      </button>
      {abierto && (
        <ul className="sec__menu-lista" style={{ top: posicion.top, left: posicion.left }}>
          {acciones.map((a) => (
            <li key={a.etiqueta}>
              <button
                type="button"
                className={`sec__menu-item ${a.peligro ? 'sec__menu-item--peligro' : ''}`}
                onClick={() => {
                  setPosicion(null);
                  a.hacer();
                }}
              >
                <Icon name={a.icono} size={20} /> {a.etiqueta}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
