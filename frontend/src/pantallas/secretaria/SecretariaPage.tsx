import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { StatusChip, type EstadoTurno } from '../../componentes/StatusChip';
import {
  buscarTurno,
  calcularDemoras,
  escucharCambios,
  hayConexion,
  obtenerColaCentro,
  PROFESIONALES,
  RegistroError,
  registrarContraturno,
  registrarDemandaEspontanea,
  registrarLlegada,
  SinConexionError,
  type Admision,
  type ColaCentro,
} from '../../servicios/turnos';
import { TOLERANCIA_MINUTOS } from '../../servicios/tolerancia';
import { fechaLarga, hora, minutosEntre } from '../../utilidades/fechas';
import { ModalContraturno, ModalDemanda } from './Modales';
import './secretaria.css';

const CENTRO = 'Centro Villa Norte';
const USUARIA = 'Julia Benítez · Admisión';
const ACTUALIZAR_CADA_MS = 5_000;
const MIN_DIGITOS = 7;

type Carga = 'cargando' | 'ok' | 'error' | 'sin-conexion';
type Aviso = { tono: 'success' | 'info' | 'warning' | 'error'; titulo: string; texto?: string; contraturnoPara?: Admision };
type ModalAbierto = null | { tipo: 'contraturno'; admision?: Admision } | { tipo: 'demanda' };

const ESTADOS: { valor: EstadoTurno | ''; etiqueta: string }[] = [
  { valor: '', etiqueta: 'Todos los estados' },
  { valor: 'en-espera', etiqueta: 'En espera' },
  { valor: 'llamado', etiqueta: 'Llamado' },
  { valor: 'cancelado-tolerancia', etiqueta: 'Cancelado por tolerancia' },
  { valor: 'ausente', etiqueta: 'Ausente' },
  { valor: 'contraturno', etiqueta: 'Contraturno' },
];

/** Estado visible de una fila: un contraturno en espera se muestra como "Contraturno". */
function estadoVisible(a: Admision): EstadoTurno {
  if (a.tipo === 'contraturno' && a.estado === 'en-espera') return 'contraturno';
  return a.estado === 'finalizado' ? 'llamado' : a.estado;
}

const ordenEstado: Record<EstadoTurno, number> = { 'en-espera': 0, llamado: 1, 'cancelado-tolerancia': 2, ausente: 3, contraturno: 4 };

function ordenarFilas(a: Admision, b: Admision) {
  return ordenEstado[estadoVisible(a)] - ordenEstado[estadoVisible(b)] || a.horaTurno.localeCompare(b.horaTurno);
}

const esperando = (a: Admision) => a.estado === 'en-espera';

