import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { StatusChip } from '../../componentes/StatusChip';
import { useConfirmar } from '../../componentes/Confirmar';
import { Indicador, PaginaInterna } from '../../componentes/PaginaInterna';
import { useUsuario } from '../../servicios/sesion';
import {
  cerrarDia,
  cierreDeHoy,
  escucharCambios,
  especialidadDe,
  pendientesDelDia,
  reabrirDia,
  resumenDeHoy,
  SinConexionError,
  type Admision,
  type Cierre,
} from '../../servicios/turnos';
import { aCSV, ausentismo, type FilaReporte, type ResumenDia } from '../../servicios/reportes';
import { registrarAuditoria } from '../../servicios/auditoria';
import { hoy } from '../../servicios/almacen';
import { fechaLarga, hora, minutosEntre } from '../../utilidades/fechas';
import { descargarArchivo } from '../../utilidades/descarga';
import './cierre.css';

type Decision = 'no-atendido' | 'reprogramado';

/** #69: cierre del día de la sucursal, con los pendientes y el resumen de la jornada. */
export function CierrePage() {
  const usuario = useUsuario()!;
  const { confirmar, dialogo } = useConfirmar(); // #87
  const [cierre, setCierre] = useState<Cierre | null>(() => cierreDeHoy());
  const [pendientes, setPendientes] = useState<Admision[]>(() => pendientesDelDia());
  const [resumen, setResumen] = useState<ResumenDia>(() => resumenDeHoy());
  const [decisiones, setDecisiones] = useState<Record<string, Decision>>({});
  const [confirmo, setConfirmo] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Se actualiza si otra pestaña registra llegadas o cierra el día.
  useEffect(() => {
    const recargar = () => {
      setCierre(cierreDeHoy());
      setPendientes(pendientesDelDia());
      setResumen(resumenDeHoy());
    };
    const intervalo = window.setInterval(recargar, 10_000);
    const dejar = escucharCambios(recargar);
    return () => {
      window.clearInterval(intervalo);
      dejar();
    };
  }, [usuario.sucursal]);

  const decisionDe = (a: Admision): Decision => decisiones[a.turnoId] ?? 'no-atendido';
  const marcarTodos = (d: Decision) => setDecisiones(Object.fromEntries(pendientes.map((a) => [a.turnoId, d])));

  const cerrar = async () => {
    if (!confirmo) return setError('Confirme que entiende que después del cierre no se registran llegadas.');
    setEnviando(true);
    setError(null);
    try {
      const c = await cerrarDia(Object.fromEntries(pendientes.map((a) => [a.turnoId, decisionDe(a)])));
      setCierre(c);
      setPendientes([]);
      setResumen(c.resumen);
    } catch (e) {
      setError(e instanceof SinConexionError ? 'Sin conexión: el día no se cerró. Intente al recuperar la red.' : 'No se pudo cerrar el día. Intente nuevamente.');
    } finally {
      setEnviando(false);
    }
  };

  const reabrir = async () => {
    const acepta = await confirmar({
      titulo: '¿Reabrir el día?',
      mensaje: 'Se vuelven a registrar llegadas en la sucursal y el cierre de hoy queda sin efecto hasta que lo cierre de nuevo.',
      aceptar: 'Reabrir el día',
    });
    if (!acepta) return;
    setEnviando(true);
    await reabrirDia();
    setCierre(null);
    setPendientes(pendientesDelDia());
    setResumen(resumenDeHoy());
    setConfirmo(false);
    setEnviando(false);
  };

  const descargar = () => {
    const filas: FilaReporte[] = Object.entries((cierre?.resumen ?? resumen).porEspecialidad).map(([especialidad, ind]) => {
      const { enCurso: _enCurso, ...resto } = ind;
      return { fecha: hoy(), sucursal: usuario.centro, especialidad, ...resto };
    });
    descargarArchivo(`resumen-${hoy()}-${usuario.sucursal}.csv`, aCSV(filas));
    registrarAuditoria({ accion: 'exportacion', usuario: usuario.usuario, sucursal: usuario.sucursal, detalle: 'Resumen del día' });
  };

  const datos = cierre?.resumen ?? resumen;

  return (
    <PaginaInterna
      titulo="Cierre del día"
      subtitulo={`${usuario.centro} · ${fechaLarga(new Date())}`}
      volver={{ ruta: usuario.rol === 'direccion' ? '/inicio' : '/secretaria', texto: usuario.rol === 'direccion' ? 'Volver al inicio' : 'Volver a admisión' }}
      acciones={
        <Button variant="secondary" icon={<Icon name="download" size={22} />} onClick={descargar}>
          Descargar resumen
        </Button>
      }
    >
      {cierre ? (
        <Alerta tono="success" titulo={`Día cerrado a las ${hora(cierre.cerradoEn)}`}>
          Cerró {cierre.usuario}. Ya no se registran llegadas en esta sucursal por hoy.
          {usuario.rol === 'direccion' && (
            <button type="button" className="link-boton cierre__reabrir" onClick={reabrir} disabled={enviando}>
              Reabrir el día
            </button>
          )}
        </Alerta>
      ) : (
        <section className="tarjeta" aria-labelledby="cierre-pendientes">
          <h2 id="cierre-pendientes">Pacientes que siguen en la cola · {pendientes.length}</h2>
          {pendientes.length === 0 ? (
            <p className="vacio">
              <Icon name="check-circle" size={24} /> No quedan pacientes en espera ni en atención.
            </p>
          ) : (
            <>
              <p className="tarjeta__ayuda">Antes de cerrar, indique qué pasa con cada uno. Por defecto quedan como "No atendido".</p>
              <div className="cierre__todos">
                <span>Marcar todos como:</span>
                <button type="button" className="link-boton" onClick={() => marcarTodos('no-atendido')}>
                  No atendido
                </button>
                <button type="button" className="link-boton" onClick={() => marcarTodos('reprogramado')}>
                  Reprogramado por el proveedor
                </button>
              </div>
              <div className="tabla-caja">
                <table className="tabla">
                  <thead>
                    <tr>
                      <th>Número</th>
                      <th>Paciente</th>
                      <th>Profesional</th>
                      <th>Estado</th>
                      <th className="num">Espera</th>
                      <th>Estado final</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendientes.map((a) => (
                      <tr key={a.turnoId}>
                        <td>
                          <strong>{a.numero}</strong>
                        </td>
                        <td>{a.paciente}</td>
                        <td>{a.profesional || `Sin asignar · ${especialidadDe(a)}`}</td>
                        <td>
                          <StatusChip estado={a.estado === 'llamado' ? 'llamado' : 'en-espera'} />
                        </td>
                        <td className="num">{minutosEntre(a.registradaEn, new Date())} min</td>
                        <td>
                          <label className="visually-hidden" htmlFor={`final-${a.turnoId}`}>
                            Estado final de {a.numero}
                          </label>
                          <select
                            id={`final-${a.turnoId}`}
                            className="select"
                            value={decisionDe(a)}
                            onChange={(e) => setDecisiones((d) => ({ ...d, [a.turnoId]: e.target.value as Decision }))}
                          >
                            <option value="no-atendido">No atendido</option>
                            <option value="reprogramado">Reprogramado por el proveedor</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          <label className="confirmacion">
            <input type="checkbox" checked={confirmo} onChange={(e) => setConfirmo(e.target.checked)} />
            Entiendo que después del cierre no se pueden registrar llegadas en {usuario.centro} por hoy.
          </label>
          {error && (
            <p className="campo__error" role="alert">
              <Icon name="x-circle" size={18} /> {error}
            </p>
          )}
          <Button className="cierre__btn" icon={<Icon name="calendar-check" size={24} />} loading={enviando} onClick={cerrar}>
            {enviando ? 'Cerrando…' : 'Cerrar el día'}
          </Button>
        </section>
      )}

      <section className="tarjeta" aria-labelledby="cierre-resumen">
        <h2 id="cierre-resumen">{cierre ? 'Resumen de la jornada' : 'Resumen hasta ahora'}</h2>
        <Resumen resumen={datos} />
      </section>

      {usuario.rol === 'direccion' && (
        <p className="tarjeta__ayuda">
          Para ver otros días o todas las sucursales, vaya a <Link to="/reportes">Reportes</Link>.
        </p>
      )}
      {dialogo}
    </PaginaInterna>
  );
}

export function Resumen({ resumen }: { resumen: ResumenDia }) {
  const t = resumen.total;
  const aus = ausentismo(t);
  const especialidades = Object.entries(resumen.porEspecialidad).sort(([a], [b]) => a.localeCompare(b));
  return (
    <>
      <div className="indicadores">
        <Indicador valor={t.atendidos} etiqueta="Atendidos" tono="ok" />
        <Indicador valor={t.ausentes} etiqueta="Ausentes" tono={t.ausentes ? 'alerta' : undefined} />
        <Indicador valor={t.retirados} etiqueta="Se retiraron" />
        <Indicador valor={t.noAtendidos} etiqueta="No atendidos al cierre" />
        <Indicador valor={t.esperaPromedio === null ? '—' : `${t.esperaPromedio} min`} etiqueta="Espera promedio" />
        <Indicador valor={aus === null ? '—' : `${aus} %`} etiqueta="Ausentismo" />
        <Indicador valor={t.derivaciones} etiqueta="Derivaciones" />
        <Indicador valor={t.enCurso} etiqueta="En espera o en atención" />
      </div>
      <div className="tabla-caja">
        <table className="tabla">
          <thead>
            <tr>
              <th>Especialidad</th>
              <th className="num">Atendidos</th>
              <th className="num">Ausentes</th>
              <th className="num">Se retiraron</th>
              <th className="num">No atendidos</th>
              <th className="num">Cancelados por tolerancia</th>
              <th className="num">Espera promedio</th>
            </tr>
          </thead>
          <tbody>
            {especialidades.map(([esp, i]) => (
              <tr key={esp}>
                <td>{esp}</td>
                <td className="num">{i.atendidos}</td>
                <td className="num">{i.ausentes}</td>
                <td className="num">{i.retirados}</td>
                <td className="num">{i.noAtendidos}</td>
                <td className="num">{i.canceladosTolerancia}</td>
                <td className="num">{i.esperaPromedio === null ? '—' : `${i.esperaPromedio} min`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="tarjeta__ayuda">No incluye nombres ni datos de salud. La espera se mide desde la llegada hasta el primer llamado.</p>
    </>
  );
}
