import { useEffect, useState } from 'react';
import { ETIQUETA_ACCION, obtenerAuditoria, CLAVE_AUDITORIA } from '../../servicios/auditoria';
import { escucharClaves } from '../../servicios/almacen';
import { nombreSucursal } from '../../servicios/configuracion';
import { escucharConfiguracion } from '../../servicios/configuracion';
import { hora } from '../../utilidades/fechas';

/** RF-09: consulta de la auditoría. Solo lectura: no se puede editar ni borrar. */
export function SeccionAuditoria() {
  const [registros, setRegistros] = useState(() => obtenerAuditoria());
  const [accion, setAccion] = useState('');

  useEffect(() => {
    const recargar = () => setRegistros(obtenerAuditoria());
    const a = escucharClaves([CLAVE_AUDITORIA], recargar);
    const b = escucharConfiguracion(recargar);
    return () => {
      a();
      b();
    };
  }, []);

  const acciones = [...new Set(registros.map((r) => r.accion))].sort();
  const lista = registros.filter((r) => !accion || r.accion === accion).slice(-200).reverse();

  return (
    <section className="tarjeta">
      <div className="admin__encabezado">
        <h2>Auditoría · {registros.length} registros</h2>
        <div className="campo admin__selector">
          <label htmlFor="au-accion">Acción</label>
          <select id="au-accion" className="select" value={accion} onChange={(e) => setAccion(e.target.value)}>
            <option value="">Todas</option>
            {acciones.map((a) => (
              <option key={a} value={a}>
                {ETIQUETA_ACCION[a] ?? a}
              </option>
            ))}
          </select>
        </div>
      </div>
      {lista.length === 0 ? (
        <p className="vacio">Todavía no hay registros. Inicie sesión, derive un paciente o cambie un parámetro para verlos aquí.</p>
      ) : (
        <div className="tabla-caja">
          <table className="tabla">
            <thead>
              <tr>
                <th>Fecha y hora</th>
                <th>Usuario</th>
                <th>Acción</th>
                <th>Sucursal</th>
                <th>Detalle</th>
              </tr>
            </thead>
            <tbody>
              {lista.map((r, i) => (
                <tr key={`${r.fecha}-${i}`}>
                  <td>
                    {new Date(r.fecha).toLocaleDateString('es-AR')} {hora(r.fecha)}
                  </td>
                  <td>
                    <code>{r.usuario}</code>
                  </td>
                  <td>{ETIQUETA_ACCION[r.accion] ?? r.accion}</td>
                  <td>{r.sucursal ? (r.sucursal === 'todas' ? 'Todas' : nombreSucursal(r.sucursal)) : '—'}</td>
                  <td>
                    {[r.numero && `N.º ${r.numero}`, r.detalle, Array.isArray(r.saltados) && `Antes en la cola: ${(r.saltados as string[]).join(', ')}`].filter(Boolean).join(' · ') || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="tarjeta__ayuda">Se muestran los últimos 200. Los pacientes se identifican solo por su número de orden.</p>
    </section>
  );
}
