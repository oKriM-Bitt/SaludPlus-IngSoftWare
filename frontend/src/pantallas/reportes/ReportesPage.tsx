import { useMemo, useState } from 'react';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { Indicador, PaginaInterna } from '../../componentes/PaginaInterna';
import { useUsuario } from '../../servicios/sesion';
import { nombreSucursal, profesionalesDelDia, sucursalesActivas } from '../../servicios/configuracion';
import { admisionesDelDia, resumenDeHoy, type Admision } from '../../servicios/turnos';
import { aCSV, ausentismo, diasDelPeriodo, historialSimulado, resumirDia, sumarFilas, type FilaReporte } from '../../servicios/reportes';
import { registrarAuditoria } from '../../servicios/auditoria';
import { hoy } from '../../servicios/almacen';
import { descargarArchivo } from '../../utilidades/descarga';

const PERIODOS = [
  { dias: 1, etiqueta: 'Hoy' },
  { dias: 7, etiqueta: 'Últimos 7 días' },
  { dias: 30, etiqueta: 'Últimos 30 días' },
];

const TODAS = '__todas__';

/** Filas de un día y una sucursal: hoy con los datos en vivo, antes con el historial simulado. */
function filasDelDia(fecha: string, sucursal: string, sucursalSesion: string): FilaReporte[] {
  const especialidades = [...new Set(profesionalesDelDia(sucursal).map((p) => p.especialidad))];
  if (fecha !== hoy()) return especialidades.map((e) => historialSimulado(fecha, sucursal, e));
  const profesionales = profesionalesDelDia(sucursal);
  const especialidadDe = (a: Admision) => a.servicio || profesionales.find((p) => p.nombre === a.profesional)?.especialidad || 'Sin especialidad';
  const resumen = sucursal === sucursalSesion ? resumenDeHoy() : resumirDia(admisionesDelDia(sucursal), especialidadDe);
  return Object.entries(resumen.porEspecialidad).map(([especialidad, ind]) => {
    const { enCurso: _enCurso, ...resto } = ind;
    return { fecha, sucursal, especialidad, ...resto };
  });
}

