import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon, type IconName } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import {
  buscarTurno,
  registrarLlegada,
  SinConexionError,
  type Admision,
  type Turno,
} from '../../servicios/turnos';
import { Stepper } from './Stepper';
import { Keypad } from './Keypad';
import { TurnoDetalle } from './TurnoDetalle';
import { ResultCard } from './ResultCard';
import './totem.css';

const CENTRO = 'Centro Villa Norte';
const MAX_DIGITOS = 11;
const MIN_DIGITOS = 7;
const INACTIVIDAD_MS = 45_000;

type Paso =
  | { id: 'K01-bienvenida' }
  | { id: 'K02-ingreso' }
  | { id: 'K03-confirmacion'; turno: Turno }
  | { id: 'K08-registrando'; turno: Turno }
  | { id: 'K04-registrada'; admision: Admision }
  | { id: 'K05-no-encontrado' }
  | { id: 'K06-tolerancia' }
  | { id: 'K07-ya-registrada'; admision: Admision }
  | { id: 'K09-error'; turno: Turno }
  | { id: 'K10-sin-conexion' };

const pasoDelStepper: Record<Paso['id'], 1 | 2 | 3 | null> = {
  'K01-bienvenida': null,
  'K02-ingreso': 1,
  'K05-no-encontrado': 1,
  'K03-confirmacion': 2,
  'K08-registrando': 2,
  'K04-registrada': 3,
  'K06-tolerancia': 3,
  'K07-ya-registrada': 3,
  'K09-error': 3,
  'K10-sin-conexion': 3,
};

export function TotemPage() {
  const [paso, setPaso] = useState<Paso>({ id: 'K01-bienvenida' });
  const [numero, setNumero] = useState('');
  const [errorCampo, setErrorCampo] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const tituloRef = useRef<HTMLHeadingElement>(null);

  const reiniciar = useCallback(() => {
    setNumero('');
    setErrorCampo(null);
    setBuscando(false);
    setPaso({ id: 'K01-bienvenida' });
  }, []);

  // Lleva el foco al título en cada cambio de pantalla (lectores de pantalla y teclado).
  useEffect(() => {
    tituloRef.current?.focus();
  }, [paso.id]);

  // Tótem compartido: si nadie lo usa, vuelve a la bienvenida.
  useEffect(() => {
    if (paso.id === 'K01-bienvenida' || paso.id === 'K08-registrando') return;
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

  const agregarDigito = (d: string) => {
    setErrorCampo(null);
    setNumero((n) => (n.length < MAX_DIGITOS ? n + d : n));
  };

  const continuar = async () => {
    if (!numero) return setErrorCampo('Ingrese su número de documento o de afiliado.');
    if (numero.length < MIN_DIGITOS) return setErrorCampo(`El número debe tener al menos ${MIN_DIGITOS} dígitos.`);
    setBuscando(true);
    try {
      const r = await buscarTurno(numero);
      if (r.tipo === 'encontrado') setPaso({ id: 'K03-confirmacion', turno: r.turno });
      else if (r.tipo === 'no-encontrado') setPaso({ id: 'K05-no-encontrado' });
      else if (r.tipo === 'tolerancia-vencida') setPaso({ id: 'K06-tolerancia' });
      else setPaso({ id: 'K07-ya-registrada', admision: r.admision });
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
            <p className="totem__lead">Si ya tiene un turno, registre su llegada aquí. No necesita usar un celular.</p>
            <Button icon={<Icon name="arrow-right" size={28} />} onClick={() => setPaso({ id: 'K02-ingreso' })}>
              Comenzar
            </Button>
            <div className="totem__hint">
              <strong>Tenga a mano su DNI o número de afiliado.</strong>
              <span>Si necesita ayuda, acérquese a secretaría.</span>
            </div>
          </section>
        );

      case 'K02-ingreso':
        return (
          <section className="totem__form">
            <h1 ref={tituloRef} tabIndex={-1} className="totem__title">
              Ingrese su número
            </h1>
            <p className="totem__subtitle">Escríbalo sin puntos ni espacios.</p>
            <label htmlFor="documento" className="totem__label">
              DNI o número de afiliado
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
                {buscando ? 'Buscando su turno…' : 'Continuar'}
              </Button>
              <Button variant="secondary" disabled={buscando} onClick={reiniciar}>
                Volver
              </Button>
            </div>
          </section>
        );

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
              No encontramos su turno. Revise el número o solicite ayuda en secretaría.
            </p>
            <Button onClick={() => setPaso({ id: 'K02-ingreso' })}>Revisar número</Button>
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

      case 'K09-error':
        return (
          <Resultado tituloRef={tituloRef} icon="x-circle" tono="error" titulo="No pudimos registrar su llegada">
            <p className="totem__lead totem__lead--dark">
              No se pudo registrar su llegada. Intente nuevamente o solicite ayuda en secretaría. Su llegada aún no está
              confirmada.
            </p>
            <Button onClick={() => registrar(paso.turno)}>Reintentar</Button>
            <p className="totem__small">También puede acercarse a secretaría.</p>
          </Resultado>
        );

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
