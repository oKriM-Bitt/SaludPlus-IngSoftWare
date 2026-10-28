import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon, type IconName } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import {
  buscarTurno,
  identificarSinTurno,
  registrarDemandaTotem,
  registrarLlegada,
  SERVICIOS,
  SinConexionError,
  type Admision,
  type Turno,
} from '../../servicios/turnos';
import { Stepper, type PasoStepper } from './Stepper';
import { Keypad } from './Keypad';
import { TurnoDetalle } from './TurnoDetalle';
import { ResultCard } from './ResultCard';
import './totem.css';

const CENTRO = 'Centro Villa Norte';
const MAX_DIGITOS = 11;
const MIN_DIGITOS = 7;
const INACTIVIDAD_MS = 45_000;

/** DEV-33: el paciente elige al inicio si tiene turno o no. */
type Modalidad = 'con-turno' | 'sin-turno';

type Paso =
  | { id: 'K01-bienvenida' } // pregunta "¿Tiene turno?"
  | { id: 'K11-servicio' } // #43: elegir servicio o especialidad
  | { id: 'K02-ingreso' }
  | { id: 'K03-confirmacion'; turno: Turno }
  | { id: 'K08-registrando'; turno: Turno }
  | { id: 'K12-otro-servicio'; turno: Turno } // #43: el turno es de otro servicio
  | { id: 'K13-confirmar-demanda'; paciente: string } // DEV-33: sin turno
  | { id: 'K14-registrando-demanda'; paciente: string }
  | { id: 'K15-tiene-turno'; turno: Turno } // DEV-33: dijo "sin turno" pero tiene uno hoy
  | { id: 'K04-registrada'; admision: Admision }
  | { id: 'K05-no-encontrado' }
  | { id: 'K06-tolerancia' }
  | { id: 'K07-ya-registrada'; admision: Admision }
  | { id: 'K09-error'; turno?: Turno; paciente?: string }
  | { id: 'K10-sin-conexion' };

const pasoDelStepper: Record<Paso['id'], PasoStepper | null> = {
  'K01-bienvenida': null,
  'K11-servicio': 1,
  'K02-ingreso': 2,
  'K05-no-encontrado': 2,
  'K03-confirmacion': 3,
  'K08-registrando': 3,
  'K12-otro-servicio': 3,
  'K13-confirmar-demanda': 3,
  'K14-registrando-demanda': 3,
  'K15-tiene-turno': 3,
  'K04-registrada': 4,
  'K06-tolerancia': 4,
  'K07-ya-registrada': 4,
  'K09-error': 4,
  'K10-sin-conexion': 4,
};

/** Pantallas en las que el tótem espera una respuesta: no vuelve solo al inicio. */
const sinInactividad: Paso['id'][] = ['K01-bienvenida', 'K08-registrando', 'K14-registrando-demanda'];