/** #78: indicadores por sucursal, especialidad y período, con exportación a Excel (CSV). */
export function ReportesPage() {
  const usuario = useUsuario()!;
  const [sucursal, setSucursal] = useState(usuario.sucursal);
  const [periodo, setPeriodo] = useState(7);
  const [especialidad, setEspecialidad] = useState('');
  const [exportado, setExportado] = useState<string | null>(null);

  const sucursales = sucursal === TODAS ? sucursalesActivas().map((s) => s.id) : [sucursal];
  const dias = diasDelPeriodo(hoy(), periodo);

  const filas = useMemo(
    () => dias.flatMap((d) => sucursales.flatMap((s) => filasDelDia(d, s, usuario.sucursal))).filter((f) => !especialidad || f.especialidad === especialidad),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sucursal, periodo, especialidad, usuario.sucursal],
  );

  const especialidades = [...new Set(sucursales.flatMap((s) => profesionalesDelDia(s).map((p) => p.especialidad)))].sort();
  const total = sumarFilas(filas);
  const aus = ausentismo(total);

  // Agrupa por sucursal y especialidad para la tabla.
  const grupos = new Map<string, FilaReporte[]>();
  for (const f of filas) {
    const k = `${f.sucursal}|${f.especialidad}`;
    grupos.set(k, [...(grupos.get(k) ?? []), f]);
  }
  const filasTabla = [...grupos.entries()]
    .map(([k, fs]) => ({ sucursal: k.split('|')[0], especialidad: k.split('|')[1], ...sumarFilas(fs) }))
    .sort((a, b) => a.sucursal.localeCompare(b.sucursal) || a.especialidad.localeCompare(b.especialidad));

  const exportar = () => {
    const nombre = `reporte-${sucursal === TODAS ? 'todas' : sucursal}-${periodo}d-${hoy()}.csv`;
    const conNombres = filas.map((f) => ({ ...f, sucursal: nombreSucursal(f.sucursal) }));
    descargarArchivo(nombre, aCSV(conNombres));
    registrarAuditoria({
      accion: 'exportacion',
      usuario: usuario.usuario,
      sucursal: sucursal === TODAS ? 'todas' : sucursal,
      detalle: `${PERIODOS.find((p) => p.dias === periodo)?.etiqueta} · ${especialidad || 'todas las especialidades'} · ${filas.length} filas`,
    });
    setExportado(nombre);
  };

  return (
    <PaginaInterna
      titulo="Reportes"
      subtitulo="Indicadores de atención por sucursal, especialidad y período."
      ancho="amplio"
      acciones={
        <Button icon={<Icon name="download" size={22} />} onClick={exportar} disabled={filas.length === 0}>
          Exportar a Excel
        </Button>
      }
    >
      <section className="tarjeta reportes__filtros" aria-label="Filtros">
        <div className="campo">
          <label htmlFor="rep-sucursal">Sucursal</label>
          <select id="rep-sucursal" className="select" value={sucursal} onChange={(e) => setSucursal(e.target.value)}>
            {sucursalesActivas().map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
            <option value={TODAS}>Todas las sucursales</option>
          </select>
        </div>
        <div className="campo">
          <label htmlFor="rep-periodo">Período</label>
          <select id="rep-periodo" className="select" value={periodo} onChange={(e) => setPeriodo(Number(e.target.value))}>
            {PERIODOS.map((p) => (
              <option key={p.dias} value={p.dias}>
                {p.etiqueta}
              </option>
            ))}
          </select>
        </div>
        <div className="campo">
          <label htmlFor="rep-especialidad">Especialidad</label>
          <select id="rep-especialidad" className="select" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)}>
            <option value="">Todas las especialidades</option>
            {especialidades.map((e) => (
              <option key={e}>{e}</option>
            ))}
          </select>
        </div>
      </section>

      {exportado && (
        <Alerta tono="success" titulo={`Se descargó ${exportado}`}>
          Se abre con Excel. No incluye nombres ni datos de salud, y la exportación quedó registrada en la auditoría.
        </Alerta>
      )}

      <section className="tarjeta" aria-labelledby="rep-totales">
        <h2 id="rep-totales">
          {sucursal === TODAS ? 'Todas las sucursales' : nombreSucursal(sucursal)} · {PERIODOS.find((p) => p.dias === periodo)?.etiqueta}
        </h2>
        <div className="indicadores">
          <Indicador valor={total.atendidos} etiqueta="Atendidos" tono="ok" />
          <Indicador valor={total.ausentes} etiqueta="Ausentes" tono={total.ausentes ? 'alerta' : undefined} />
          <Indicador valor={aus === null ? '—' : `${aus} %`} etiqueta="Ausentismo" />
          <Indicador valor={total.retirados} etiqueta="Se retiraron" />
          <Indicador valor={total.esperaPromedio === null ? '—' : `${total.esperaPromedio} min`} etiqueta="Espera promedio" />
          <Indicador valor={total.demandaEspontanea} etiqueta="Demanda espontánea" />
          <Indicador valor={total.derivaciones} etiqueta="Derivaciones" />
          <Indicador valor={total.canceladosTolerancia} etiqueta="Cancelados por tolerancia" />
        </div>
      </section>

      <section className="tarjeta" aria-labelledby="rep-detalle">
        <h2 id="rep-detalle">Detalle por {sucursal === TODAS ? 'sucursal y especialidad' : 'especialidad'}</h2>
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                {sucursal === TODAS && <th>Sucursal</th>}
                <th>Especialidad</th>
                <th className="num">Atendidos</th>
                <th className="num">Ausentes</th>
                <th className="num">Ausentismo</th>
                <th className="num">Se retiraron</th>
                <th className="num">Demanda espontánea</th>
                <th className="num">Derivaciones</th>
                <th className="num">Espera promedio</th>
              </tr>
            </thead>
            <tbody>
              {filasTabla.map((f) => {
                const a = ausentismo(f);
                return (
                  <tr key={`${f.sucursal}|${f.especialidad}`}>
                    {sucursal === TODAS && <td>{nombreSucursal(f.sucursal)}</td>}
                    <td>{f.especialidad}</td>
                    <td className="num">{f.atendidos}</td>
                    <td className="num">{f.ausentes}</td>
                    <td className="num">{a === null ? '—' : `${a} %`}</td>
                    <td className="num">{f.retirados}</td>
                    <td className="num">{f.demandaEspontanea}</td>
                    <td className="num">{f.derivaciones}</td>
                    <td className="num">{f.esperaPromedio === null ? '—' : `${f.esperaPromedio} min`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="tarjeta__ayuda">
          Hoy se muestra con los datos en vivo. Los días anteriores son datos simulados para la demostración; con el backend saldrán de la base de datos.
        </p>
      </section>
    </PaginaInterna>
  );
}