export function SecretariaPage() {
  const [carga, setCarga] = useState<Carga>('cargando');
  const [cola, setCola] = useState<ColaCentro | null>(null);
  const [ahora, setAhora] = useState(new Date());
  const [filtroProfesional, setFiltroProfesional] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<EstadoTurno | ''>('');
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
        .filter((a) => !filtroProfesional || a.profesional === filtroProfesional)
        .filter((a) => !filtroEstado || estadoVisible(a) === filtroEstado)
        .sort(ordenarFilas),
    [registros, filtroProfesional, filtroEstado],
  );
  const enEspera = registros.filter(esperando).length;
  const canceladasSinContraturno = registros.filter((a) => a.estado === 'cancelado-tolerancia' && !a.contraturnoAsignado);
  const demoras = carga === 'ok' ? calcularDemoras(registros, ahora) : [];

  const operativo = carga === 'ok';
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

  const registrar = async (e: FormEvent) => {
    e.preventDefault();
    setResultado(null);
    if (!documento) return setErrorCampo('Ingrese el número de documento o de afiliado.');
    if (documento.length < MIN_DIGITOS) return setErrorCampo(`El número debe tener al menos ${MIN_DIGITOS} dígitos, sin puntos.`);
    setRegistrando(true);
    await conBloqueo(async () => {
      try {
        const r = await buscarTurno(documento);
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
        } else {
          const admision = await registrarLlegada(r.turno);
          aplicarLocal([admision]);
          setResultado({ tono: 'success', titulo: `Llegada registrada · ${admision.numero}`, texto: `${admision.paciente} · ${admision.profesional} · Consultorio ${admision.consultorio}` });
          setResaltado(admision.numero);
          setDocumento('');
        }
      } catch (err) {
        if (err instanceof SinConexionError) setCarga('sin-conexion');
        setResultado({
          tono: 'error',
          titulo: err instanceof RegistroError ? 'No se pudo registrar la llegada' : 'No se pudo consultar el turno',
          texto: 'Intente nuevamente. La llegada aún no está confirmada.',
        });
      } finally {
        setRegistrando(false);
      }
    });
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

  return (
    <div className="sec">
      <header className="sec__header">
        <Logo size={40} />
        <span className="sec__header-item sec__centro">
          <Icon name="building" size={24} />
          {CENTRO}
        </span>
        {sinConexion ? (
          <span className="sec__header-item sec__conexion--off">
            <Icon name="wifi-off" size={24} />
            Sin conexión{cola ? ` – última actualización ${horaDatos}` : ''}
          </span>
        ) : (
          <span className="sec__header-item sec__conexion--on">
            <Icon name="wifi" size={24} />
            Conectado
          </span>
        )}
        <span className="sec__header-item sec__usuaria">
          <Icon name="user" size={24} />
          {USUARIA}
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
          </div>
        </div>

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
              disabled={sinConexion}
              aria-invalid={!!errorCampo}
              aria-describedby={errorCampo ? 'sec-documento-error' : undefined}
              onChange={(e) => {
                setErrorCampo(null);
                setDocumento(e.target.value.replace(/\D/g, '').slice(0, 11));
              }}
            />
            <Button type="submit" className="sec__btn" icon={<Icon name="user-check" size={24} />} loading={registrando} disabled={!operativo}>
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
                resultado.contraturnoPara && (
                  <button type="button" className="sec__link" onClick={() => setModal({ tipo: 'contraturno', admision: resultado.contraturnoPara })}>
                    Registrar contraturno
                  </button>
                )
              }
            >
              {resultado.texto}
            </Alerta>
          )}
        </form>

        <div className="sec__filtros">
          <div className="campo">
            <label htmlFor="sec-profesional">Profesional</label>
            <select id="sec-profesional" className="select" value={filtroProfesional} onChange={(e) => setFiltroProfesional(e.target.value)}>
              <option value="">Todos los profesionales</option>
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
            <Button variant="secondary" className="sec__btn" disabled={!operativo} onClick={() => setModal({ tipo: 'demanda' })}>
              Demanda espontánea
            </Button>
            <Button variant="secondary" className="sec__btn" disabled={!operativo} onClick={() => setModal({ tipo: 'contraturno' })}>
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
        ) : demoras.length > 0 ? (
          <Alerta tono="warning" titulo={`${demoras[0].profesional} · ${demoras[0].minutos} minutos de demora`}>
            Consultorio {demoras[0].consultorio} · informe a los pacientes que esperan atención.
            {demoras.length > 1 && ` También hay demora en ${demoras.slice(1).map((d) => d.profesional).join(', ')}.`}
          </Alerta>
        ) : (
          <Alerta tono="info" titulo={`La consulta se actualizó a las ${horaDatos}`} />
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
              </tr>
            </thead>
            {(carga === 'ok' || (sinConexion && cola)) && filas.length > 0 && (
              <tbody>
                {filas.map((a) => (
                  <tr key={a.turnoId} className={a.numero === resaltado ? 'sec__fila--resaltada' : ''}>
                    <td data-label="Número" className="sec__numero">{a.numero}</td>
                    <td data-label="Paciente">{a.paciente}</td>
                    <td data-label="Profesional">{a.profesional}</td>
                    <td data-label="Consultorio">{a.consultorio}</td>
                    <td data-label="Hora del turno">{hora(a.horaTurno)}</td>
                    <td data-label="Minutos de espera">{esperando(a) ? `${minutosEntre(a.registradaEn, sinConexion && cola ? cola.actualizadoEn : ahora)} min` : '—'}</td>
                    <td data-label="Estado">
                      <StatusChip estado={estadoVisible(a)} />
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
              <h3>No hay registros con estos filtros</h3>
              <p>Cambie el profesional o el estado para ver más pacientes.</p>
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
    </div>
  );
}

const capitalizar = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
