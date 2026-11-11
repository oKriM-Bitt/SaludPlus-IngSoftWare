import { useCallback, useEffect, useRef, useState } from 'react';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { escucharCambios, hayConexion, obtenerSala, SinConexionError, textoDestino, type DatosSala, type Llamado, type PantallaLlamados } from '../../servicios/turnos';
import { hora } from '../../utilidades/fechas';
import { audioBloqueado, guardarSonido, habilitarAudio, sonarLlamado, sonidoActivado } from '../../servicios/sonido';
import { anunciar, guardarVoz, vozActivada, vozDisponible } from '../../servicios/voz';
import { sucursalDelEquipo } from '../../servicios/contexto';
import { nombreSucursal } from '../../servicios/configuracion';
import './sala.css';

const ACTUALIZAR_CADA_MS = 4_000;
const AVISO_MS = 8_000;
/** DEV-61: la voz empieza después del ding-dong para que no se superpongan. */
const VOZ_DESPUES_DEL_SONIDO_MS = 2_300;

type Aviso = Pick<Llamado, 'numero' | 'lugar' | 'destino'> & { repetido: boolean };

type Carga = 'cargando' | 'ok' | 'error' | 'sin-conexion';

/**
 * Pantallas públicas de llamados, legibles a 8 metros (04 SALA DE ESPERA · T01–T05):
 * - sala: la TV de la sala de espera, con los llamados a consultorio.
 * - boxes: la TV de admisión, con los llamados a los boxes de la secretaría.
 */
