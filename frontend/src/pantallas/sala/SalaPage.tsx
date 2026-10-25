import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { escucharCambios, hayConexion, obtenerSala, SinConexionError, type DatosSala } from '../../servicios/turnos';
import { hora } from '../../utilidades/fechas';
import './sala.css';

const CENTRO = 'Centro Villa Norte';
const ACTUALIZAR_CADA_MS = 4_000;

type Carga = 'cargando' | 'ok' | 'error' | 'sin-conexion';

/** Pantalla pública de la sala de espera (04 SALA DE ESPERA · T01–T05). Legible a 8 metros. */
export function SalaPage() {
  const [carga, setCarga] = useState<Carga>('cargando');
  const [datos, setDatos] = useState<DatosSala | null>(null);
  const [ahora, setAhora] = useState(new Date());
  const [nuevoLlamado, setNuevoLlamado] = useState(false);
  const ultimoNumero = useRef<string | null>(null);

  const actualizar = useCallback(async () => {
    if (!hayConexion()) return setCarga('sin-conexion');
    try {
      const d = await obtenerSala();
      // Destaca el número unos segundos cuando llega un llamado nuevo.
      const numero = d.actual?.numero ?? null;
      if (ultimoNumero.current !== null && numero && numero !== ultimoNumero.current) {
        setNuevoLlamado(true);
        window.setTimeout(() => setNuevoLlamado(false), 6_000);
      }
      ultimoNumero.current = numero;
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

  const sinConexion = carga === 'sin-conexion';
  const horaDatos = datos ? hora(datos.actualizadoEn) : null;
  const mostrarDatos = carga === 'ok' && datos;

  return (
    <div className="sala">
      <header className="sala__header">
        <span className="sala__logo">
          <Logo size={44} />
        </span>
        <span className="sala__centro">{CENTRO} · Sala de espera</span>
        <span className="sala__hora">{sinConexion && horaDatos ? `${horaDatos} · última actualización` : hora(ahora)}</span>
      </header>

      <main className="sala__main">
        <section className={`sala__panel sala__llamado ${nuevoLlamado && mostrarDatos ? 'sala__llamado--nuevo' : ''}`} aria-live="assertive" aria-atomic="true">
          {mostrarDatos && datos.actual ? (
            <>
              <span className="sala__llamado-etiqueta">
                <Icon name="megaphone" size={44} /> Llamando ahora
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