export function TotemPage() {
  const [paso, setPaso] = useState<Paso>({ id: 'K01-bienvenida' });
  const [modalidad, setModalidad] = useState<Modalidad>('con-turno');
  const [servicio, setServicio] = useState<string | null>(null);
  const [numero, setNumero] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  // Al volver al inicio se borran todos los datos: el próximo paciente no ve nada del anterior.
  const reiniciar = useCallback(() => {
    setNumero('');
    setErrorCampo(null);
    setBuscando(false);
    setServicio(null);
    setModalidad('con-turno');
    setPaso({ id: 'K01-bienvenida' });
  }, []);

  // Lleva el foco al título en cada cambio de pantalla (lectores de pantalla y teclado).
  useEffect(() => {
    tituloRef.current?.focus();
  }, [paso.id]);

  // Tótem compartido: si nadie lo usa, vuelve a la bienvenida.
  useEffect(() => {
    if (sinInactividad.includes(paso.id)) return;
    let timer = window.setTimeout(reiniciar, INACTIVIDAD_MS);
    const reset = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(reiniciar, INACTIVIDAD_MS);
    };
    window.addEventListener('pointerdown', reset);
    window.addEventListener('keydown', reset);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointerdown', reset);
      window.removeEventListener('keydown', reset);
    };
  }, [paso.id, reiniciar]);

  const elegirModalidad = (m: Modalidad) => {
    setModalidad(m);
    setPaso({ id: 'K11-servicio' });
  };

  const elegirServicio = (s: string) => {
    setServicio(s);
    setErrorCampo(null);
    setPaso({ id: 'K02-ingreso' });
  };

  const agregarDigito = (d: string) => {
    setErrorCampo(null);
    setNumero((n) => (n.length < MAX_DIGITOS ? n + d : n));
  };

  /** Busca el turno y decide la pantalla. Sin servicio, no controla que coincida (paciente que confirma su turno). */
  const buscarConTurno = async (servicioElegido: string | undefined) => {
    const r = await buscarTurno(numero, new Date(), servicioElegido);
    if (r.tipo === 'encontrado') setPaso({ id: 'K03-confirmacion', turno: r.turno });
    else if (r.tipo === 'otro-servicio') setPaso({ id: 'K12-otro-servicio', turno: r.turno });
    else if (r.tipo === 'no-encontrado') setPaso({ id: 'K05-no-encontrado' });
    else if (r.tipo === 'tolerancia-vencida') setPaso({ id: 'K06-tolerancia' });
    else setPaso({ id: 'K07-ya-registrada', admision: r.admision });
  };

  const buscarSinTurno = async () => {
    const r = await identificarSinTurno(numero);
    if (r.tipo === 'identificado') setPaso({ id: 'K13-confirmar-demanda', paciente: r.paciente });
    else if (r.tipo === 'tiene-turno') setPaso({ id: 'K15-tiene-turno', turno: r.turno });
    else if (r.tipo === 'turno-vencido') setPaso({ id: 'K06-tolerancia' });
    else if (r.tipo === 'ya-registrado') setPaso({ id: 'K07-ya-registrada', admision: r.admision });
    else setPaso({ id: 'K05-no-encontrado' });
  };

  const continuar = async () => {
    if (!numero) return setErrorCampo(modalidad === 'sin-turno' ? 'Ingrese su número de documento.' : 'Ingrese su número de documento o de afiliado.');
    if (numero.length < MIN_DIGITOS) return setErrorCampo(`El número debe tener al menos ${MIN_DIGITOS} dígitos.`);
    setBuscando(true);
    try {
      if (modalidad === 'sin-turno') await buscarSinTurno();
      else await buscarConTurno(servicio ?? undefined);
    } catch (e) {
      setPaso(e instanceof SinConexionError ? { id: 'K10-sin-conexion' } : { id: 'K05-no-encontrado' });
    } finally {
      setBuscando(false);
    }
  };

  /** K12 y K15: el paciente sigue con el turno que tiene, aunque sea de otro servicio. */
  const seguirConMiTurno = async () => {
    setModalidad('con-turno');
    setBuscando(true);
    try {
      await buscarConTurno(undefined);
    } catch (e) {
      setPaso(e instanceof SinConexionError ? { id: 'K10-sin-conexion' } : { id: 'K05-no-encontrado' });
    } finally {
      setBuscando(false);
    }
  };

  const registrar = async (turno: Turno) => {
    setPaso({ id: 'K08-registrando', turno });
    try {
      const admision = await registrarLlegada(turno);
      setPaso({ id: 'K04-registrada', admision });
    } catch (e) {
      setPaso(e instanceof SinConexionError ? { id: 'K10-sin-conexion' } : { id: 'K09-error', turno });
    }
  };

  const registrarDemanda = async (paciente: string) => {
    if (!servicio) return setPaso({ id: 'K11-servicio' });
    setPaso({ id: 'K14-registrando-demanda', paciente });
    try {
      const admision = await registrarDemandaTotem(numero, paciente, servicio);
      setPaso(admision.servicio === servicio && admision.tipo === 'demanda' ? { id: 'K04-registrada', admision } : { id: 'K07-ya-registrada', admision });
    } catch (e) {
      setPaso(e instanceof SinConexionError ? { id: 'K10-sin-conexion' } : { id: 'K09-error', paciente });
    }
  };

  const etapa = pasoDelStepper[paso.id];

  return (
    <div className="totem">
      <header className="totem__header">
        <Logo size={48} />
        <span className="totem__centro">{CENTRO}</span>
      </header>

      <main className="totem__main">
        <div className="totem__container">
          {etapa && <Stepper actual={etapa} />}
          <div className="totem__content" aria-live="polite">
            {renderPaso()}
          </div>
        </div>
      </main>

      <footer className="totem__footer">
        <Icon name="help-circle" size={28} className="totem__footer-icon" />
        <span>Estamos para ayudarle. Puede consultar en secretaría.</span>
      </footer>
    </div>
  );

  function renderPaso(): ReactNode {
    switch (paso.id) {
      case 'K01-bienvenida':
        return (
          <section className="totem__center">
            <Icon name="hand" size={104} className="totem__hero-icon" />
            <h1 ref={tituloRef} tabIndex={-1} className="totem__title totem__title--xl">
              Anuncie su llegada
            </h1>
            <p className="totem__lead">¿Tiene un turno para hoy? No necesita usar un celular.</p>
            <div className="totem__opciones">
              <Button icon={<Icon name="calendar-check" size={32} />} onClick={() => elegirModalidad('con-turno')}>
                Tengo turno
              </Button>
              <Button variant="secondary" icon={<Icon name="user" size={32} />} onClick={() => elegirModalidad('sin-turno')}>
                No tengo turno
              </Button>
            </div>
            <div className="totem__hint">
              <strong>Tenga a mano su DNI o número de afiliado.</strong>
              <span>Si necesita ayuda, acérquese a secretaría.</span>
            </div>
          </section>
        );

      case 'K11-servicio':
        return (
          <section className="totem__form">
            <h1 ref={tituloRef} tabIndex={-1} className="totem__title">
              ¿A qué servicio viene?
            </h1>
            <p className="totem__subtitle">
              {modalidad === 'con-turno'
                ? 'Elija la especialidad de su turno.'
                : 'Elija el servicio en el que quiere ser atendido sin turno.'}
            </p>
            <div className="totem__servicios" role="group" aria-label="Servicios del centro">
              {SERVICIOS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`totem__servicio ${s === servicio ? 'totem__servicio--elegido' : ''}`}
                  aria-pressed={s === servicio}
                  onClick={() => elegirServicio(s)}
                >
                  <span>{s}</span>
                  <Icon name="arrow-right" size={32} />
                </button>
              ))}
            </div>
            <div className="totem__actions">
              <Button variant="secondary" onClick={() => setPaso({ id: 'K01-bienvenida' })}>
                Volver
              </Button>
            </div>
          </section>
        );

      case 'K02-ingreso': {
        const etiqueta = modalidad === 'sin-turno' ? 'DNI' : 'DNI o número de afiliado';
        return (
          <section className="totem__form">
            <h1 ref={tituloRef} tabIndex={-1} className="totem__title">
              {modalidad === 'sin-turno' ? 'Ingrese su DNI' : 'Ingrese su número'}
            </h1>
            <p className="totem__subtitle">
              {servicio} · Escríbalo sin puntos ni espacios.
            </p>
            <label htmlFor="documento" className="totem__label">
              {etiqueta}
            </label>
            <input
              id="documento"
              className={`totem__input ${errorCampo ? 'totem__input--error' : ''}`}
              value={numero}
              placeholder="Ingrese su número"
              inputMode="none"
              autoComplete="off"
              aria-invalid={!!errorCampo}
              aria-describedby={errorCampo ? 'documento-error' : undefined}
              onChange={(e) => {
                setErrorCampo(null);
                setNumero(e.target.value.replace(/\D/g, '').slice(0, MAX_DIGITOS));
              }}
              onKeyDown={(e) => e.key === 'Enter' && continuar()}
            />
            {errorCampo && (
              <p id="documento-error" className="totem__field-error" role="alert">
                {errorCampo}
              </p>
            )}
            <Keypad
              onDigit={agregarDigito}
              onClear={() => setNumero('')}
              onBackspace={() => setNumero((n) => n.slice(0, -1))}
            />
            <div className="totem__actions">
              <Button loading={buscando} onClick={continuar}>
                {buscando ? (modalidad === 'sin-turno' ? 'Buscando sus datos…' : 'Buscando su turno…') : 'Continuar'}
              </Button>
              <Button variant="secondary" disabled={buscando} onClick={() => setPaso({ id: 'K11-servicio' })}>
                Volver
              </Button>
            </div>
          </section>
        );
      }

      case 'K03-confirmacion':
      case 'K08-registrando': {
        const registrando = paso.id === 'K08-registrando';
        return (
          <section className="totem__form">
            <h1 ref={tituloRef} tabIndex={-1} className="totem__title">
              {registrando ? 'Registrando su llegada' : 'Confirme su turno'}
            </h1>
            <p className="totem__subtitle">
              {registrando
                ? 'Espere un momento. Todavía no confirmamos el registro.'
                : 'Verifique los datos antes de registrar su llegada.'}
            </p>
            <TurnoDetalle turno={paso.turno} />
            {registrando && (
              <p className="totem__waiting">
                <span className="spinner spinner--lg" aria-hidden="true" /> No cierre esta pantalla.
              </p>
            )}
            <div className="totem__actions">
              <Button loading={registrando} onClick={() => registrar(paso.turno)}>
                {registrando ? 'Registrando llegada…' : 'Registrar llegada'}
              </Button>
              <Button
                variant="secondary"
                disabled={registrando}
                onClick={() => setPaso({ id: 'K02-ingreso' })}
              >
                Volver
              </Button>
            </div>
          </section>
        );
      }

      case 'K12-otro-servicio':
        return (
          <Resultado tituloRef={tituloRef} icon="alert-triangle" tono="warning" titulo="Su turno es de otro servicio">
            <p className="totem__lead totem__lead--dark">
              Eligió {servicio}, pero su turno de hoy es de <strong>{paso.turno.especialidad}</strong>.
            </p>
            <div className="totem__opciones">
              <Button loading={buscando} onClick={seguirConMiTurno}>
                Seguir con mi turno de {paso.turno.especialidad}
              </Button>
              <Button variant="secondary" disabled={buscando} onClick={() => setPaso({ id: 'K11-servicio' })}>
                Elegir otro servicio
              </Button>
            </div>
          </Resultado>
        );

      case 'K15-tiene-turno':
        return (
          <Resultado tituloRef={tituloRef} icon="calendar-check" tono="success" titulo="Usted tiene un turno hoy">
            <p className="totem__lead totem__lead--dark">
              Encontramos un turno de <strong>{paso.turno.especialidad}</strong> para hoy. Registre su llegada con ese turno.
            </p>
            <div className="totem__opciones">
              <Button loading={buscando} onClick={seguirConMiTurno}>
                Continuar con mi turno
              </Button>
              <Button variant="secondary" disabled={buscando} onClick={reiniciar}>
                Volver al inicio
              </Button>
            </div>
          </Resultado>
        );

      case 'K13-confirmar-demanda':
      case 'K14-registrando-demanda': {
        const registrando = paso.id === 'K14-registrando-demanda';
        return (
          <section className="totem__form">
            <h1 ref={tituloRef} tabIndex={-1} className="totem__title">
              {registrando ? 'Registrando su llegada' : 'Confirme sus datos'}
            </h1>
            <p className="totem__subtitle">
              {registrando
                ? 'Espere un momento. Todavía no confirmamos el registro.'
                : 'Lo vamos a anotar como paciente sin turno.'}
            </p>
            <dl className="turno-card">
              <dt className="visually-hidden">Paciente</dt>
              <dd className="turno-card__paciente">{paso.paciente}</dd>
              <dt>Servicio</dt>
              <dd>{servicio}</dd>
              <dt>Atención</dt>
              <dd>Sin turno · la secretaría le asigna el profesional</dd>
            </dl>
            {registrando && (
              <p className="totem__waiting">
                <span className="spinner spinner--lg" aria-hidden="true" /> No cierre esta pantalla.
              </p>
            )}
            <div className="totem__actions">
              <Button loading={registrando} onClick={() => registrarDemanda(paso.paciente)}>
                {registrando ? 'Registrando llegada…' : 'Registrar llegada'}
              </Button>
              <Button variant="secondary" disabled={registrando} onClick={() => setPaso({ id: 'K02-ingreso' })}>
                Volver
              </Button>
            </div>
          </section>
        );
      }

      case 'K04-registrada':
        return (
          <Resultado tituloRef={tituloRef} icon="check-circle" tono="success" titulo="Llegada registrada">
            <ResultCard admision={paso.admision} />
            <p className="totem__lead totem__lead--dark">Diríjase a la sala de espera y mire la pantalla de llamados.</p>
            <Button onClick={reiniciar}>Volver al inicio</Button>
          </Resultado>
        );

      case 'K07-ya-registrada':
        return (
          <Resultado tituloRef={tituloRef} icon="check-circle" tono="success" titulo="Ya está en espera">
            <ResultCard admision={paso.admision} />
            <p className="totem__lead totem__lead--dark">
              Su llegada ya estaba registrada. Su número es {paso.admision.numero}.
            </p>
            <Button onClick={reiniciar}>Volver al inicio</Button>
          </Resultado>
        );

      case 'K05-no-encontrado':
        return (
          <Resultado tituloRef={tituloRef} icon="search-x" tono="error" titulo="Revise su número">
            <p className="totem__lead totem__lead--dark">
              {modalidad === 'sin-turno'
                ? 'No encontramos sus datos de afiliado. Revise el número o solicite ayuda en secretaría.'
                : 'No encontramos su turno. Revise el número o solicite ayuda en secretaría.'}
            </p>
            <Button onClick={() => setPaso({ id: 'K02-ingreso' })}>Revisar número</Button>
            {modalidad === 'con-turno' && (
              <Button variant="secondary" onClick={() => elegirModalidad('sin-turno')}>
                No tengo turno
              </Button>
            )}
          </Resultado>
        );

      case 'K06-tolerancia':
        return (
          <Resultado tituloRef={tituloRef} icon="alert-triangle" tono="warning" titulo="Tolerancia vencida">
            <p className="totem__lead totem__lead--dark">
              Su turno fue cancelado porque pasaron más de 15 minutos del horario. Acérquese a secretaría para que le
              asignen un contraturno.
            </p>
            <Button onClick={reiniciar}>Volver al inicio</Button>
          </Resultado>
        );

      case 'K09-error': {
        const { turno, paciente } = paso;
        return (
          <Resultado tituloRef={tituloRef} icon="x-circle" tono="error" titulo="No pudimos registrar su llegada">
            <p className="totem__lead totem__lead--dark">
              No se pudo registrar su llegada. Intente nuevamente o solicite ayuda en secretaría. Su llegada aún no está
              confirmada.
            </p>
            <Button onClick={() => (turno ? registrar(turno) : paciente ? registrarDemanda(paciente) : reiniciar())}>Reintentar</Button>
            <p className="totem__small">También puede acercarse a secretaría.</p>
          </Resultado>
        );
      }

      case 'K10-sin-conexion':
        return (
          <Resultado tituloRef={tituloRef} icon="wifi-off" tono="error" titulo="No hay conexión">
            <p className="totem__lead totem__lead--dark">
              No podemos confirmar su llegada sin conexión. Acérquese a secretaría para recibir ayuda.
            </p>
            <Button onClick={reiniciar}>Volver al inicio</Button>
          </Resultado>
        );
    }
  }
}

type ResultadoProps = {
  icon: IconName;
  tono: 'success' | 'warning' | 'error';
  titulo: string;
  tituloRef: RefObject<HTMLHeadingElement>;
  children: ReactNode;
};

function Resultado({ icon, tono, titulo, tituloRef, children }: ResultadoProps) {
  return (
    <section className="totem__center">
      <Icon name={icon} size={96} className={`totem__status-icon totem__status-icon--${tono}`} />
      <h1 ref={tituloRef} tabIndex={-1} className="totem__title">
        {titulo}
      </h1>
      {children}
    </section>
  );
}
