import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '../../components/Logo';
import { Icon } from '../../components/Icon';
import { Button } from '../../components/Button';
import { StatusChip } from '../../components/StatusChip';
import {
  escucharCambios,
  finalizarAtencion,
  hayConexion,
  llamarSiguiente,
  obtenerCola,
  profesionalPorConsultorio,
  SinConexionError,
  type ColaConsultorio,
} from '../../services/turnos';
import { fechaLarga, hora, minutosEntre } from '../../utils/fechas';
import './profesional.css';

const CENTRO = 'Centro Villa Norte';
const ACTUALIZAR_CADA_MS = 5_000;

type Estado =
  | { tipo: 'cargando' } // P04
  | { tipo: 'error' } // P05
  | { tipo: 'sin-conexion' } // P06
  | { tipo: 'datos'; cola: ColaConsultorio }; // P01, P02 o P03

export function ProfesionalPage() {
  const consultorio = new URLSearchParams(window.location.search).get('consultorio') ?? '4';
  const datos = profesionalPorConsultorio(consultorio);

  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [accion, setAccion] = useState<'llamando' | 'finalizando' | null>(null);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [ahora, setAhora] = useState(new Date());
  const ocupado = useRef(false);

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

  // Actualización periódica, al cambiar la cola en otra pestaña y al volver la conexión.
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

  const ejecutar = async (tipo: 'llamando' | 'finalizando', operacion: () => Promise<unknown>) => {
    ocupado.current = true;
    setAccion(tipo);
    try {
      await operacion();
    } catch (e) {
      setEstado(e instanceof SinConexionError ? { tipo: 'sin-conexion' } : { tipo: 'error' });
    } finally {
      ocupado.current = false;
      setAccion(null);
      setAhora(new Date());
      actualizar();
    }
  };

  const cola = estado.tipo === 'datos' ? estado.cola : null;
  const sinConexion = estado.tipo === 'sin-conexion';
  const enAtencion = cola?.enAtencion ?? null;
  const proximo = cola?.enEspera[0] ?? null;
  const esperando = cola ? cola.enEspera.length : null;
  const textoSinConexion = ultimaActualizacion
    ? `Sin conexión – última actualización ${hora(ultimaActualizacion)}`
    : 'Sin conexión';

  return (
    <div className="prof">
      <header className="prof__header">
        <Logo size={40} />
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
      </header>

      <main className="prof__main">
        <div className="prof__titulo">
          <div>
            <h1>Consultorio {consultorio}</h1>
            <p>
              {datos.nombre} · {datos.especialidad}
            </p>
          </div>
          <div className="prof__contador" aria-live="polite">
            <strong>{esperando ?? '—'}</strong>
            <span>pacientes esperando</span>
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
                {enAtencion
                  ? `Llegada confirmada · llamado a las ${hora(enAtencion.llamadoEn ?? ahora)}`
                  : `Llegada ${hora(proximo!.registradaEn)} · turno ${hora(proximo!.horaTurno)} · ${minutosEntre(proximo!.registradaEn, ahora)} minutos de espera`}
              </span>
            </div>
          )}
        </section>

        {enAtencion ? (
          <Button
            className="prof__accion"
            icon={<Icon name="check" size={40} />}
            loading={accion === 'finalizando'}
            onClick={() => ejecutar('finalizando', () => finalizarAtencion(enAtencion))}
          >
            {accion === 'finalizando' ? 'Finalizando…' : 'Finalizar atención'}
          </Button>
        ) : (
          <Button
            className={`prof__accion ${estado.tipo === 'cargando' ? 'prof__accion--consultando' : ''}`}
            icon={<Icon name="megaphone" size={40} />}
            loading={estado.tipo === 'cargando' || accion === 'llamando'}
            disabled={!proximo}
            onClick={() => ejecutar('llamando', () => llamarSiguiente(consultorio))}
          >
            {estado.tipo === 'cargando' ? 'Consultando…' : accion === 'llamando' ? 'Llamando…' : 'Llamar al siguiente'}
          </Button>
        )}

        <footer className="prof__footer">
          <span>{CENTRO}</span>
          <span>{sinConexion ? 'Datos no actualizados' : `${fechaLarga(ahora)} · ${hora(ahora)}`}</span>
        </footer>
      </main>
    </div>
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
