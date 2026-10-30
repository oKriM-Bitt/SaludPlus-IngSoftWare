import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { escucharCambios, hayConexion, obtenerSala, SinConexionError, type DatosSala } from '../../servicios/turnos';
import { hora } from '../../utilidades/fechas';
import { audioBloqueado, guardarSonido, habilitarAudio, sonarLlamado, sonidoActivado } from '../../servicios/sonido';
import { sucursalDelEquipo } from '../../servicios/contexto';
import { nombreSucursal } from '../../servicios/configuracion';
import './sala.css';

const ACTUALIZAR_CADA_MS = 4_000;
const AVISO_MS = 8_000;

type Aviso = { numero: string; consultorio: string; repetido: boolean };

type Carga = 'cargando' | 'ok' | 'error' | 'sin-conexion';

/** Pantalla pública de la sala de espera (04 SALA DE ESPERA · T01–T05). Legible a 8 metros. */
export function SalaPage() {
  const [carga, setCarga] = useState<Carga>('cargando');
  const [datos, setDatos] = useState<DatosSala | null>(null);
  const [ahora, setAhora] = useState(new Date());
  const [nuevoLlamado, setNuevoLlamado] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [sonido, setSonido] = useState(sonidoActivado);
  const [bloqueado, setBloqueado] = useState(audioBloqueado);
  const ultimoLlamado = useRef<string | null>(null);
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;
  const temporizador = useRef<number>();

  const actualizar = useCallback(async () => {
    if (!hayConexion()) return setCarga('sin-conexion');
    try {
      const d = await obtenerSala();
      // #45: un llamado nuevo o repetido se destaca en grande y suena unos segundos.
      const clave = d.actual ? `${d.actual.numero}|${d.actual.llamadoEn}` : '';
      if (ultimoLlamado.current !== null && d.actual && clave !== ultimoLlamado.current) {
        setNuevoLlamado(true);
        setAviso({ numero: d.actual.numero, consultorio: d.actual.consultorio, repetido: d.actual.llamados > 1 });
        window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => {
          setNuevoLlamado(false);
          setAviso(null);
        }, AVISO_MS);
        if (sonidoRef.current) setBloqueado(!sonarLlamado());
      }
      ultimoLlamado.current = clave;
      setDatos(d);
      setCarga('ok');
    } catch (e) {
      setCarga(e instanceof SinConexionError ? 'sin-conexion' : 'error');
    }
  }, []);

  useEffect(() => {
    actualizar();
    const intervalo = window.setInterval(() => {
      setAhora(new Date());
      actualizar();
    }, ACTUALIZAR_CADA_MS);
    const dejar = escucharCambios(actualizar);
    window.addEventListener('online', actualizar);
    window.addEventListener('offline', actualizar);
    return () => {
      window.clearInterval(intervalo);
      dejar();
      window.removeEventListener('online', actualizar);
      window.removeEventListener('offline', actualizar);
    };
  }, [actualizar]);

  useEffect(() => () => window.clearTimeout(temporizador.current), []);

  const cambiarSonido = async () => {
    const activar = !sonido;
    setSonido(activar);
    guardarSonido(activar);
    if (activar) setBloqueado(!(await habilitarAudio()));
  };

  const habilitar = async () => {
    const ok = await habilitarAudio();
    setBloqueado(!ok);
    if (ok) sonarLlamado(1);
  };

  const sinConexion = carga === 'sin-conexion';
  const horaDatos = datos ? hora(datos.actualizadoEn) : null;
  const mostrarDatos = carga === 'ok' && datos;

  return (
    <div className="sala">
      <header className="sala__header">
        <span className="sala__logo">
          <Logo size={44} />
        </span>
        <span className="sala__centro">{nombreSucursal(sucursalDelEquipo())} · Sala de espera</span>
        <span className="sala__derecha">
          <button type="button" className="sala__sonido" aria-pressed={sonido} onClick={cambiarSonido}>
            <Icon name={sonido ? 'volume' : 'volume-off'} size={28} />
            {sonido ? 'Sonido activado' : 'Sonido silenciado'}
          </button>
          <span className="sala__hora">{sinConexion && horaDatos ? `${horaDatos} · última actualización` : hora(ahora)}</span>
        </span>
      </header>

      {sonido && bloqueado && (
        <button type="button" className="sala__habilitar" onClick={habilitar}>
          <Icon name="volume-off" size={32} />
          El navegador bloqueó el sonido de los llamados. Toque aquí para habilitarlo.
        </button>
      )}

      <main className="sala__main">
        <section className={`sala__panel sala__llamado ${nuevoLlamado && mostrarDatos ? 'sala__llamado--nuevo' : ''}`} aria-live="assertive" aria-atomic="true">
          {mostrarDatos && datos.actual ? (
            <>
              <span className="sala__llamado-etiqueta">
                <Icon name={datos.actual.llamados > 1 ? 'repeat' : 'megaphone'} size={44} />{' '}
                {datos.actual.llamados > 1 ? 'Llamando nuevamente' : 'Llamando ahora'}
              </span>
              <span className="sala__numero">{datos.actual.numero}</span>
              <span className="sala__consultorio">Consultorio {datos.actual.consultorio}</span>
            </>
          ) : (
            <Mensaje carga={carga} horaDatos={horaDatos} />
          )}
        </section>

        <aside className="sala__panel sala__esperas" aria-label="Espera estimada">
          <h2>Espera estimada</h2>
          {mostrarDatos ? (
            <>
              <dl>
                {datos.esperas.map((e) => (
                  <div key={e.especialidad}>
                    <dt>{e.especialidad}</dt>
                    <dd>{e.minutos > 0 ? `${e.minutos} min` : 'Sin espera'}</dd>
                  </div>
                ))}
              </dl>
              {datos.avisos.length > 0 && (
                <div className="sala__demora sala__aviso-prof" role="status">
                  <strong>
                    <Icon name="info" size={32} /> Aviso
                  </strong>
                  {datos.avisos.map((a) => (
                    <span key={a.consultorio}>{a.texto}</span>
                  ))}
                </div>
              )}
              {datos.demoras.length > 0 && (
                <div className="sala__demora" role="status">
                  <strong>
                    <Icon name="alert-triangle" size={32} /> Demora en atención
                  </strong>
                  {datos.demoras.map((d) => (
                    <span key={d.especialidad}>
                      {d.especialidad}: {d.minutos} minutos de demora.
                    </span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="sala__esperas-vacio">
              <Icon name={sinConexion ? 'wifi-off' : 'info'} size={44} />
              <p>{sinConexion ? 'Estimaciones no disponibles sin conexión.' : 'Las estimaciones se mostrarán cuando estén confirmadas.'}</p>
            </div>
          )}
        </aside>

        <section className="sala__historial" aria-label="Últimos llamados">
          <h2>{sinConexion && horaDatos ? `Datos anteriores · hasta las ${horaDatos}` : 'Últimos 4 llamados'}</h2>
          {datos && (carga === 'ok' || sinConexion) && (sinConexion ? [datos.actual, ...datos.anteriores].filter(Boolean).slice(0, 4) : datos.anteriores).length > 0 ? (
            <ul className="sala__lista">
              {(sinConexion ? [datos.actual!, ...datos.anteriores].filter(Boolean).slice(0, 4) : datos.anteriores).map((l) => (
                <li key={l.numero + l.llamadoEn}>
                  <strong>{l.numero}</strong>
                  <span>
                    Consultorio
                    <b>{l.consultorio}</b>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="sala__historial-vacio">
              <Icon name="info" size={36} />
              {carga === 'cargando'
                ? 'Consultando el historial de llamados…'
                : carga === 'error' || sinConexion
                  ? 'No hay llamados confirmados para mostrar.'
                  : 'Sin llamados anteriores.'}
            </p>
          )}
        </section>
      </main>

      {/* Aviso visual del llamado: repite lo que ya anuncia la zona aria-live del llamado. */}
      {aviso && mostrarDatos && (
        <div className="sala__aviso" aria-hidden="true" onClick={() => setAviso(null)}>
          <div className="sala__aviso-caja">
            <span className="sala__aviso-etiqueta">
              <Icon name={aviso.repetido ? 'repeat' : 'megaphone'} size={56} />
              {aviso.repetido ? 'Llamando nuevamente' : 'Llamando'}
            </span>
            <span className="sala__aviso-numero">{aviso.numero}</span>
            <span className="sala__aviso-consultorio">Consultorio {aviso.consultorio}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Mensaje({ carga, horaDatos }: { carga: Carga; horaDatos: string | null }) {
  if (carga === 'cargando')
    return (
      <div className="sala__mensaje">
        <span className="spinner sala__spinner" aria-hidden="true" />
        <h1>Actualizando llamados…</h1>
        <p>Espere un momento. No hay un llamado confirmado en pantalla.</p>
      </div>
    );
  if (carga === 'error')
    return (
      <div className="sala__mensaje">
        <Icon name="alert-triangle" size={96} />
        <h1>No podemos mostrar los llamados</h1>
        <p>Estamos intentando recuperar el servicio. Si necesita orientación, acérquese a secretaría.</p>
      </div>
    );
  if (carga === 'sin-conexion')
    return (
      <div className="sala__mensaje">
        <Icon name="wifi-off" size={96} />
        <h1>Sin conexión</h1>
        <p>{horaDatos ? `Última actualización ${horaDatos}. ` : ''}Los datos anteriores no son un llamado en vivo.</p>
        <p className="sala__mensaje-chico">Acérquese a secretaría para recibir orientación.</p>
      </div>
    );
  return (
    <div className="sala__mensaje">
      <Icon name="clock" size={96} />
      <h1>Todavía no hay llamados</h1>
      <p>Cuando lo llamen, verá su número y consultorio aquí.</p>
    </div>
  );
}
