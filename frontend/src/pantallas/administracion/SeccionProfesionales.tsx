import { useState, type FormEvent } from 'react';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { consultorioPorId, nombreSucursal, type Asignacion, type ProfesionalRegistrado } from '../../servicios/configuracion';
import { cambiar, DIAS, slug } from './cambios';
import { Estado, useConfiguracion } from './comun';
import { useConfirmar } from '../../componentes/Confirmar';

/** #60: profesionales y en qué consultorio atiende cada uno, qué días y en qué horario. */
export function SeccionProfesionales() {
  const config = useConfiguracion();
  const [editando, setEditando] = useState<ProfesionalRegistrado | 'nuevo' | null>(null);
  const [agenda, setAgenda] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const { confirmar, dialogo } = useConfirmar(); // #87

  const alternar = async (p: ProfesionalRegistrado) => {
    if (p.activo) {
      const acepta = await confirmar({
        titulo: `¿Dar de baja a ${p.nombre}?`,
        mensaje: 'Deja de aparecer en las colas, en el ingreso y en la sala. Sus atenciones anteriores se conservan y se puede reactivar.',
        aceptar: 'Dar de baja',
        peligro: true,
      });
      if (!acepta) return;
    }
    cambiar(`${p.activo ? 'Baja' : 'Reactivación'} de profesional: ${p.nombre}`, (c) => ({ ...c, profesionales: c.profesionales.map((x) => (x.id === p.id ? { ...x, activo: !x.activo } : x)) }));
    setAviso(p.activo ? `${p.nombre} quedó de baja: deja de aparecer en las colas y en la sala. Sus atenciones anteriores se conservan.` : `${p.nombre} se reactivó.`);
  };

  return (
    <section className="tarjeta">
      <div className="admin__encabezado">
        <h2>Profesionales · {config.profesionales.length}</h2>
        <Button className="btn--compacto" icon={<Icon name="user-check" size={20} />} onClick={() => setEditando('nuevo')}>
          Nuevo profesional
        </Button>
      </div>
      {aviso && <Alerta tono="info" titulo={aviso} />}
      {editando && <FormularioProfesional profesional={editando === 'nuevo' ? undefined : editando} onListo={(t) => { setEditando(null); if (t) setAviso(t); }} />}

      <ul className="admin__lista">
        {config.profesionales.map((p) => {
          const asignaciones = config.asignaciones.filter((a) => a.profesional === p.id);
          return (
            <li key={p.id} className="admin__item admin__item--columna">
              <div className="admin__item-fila">
                <span className="admin__item-datos">
                  <strong>{p.nombre}</strong>
                  <span>{p.especialidad}</span>
                </span>
                <Estado activo={p.activo} />
                <span className="admin__acciones">
                  <button type="button" className="link-boton" aria-expanded={agenda === p.id} onClick={() => setAgenda(agenda === p.id ? null : p.id)}>
                    Agenda ({asignaciones.length})
                  </button>
                  <button type="button" className="link-boton" onClick={() => setEditando(p)}>
                    Editar
                  </button>
                  <button type="button" className={`link-boton ${p.activo ? 'link-boton--peligro' : ''}`} onClick={() => alternar(p)}>
                    {p.activo ? 'Dar de baja' : 'Reactivar'}
                  </button>
                </span>
              </div>
              {agenda === p.id && <Agenda profesional={p} asignaciones={asignaciones} onAviso={setAviso} />}
            </li>
          );
        })}
      </ul>
      {dialogo}
    </section>
  );
}

