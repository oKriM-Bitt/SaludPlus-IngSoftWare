import { useState, type FormEvent } from 'react';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import type { Sucursal } from '../../servicios/configuracion';
import { cambiar, slug } from './cambios';
import { Estado, useConfiguracion } from './comun';
import { useConfirmar } from '../../componentes/Confirmar';

/** #56 y #60: sucursales, con los enlaces para configurar el tótem y la sala de cada una. */
export function SeccionSucursales() {
  const config = useConfiguracion();
  const [editando, setEditando] = useState<Sucursal | 'nueva' | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar(); // #87

  const alternar = async (s: Sucursal) => {
    const activas = config.sucursales.filter((x) => x.activa).length;
    if (s.activa && activas === 1) return setAviso('Tiene que quedar al menos una sucursal activa.');
    if (s.activa) {
      const acepta = await confirmar({
        titulo: `¿Dar de baja ${s.nombre}?`,
        mensaje: 'Deja de aparecer en el ingreso, en el tótem y en la sala. Los datos se conservan y se puede reactivar.',
        aceptar: 'Dar de baja',
        peligro: true,
      });
      if (!acepta) return;
    }
    cambiar(`${s.activa ? 'Baja' : 'Reactivación'} de sucursal: ${s.nombre}`, (c) => ({ ...c, sucursales: c.sucursales.map((x) => (x.id === s.id ? { ...x, activa: !x.activa } : x)) }));
    setAviso(s.activa ? `${s.nombre} quedó de baja: ya no aparece en el ingreso ni en los equipos.` : `${s.nombre} se reactivó.`);
  };

  return (
    <section className="tarjeta">
      <div className="admin__encabezado">
        <h2>Sucursales · {config.sucursales.length}</h2>
        <Button className="btn--compacto" icon={<Icon name="building" size={20} />} onClick={() => setEditando('nueva')}>
          Nueva sucursal
        </Button>
      </div>
      {aviso && <Alerta tono="info" titulo={aviso} />}
      {editando && <FormularioSucursal sucursal={editando === 'nueva' ? undefined : editando} onListo={(t) => { setEditando(null); if (t) setAviso(t); }} />}

      <ul className="admin__lista">
        {config.sucursales.map((s) => (
          <li key={s.id} className="admin__item">
            <span className="admin__item-datos">
              <strong>
                {s.nombre} <span className="admin__prefijo">Números {s.prefijo}001…</span>
              </strong>
              <span>{s.direccion}</span>
              <span>
                {config.consultorios.filter((c) => c.sucursal === s.id && c.activo).length} consultorios ·{' '}
                {config.boxes.filter((b) => b.sucursal === s.id && b.activo).length} boxes
              </span>
            </span>
            <Estado activo={s.activa} textoActivo="Activa" textoBaja="De baja" />
            <span className="admin__acciones">
              {s.activa && (
                <>
                  <a className="link-boton" href={`/totem?sucursal=${s.id}`} target="_blank" rel="noreferrer">
                    <Icon name="hand" size={18} /> Abrir tótem
                  </a>
                  <a className="link-boton" href={`/sala?sucursal=${s.id}`} target="_blank" rel="noreferrer">
                    <Icon name="monitor" size={18} /> Abrir sala
                  </a>
                </>
              )}
              <button type="button" className="link-boton" onClick={() => setEditando(s)}>
                Editar
              </button>
              <button type="button" className={`link-boton ${s.activa ? 'link-boton--peligro' : ''}`} onClick={() => alternar(s)}>
                {s.activa ? 'Dar de baja' : 'Reactivar'}
              </button>
            </span>
          </li>
        ))}
      </ul>
      <p className="tarjeta__ayuda">
        Cada tótem y cada TV de sala se configuran una sola vez abriéndolos con el enlace de su sucursal: el equipo la recuerda.
      </p>
      {dialogo}
    </section>
  );
}

function FormularioSucursal({ sucursal, onListo }: { sucursal?: Sucursal; onListo: (aviso?: string) => void }) {
  const config = useConfiguracion();
  const [nombre, setNombre] = useState(sucursal?.nombre ?? '');
  const [direccion, setDireccion] = useState(sucursal?.direccion ?? '');
  const [prefijo, setPrefijo] = useState(sucursal?.prefijo ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    const p = prefijo.trim().toUpperCase();
    if (nombre.trim().length < 3) return setError('Escriba el nombre de la sucursal.');
    if (!/^[A-Z]$/.test(p)) return setError('El prefijo de los números es una sola letra, por ejemplo C.');
    if (config.sucursales.some((s) => s.prefijo === p && s.id !== sucursal?.id)) return setError('Otra sucursal ya usa esa letra: los números de la sala se confundirían.');
    if (sucursal) {
      cambiar(`Sucursal modificada: ${nombre.trim()}`, (c) => ({ ...c, sucursales: c.sucursales.map((s) => (s.id === sucursal.id ? { ...s, nombre: nombre.trim(), direccion: direccion.trim(), prefijo: p } : s)) }));
      onListo(`Se guardaron los cambios de ${nombre.trim()}.`);
    } else {
      const id = slug(nombre);
      if (!id || config.sucursales.some((s) => s.id === id)) return setError('Ya existe una sucursal con ese nombre.');
      cambiar(`Alta de sucursal: ${nombre.trim()}`, (c) => ({ ...c, sucursales: [...c.sucursales, { id, nombre: nombre.trim(), direccion: direccion.trim(), prefijo: p, activa: true }] }));
      onListo(`Se creó ${nombre.trim()}. Agregue sus consultorios y boxes, y asigne profesionales en la agenda.`);
    }
  };

  return (
    <form className="admin__form" onSubmit={guardar} noValidate>
      <h3>{sucursal ? `Editar ${sucursal.nombre}` : 'Nueva sucursal'}</h3>
      <div className="admin__campos">
        <div className="campo">
          <label htmlFor="su-nombre">Nombre</label>
          <input id="su-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="su-direccion">Dirección</label>
          <input id="su-direccion" className="input" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="su-prefijo">Letra de los números de orden</label>
          <input id="su-prefijo" className="input" maxLength={1} value={prefijo} onChange={(e) => setPrefijo(e.target.value.toUpperCase())} />
        </div>
      </div>
      {error && (
        <p className="campo__error" role="alert">
          <Icon name="x-circle" size={18} /> {error}
        </p>
      )}
      <div className="admin__botones">
        <Button variant="secondary" className="btn--compacto" onClick={() => onListo()}>
          Cancelar
        </Button>
        <Button type="submit" className="btn--compacto">
          {sucursal ? 'Guardar cambios' : 'Crear sucursal'}
        </Button>
      </div>
    </form>
  );
}
