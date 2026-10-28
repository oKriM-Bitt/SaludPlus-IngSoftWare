import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { StatusChip } from '../../componentes/StatusChip';
import { MenuUsuario } from '../../componentes/MenuUsuario';
import { TiempoEspera } from '../../componentes/TiempoEspera';
import { useUsuario } from '../../servicios/sesion';
import {
  escucharCambios,
  finalizarAtencion,
  hayConexion,
  LLAMADOS_ANTES_DE_AUSENTE,
  llamarSiguiente,
  marcarAusente,
  obtenerCola,
  profesionalPorConsultorio,
  SinConexionError,
  volverALlamar,
  type ColaConsultorio,
} from '../../servicios/turnos';
import { fechaLarga, hora, minutosEntre } from '../../utilidades/fechas';
import './profesional.css';

const CENTRO = 'Centro Villa Norte';
const ACTUALIZAR_CADA_MS = 5_000;

type Accion = 'llamando' | 'rellamando' | 'finalizando' | 'ausente';

type Estado =
  | { tipo: 'cargando' } // P04
  | { tipo: 'error' } // P05
  | { tipo: 'sin-conexion' } // P06
  | { tipo: 'datos'; cola: ColaConsultorio }; // P01, P02 o P03

export function ProfesionalPage() {
  const usuario = useUsuario();
  // El profesional ve siempre su consultorio; dirección puede elegirlo por la dirección web.
  const consultorio =
    usuario?.rol === 'profesional' && usuario.consultorio
      ? usuario.consultorio
      : new URLSearchParams(window.location.search).get('consultorio') ?? '4';
  const datos = profesionalPorConsultorio(consultorio);

  const [estado, setEstado] = useState<Estado>({ tipo: 'cargando' });
  const [accion, setAccion] = useState<Accion | null>(null);
  const [confirmacion, setConfirmacion] = useState<string | null>(null);
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

  // La confirmación de la última acción desaparece sola.
  useEffect(() => {
    if (!confirmacion) return;
    const t = window.setTimeout(() => setConfirmacion(null), 6_000);
    return () => window.clearTimeout(t);
  }, [confirmacion]);

  const ejecutar = async (tipo: Accion, operacion: () => Promise<unknown>, aviso?: string) => {
    ocupado.current = true;
    setAccion(tipo);
    setConfirmacion(null);
    let ok = false;
    try {
      await operacion();
      ok = true;
    } catch (e) {
      setEstado(e instanceof SinConexionError ? { tipo: 'sin-conexion' } : { tipo: 'error' });
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
  const proximo = cola?.enEspera[0] ?? null;
  const esperando = cola ? cola.enEspera.length : null;
  const mayorEspera = cola && cola.enEspera.length > 0 ? Math.max(...cola.enEspera.map((a) => minutosEntre(a.registradaEn, ahora))) : null;
  const llamados = enAtencion?.llamados ?? 1;
  const puedeMarcarAusente = llamados >= LLAMADOS_ANTES_DE_AUSENTE;
  const textoSinConexion = ultimaActualizacion
    ? `Sin conexión – última actualización ${hora(ultimaActualizacion)}`
    : 'Sin conexión';

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
                    Llegada {hora(proximo!.registradaEn)} · turno {hora(proximo!.horaTurno)} · en espera{' '}
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

        {enAtencion ? (
          <div className="prof__acciones">
            <Button
              className="prof__accion"
              icon={<Icon name="check" size={40} />}
              loading={accion === 'finalizando'}
              disabled={accion !== null && accion !== 'finalizando'}
              onClick={() => ejecutar('finalizando', () => finalizarAtencion(enAtencion))}
            >
              {accion === 'finalizando' ? 'Finalizando…' : 'Finalizar atención'}
            </Button>
            <div className="prof__secundarias">
              <Button
                variant="secondary"
                className="prof__secundaria"
                icon={<Icon name="repeat" size={28} />}
                loading={accion === 'rellamando'}
                disabled={accion !== null && accion !== 'rellamando'}
                onClick={() =>
                  ejecutar('rellamando', () => volverALlamar(enAtencion), `Se volvió a llamar a ${enAtencion.numero} en la pantalla de sala.`)
                }
              >
                {accion === 'rellamando' ? 'Llamando…' : 'Llamar nuevamente'}
              </Button>
              <Button
                variant="secondary"
                className="prof__secundaria"
                icon={<Icon name="user-x" size={28} />}
                loading={accion === 'ausente'}
                disabled={!puedeMarcarAusente || (accion !== null && accion !== 'ausente')}
                aria-describedby={puedeMarcarAusente ? undefined : 'prof-ayuda-ausente'}
                onClick={() => ejecutar('ausente', () => marcarAusente(enAtencion), `${enAtencion.numero} quedó como ausente. La secretaría lo ve en la cola.`)}
              >
                {accion === 'ausente' ? 'Registrando…' : 'No se presentó'}
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
            disabled={!proximo}
            onClick={() => ejecutar('llamando', () => llamarSiguiente(consultorio))}
          >
            {estado.tipo === 'cargando' ? 'Consultando…' : accion === 'llamando' ? 'Llamando…' : 'Llamar al siguiente'}
          </Button>
        )}

        <footer className="prof__footer">
          <span>{usuario?.centro ?? CENTRO}</span>
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