function Agenda({ profesional, asignaciones, onAviso }: { profesional: ProfesionalRegistrado; asignaciones: Asignacion[]; onAviso: (t: string) => void }) {
  const { confirmar, dialogo } = useConfirmar(); // #87
  const config = useConfiguracion();
  const consultorios = config.consultorios.filter((c) => c.activo);
  const [consultorio, setConsultorio] = useState(consultorios[0]?.id ?? '');
  const [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5]);
  const [desde, setDesde] = useState('08:00');
  const [hasta, setHasta] = useState('14:00');
  const [error, setError] = useState<string | null>(null);

  const describir = (a: Asignacion) => {
    const c = consultorioPorId(a.consultorio);
    return `${c ? `${nombreSucursal(c.sucursal)} · Consultorio ${c.numero}` : 'Consultorio de baja'} · ${a.dias.length === 7 ? 'Todos los días' : a.dias.map((d) => DIAS[d]).join(', ')} · ${a.desde} a ${a.hasta}`;
  };

  const agregar = (e: FormEvent) => {
    e.preventDefault();
    if (!consultorio) return setError('Elija un consultorio.');
    if (dias.length === 0) return setError('Elija al menos un día.');
    if (desde >= hasta) return setError('La hora de fin debe ser posterior a la de inicio.');
    // Un consultorio no puede tener a dos profesionales a la misma hora del mismo día.
    const choque = config.asignaciones.find(
      (a) => a.consultorio === consultorio && a.profesional !== profesional.id && a.dias.some((d) => dias.includes(d)) && a.desde < hasta && desde < a.hasta,
    );
    if (choque) return setError(`Ese consultorio ya está ocupado en ese horario: ${describir(choque)}.`);
    const nueva: Asignacion = { id: `a-${profesional.id}-${Date.now()}`, profesional: profesional.id, consultorio, dias: [...dias].sort(), desde, hasta };
    cambiar(`Agenda de ${profesional.nombre}: ${describir(nueva)}`, (c) => ({ ...c, asignaciones: [...c.asignaciones, nueva] }));
    setError(null);
    onAviso(`Se agregó a la agenda de ${profesional.nombre}: ${describir(nueva)}.`);
  };

  const quitar = async (a: Asignacion) => {
    const acepta = await confirmar({
      titulo: '¿Quitar de la agenda?',
      mensaje: `${profesional.nombre} deja de atender en ${describir(a)}.`,
      aceptar: 'Quitar de la agenda',
      peligro: true,
    });
    if (!acepta) return;
    cambiar(`Agenda de ${profesional.nombre}: se quitó ${describir(a)}`, (c) => ({ ...c, asignaciones: c.asignaciones.filter((x) => x.id !== a.id) }));
    onAviso(`Se quitó de la agenda de ${profesional.nombre}: ${describir(a)}.`);
  };

  return (
    <div className="admin__agenda">
      {asignaciones.length === 0 ? (
        <p className="tarjeta__ayuda">Sin agenda: no aparece en ninguna sucursal.</p>
      ) : (
        <ul>
          {asignaciones.map((a) => (
            <li key={a.id}>
              <span>{describir(a)}</span>
              <button type="button" className="link-boton link-boton--peligro" onClick={() => quitar(a)}>
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="admin__form" onSubmit={agregar} noValidate>
        <h3>Agregar a la agenda</h3>
        <div className="admin__campos">
          <div className="campo">
            <label htmlFor={`ag-cons-${profesional.id}`}>Consultorio</label>
            <select id={`ag-cons-${profesional.id}`} className="select" value={consultorio} onChange={(e) => setConsultorio(e.target.value)}>
              {consultorios.map((c) => (
                <option key={c.id} value={c.id}>
                  {nombreSucursal(c.sucursal)} · Consultorio {c.numero}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor={`ag-desde-${profesional.id}`}>Desde</label>
            <input id={`ag-desde-${profesional.id}`} type="time" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          </div>
          <div className="campo">
            <label htmlFor={`ag-hasta-${profesional.id}`}>Hasta</label>
            <input id={`ag-hasta-${profesional.id}`} type="time" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          </div>
        </div>
        <fieldset className="admin__checks admin__checks--fila">
          <legend>Días</legend>
          {DIAS.map((d, i) => (
            <label key={d} className="modal__opcion">
              <input type="checkbox" checked={dias.includes(i)} onChange={(e) => setDias((xs) => (e.target.checked ? [...xs, i] : xs.filter((x) => x !== i)))} /> {d}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="campo__error" role="alert">
            <Icon name="x-circle" size={18} /> {error}
          </p>
        )}
        <div className="admin__botones">
          <Button type="submit" variant="secondary" className="btn--compacto" icon={<Icon name="calendar-check" size={20} />}>
            Agregar a la agenda
          </Button>
        </div>
      </form>
      {dialogo}
    </div>
  );
}

function FormularioProfesional({ profesional, onListo }: { profesional?: ProfesionalRegistrado; onListo: (aviso?: string) => void }) {
  const config = useConfiguracion();
  const [nombre, setNombre] = useState(profesional?.nombre ?? '');
  const [especialidad, setEspecialidad] = useState(profesional?.especialidad ?? '');
  const [error, setError] = useState<string | null>(null);
  const especialidades = [...new Set(config.profesionales.map((p) => p.especialidad))].sort();

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (nombre.trim().length < 5) return setError('Escriba el nombre con su título, por ejemplo: Dra. Ana Pérez.');
    if (especialidad.trim().length < 3) return setError('Escriba la especialidad.');
    if (profesional) {
      cambiar(`Profesional modificado: ${nombre.trim()}`, (c) => ({ ...c, profesionales: c.profesionales.map((p) => (p.id === profesional.id ? { ...p, nombre: nombre.trim(), especialidad: especialidad.trim() } : p)) }));
      onListo(`Se guardaron los cambios de ${nombre.trim()}.`);
    } else {
      const id = `p-${slug(nombre)}`;
      if (config.profesionales.some((p) => p.id === id)) return setError('Ya existe un profesional con ese nombre.');
      cambiar(`Alta de profesional: ${nombre.trim()} (${especialidad.trim()})`, (c) => ({ ...c, profesionales: [...c.profesionales, { id, nombre: nombre.trim(), especialidad: especialidad.trim(), activo: true }] }));
      onListo(`Se creó ${nombre.trim()}. Cárguele la agenda para que aparezca en una sucursal.`);
    }
  };

  return (
    <form className="admin__form" onSubmit={guardar} noValidate>
      <h3>{profesional ? `Editar ${profesional.nombre}` : 'Nuevo profesional'}</h3>
      <div className="admin__campos">
        <div className="campo">
          <label htmlFor="pr-nombre">Nombre</label>
          <input id="pr-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="pr-especialidad">Especialidad</label>
          <input id="pr-especialidad" className="input" list="pr-especialidades" value={especialidad} onChange={(e) => setEspecialidad(e.target.value)} />
          <datalist id="pr-especialidades">
            {especialidades.map((e) => (
              <option key={e} value={e} />
            ))}
          </datalist>
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
          {profesional ? 'Guardar cambios' : 'Crear profesional'}
        </Button>
      </div>
    </form>
  );
}