export function SalaPage({ pantalla = 'sala' }: { pantalla?: PantallaLlamados }) {
  const deBoxes = pantalla === 'boxes';
  const [carga, setCarga] = useState<Carga>('cargando');
  const [datos, setDatos] = useState<DatosSala | null>(null);
  const [ahora, setAhora] = useState(new Date());
  const [nuevoLlamado, setNuevoLlamado] = useState(false);
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const [sonido, setSonido] = useState(sonidoActivado);
  const [bloqueado, setBloqueado] = useState(audioBloqueado);
  const [voz, setVoz] = useState(vozActivada);
  const hayVoz = vozDisponible();
  const ultimoLlamado = useRef<string | null>(null);
  const sonidoRef = useRef(sonido);
  sonidoRef.current = sonido;
  const vozRef = useRef(voz);
  vozRef.current = voz;
  const temporizador = useRef<number>();
  const temporizadorVoz = useRef<number>();

  const actualizar = useCallback(async () => {
    if (!hayConexion()) return setCarga('sin-conexion');
    try {
      const d = await obtenerSala(new Date(), pantalla);
      // #45: un llamado nuevo o repetido se destaca en grande y suena unos segundos.
      const clave = d.actual ? `${d.actual.lugar}|${d.actual.numero}|${d.actual.llamadoEn}` : '';
      if (ultimoLlamado.current !== null && d.actual && clave !== ultimoLlamado.current) {
        const llamado = d.actual;
        setNuevoLlamado(true);
        setAviso({ numero: llamado.numero, lugar: llamado.lugar, destino: llamado.destino, repetido: llamado.llamados > 1 });
        window.clearTimeout(temporizador.current);
        temporizador.current = window.setTimeout(() => {
          setNuevoLlamado(false);
          setAviso(null);
        }, AVISO_MS);
        const sono = sonidoRef.current && sonarLlamado();
        if (sonidoRef.current) setBloqueado(!sono);
        // DEV-61: también el llamado repetido se anuncia por voz. Solo número y destino, nunca el nombre.
        // Si el navegador no tiene voz, queda el aviso sonoro.
        window.clearTimeout(temporizadorVoz.current);
        if (vozRef.current) temporizadorVoz.current = window.setTimeout(() => anunciar(llamado), sono ? VOZ_DESPUES_DEL_SONIDO_MS : 0);
      }
      ultimoLlamado.current = clave;
      setDatos(d);
      setCarga('ok');
    } catch (e) {
      setCarga(e instanceof SinConexionError ? 'sin-conexion' : 'error');
    }
  }, [pantalla]);

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

  useEffect(
    () => () => {
      window.clearTimeout(temporizador.current);
      window.clearTimeout(temporizadorVoz.current);
    },
    [],
  );

  /** DEV-61: activar o silenciar la voz desde la configuración de la sala. */
  const cambiarVoz = () => {
    const activar = !voz;
    setVoz(activar);
    guardarVoz(activar);
  };

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

  // En la TV, el primer toque o la primera tecla del control remoto en cualquier parte de la pantalla
  // también habilita el sonido (el aviso queda tapado unos segundos mientras se muestra un llamado).
  useEffect(() => {
    if (!sonido || !bloqueado) return;
    const desbloquear = () => {
      habilitarAudio().then((ok) => setBloqueado(!ok));
    };
    window.addEventListener('pointerdown', desbloquear);
    window.addEventListener('keydown', desbloquear);
    return () => {
      window.removeEventListener('pointerdown', desbloquear);
      window.removeEventListener('keydown', desbloquear);
    };
  }, [sonido, bloqueado]);

  const sinConexion = carga === 'sin-conexion';
  const horaDatos = datos ? hora(datos.actualizadoEn) : null;
  const mostrarDatos = carga === 'ok' && datos;

  return (
    <div className="sala">
      <header className="sala__header">
        <span className="sala__logo">
          <Logo size={44} />
        </span>
        <span className="sala__centro">{nombreSucursal(sucursalDelEquipo())} · {deBoxes ? 'Admisión · Boxes' : 'Sala de espera'}</span>
        <span className="sala__derecha">
          <button type="button" className="sala__sonido" aria-pressed={sonido} onClick={cambiarSonido}>
            <Icon name={sonido ? 'volume' : 'volume-off'} size={28} />
            {sonido ? 'Sonido activado' : 'Sonido silenciado'}
          </button>
          {hayVoz ? (
            <button type="button" className="sala__sonido" aria-pressed={voz} onClick={cambiarVoz}>
              <Icon name={voz ? 'megaphone' : 'volume-off'} size={28} />
              {voz ? 'Voz activada' : 'Voz silenciada'}
            </button>
          ) : (
            <span className="sala__sonido sala__sin-voz" title="Este navegador no tiene voz. Se mantiene el aviso sonoro.">
              <Icon name="info" size={24} /> Sin voz: solo sonido
            </span>
          )}
          <span className="sala__hora">{sinConexion && horaDatos ? `${horaDatos} · última actualización` : hora(ahora)}</span>
        </span>
      </header>

      {/* DEV-55: avisos de la secretaría, en una franja propia arriba: siempre visibles y sin tapar el número llamado. */}
      {mostrarDatos && datos.generales.length > 0 && (
        <section className="sala__generales" aria-label="Avisos del centro" role="status">
          <Icon name="info" size={40} />
          <ul>
            {datos.generales.map((g) => (
              <li key={g.id}>{g.texto}</li>
            ))}
          </ul>
        </section>
      )}

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
              <span className="sala__consultorio">{textoDestino(datos.actual)}</span>
            </>
          ) : (
            <Mensaje carga={carga} horaDatos={horaDatos} deBoxes={deBoxes} />
          )}
        </section>

        {deBoxes ? (
          <aside className="sala__panel sala__esperas" aria-label="Boxes de admisión">
            <h2>Boxes de admisión</h2>
            {mostrarDatos ? (
              <>
                <dl>
                  {datos.boxes.map((b) => (
                    <div key={b.numero}>
                      <dt>Box {b.numero}</dt>
                      <dd className={b.atendiendo ? '' : 'sala__box-libre'}>{b.atendiendo ?? (b.abierto ? 'Disponible' : 'Cerrado')}</dd>
                    </div>
                  ))}
                </dl>
                <div className="sala__esperan" role="status">
                  <Icon name="users" size={40} />
                  <span>
                    <b>{datos.esperanBox}</b>
                    {datos.esperanBox === 1 ? 'persona espera ser llamada' : 'personas esperan ser llamadas'}
                  </span>
                </div>
              </>
            ) : (
              <div className="sala__esperas-vacio">
                <Icon name={sinConexion ? 'wifi-off' : 'info'} size={44} />
                <p>{sinConexion ? 'El estado de los boxes no está disponible sin conexión.' : 'El estado de los boxes se mostrará en un momento.'}</p>
              </div>
            )}
          </aside>
        ) : (
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
                    <span key={a.consultorio + a.texto}>{a.texto}</span>
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
        )}

        <section className="sala__historial" aria-label="Últimos llamados">
          <h2>{sinConexion && horaDatos ? `Datos anteriores · hasta las ${horaDatos}` : 'Últimos llamados'}</h2>
          {datos && (carga === 'ok' || sinConexion) && (sinConexion ? [datos.actual, ...datos.anteriores].filter(Boolean).slice(0, 4) : datos.anteriores).length > 0 ? (
            <ul className="sala__lista">
              {(sinConexion ? [datos.actual!, ...datos.anteriores].filter(Boolean).slice(0, 4) : datos.anteriores).map((l) => (
                <li key={l.lugar + l.numero + l.llamadoEn}>
                  <strong>{l.numero}</strong>
                  <span>
                    {l.lugar === 'box' ? 'Box' : 'Consultorio'}
                    <b>{l.destino}</b>
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
            <span className="sala__aviso-consultorio">{textoDestino(aviso)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Mensaje({ carga, horaDatos, deBoxes }: { carga: Carga; horaDatos: string | null; deBoxes: boolean }) {
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
      <p>Cuando lo llamen, verá su número y {deBoxes ? 'el box al que tiene que pasar' : 'consultorio'} aquí.</p>
    </div>
  );
}
