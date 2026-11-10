import { useEffect, useRef, useState, type FormEvent } from 'react';
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
      {editando && <FormularioProfesional key={editando === 'nuevo' ? 'nuevo' : editando.id} profesional={editando === 'nuevo' ? undefined : editando} onListo={(t) => { setEditando(null); if (t) setAviso(t); }} />}

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

const TODA_LA_SEMANA_LABORAL = [1, 2, 3, 4, 5];

/** Dos franjas se pisan si comparten algún día y se superponen en horario. */
const sePisan = (a: Pick<Asignacion, 'dias' | 'desde' | 'hasta'>, b: Pick<Asignacion, 'dias' | 'desde' | 'hasta'>) =>
  a.dias.some((d) => b.dias.includes(d)) && a.desde < b.hasta && b.desde < a.hasta;

function Agenda({ profesional, asignaciones, onAviso }: { profesional: ProfesionalRegistrado; asignaciones: Asignacion[]; onAviso: (t: string) => void }) {
  const { confirmar, dialogo } = useConfirmar(); // #87
  const config = useConfiguracion();
  const consultorios = config.consultorios.filter((c) => c.activo && config.sucursales.find((s) => s.id === c.sucursal)?.activa !== false);
  const [editando, setEditando] = useState<Asignacion | null>(null);
  const [dias, setDias] = useState<number[]>(TODA_LA_SEMANA_LABORAL);
  const [desde, setDesde] = useState('08:00');
  const [hasta, setHasta] = useState('14:00');
  const [error, setError] = useState<string | null>(null);

  const franja = { dias, desde, hasta };
  /** Asignación de OTRO profesional que ocupa ese consultorio en la franja elegida. */
  const ocupacion = (consultorioId: string) =>
    config.asignaciones.find((a) => a.consultorio === consultorioId && a.profesional !== profesional.id && a.id !== editando?.id && sePisan(a, franja));
  const primeroLibre = () => consultorios.find((c) => !ocupacion(c.id))?.id ?? consultorios[0]?.id ?? '';
  const [consultorio, setConsultorio] = useState(primeroLibre);

  const describir = (a: Asignacion) => {
    const c = consultorioPorId(a.consultorio);
    return `${c ? `${nombreSucursal(c.sucursal)} · Consultorio ${c.numero}` : 'Consultorio de baja'} · ${a.dias.length === 7 ? 'Todos los días' : a.dias.map((d) => DIAS[d]).join(', ')} · ${a.desde} a ${a.hasta}`;
  };
  const nombreDe = (id: string) => config.profesionales.find((p) => p.id === id)?.nombre ?? 'otro profesional';

  const limpiar = () => {
    setEditando(null);
    setDias(TODA_LA_SEMANA_LABORAL);
    setDesde('08:00');
    setHasta('14:00');
    setError(null);
  };

  const editar = (a: Asignacion) => {
    setEditando(a);
    setConsultorio(a.consultorio);
    setDias(a.dias);
    setDesde(a.desde);
    setHasta(a.hasta);
    setError(null);
  };

  const guardar = (e: FormEvent) => {
    e.preventDefault();
    if (!consultorio) return setError('Elija un consultorio.');
    if (dias.length === 0) return setError('Elija al menos un día.');
    if (!desde || !hasta || desde >= hasta) return setError('La hora de fin debe ser posterior a la de inicio.');
    // Un consultorio no puede tener a dos profesionales a la misma hora del mismo día.
    const choque = ocupacion(consultorio);
    if (choque) return setError(`Ese consultorio ya está ocupado por ${nombreDe(choque.profesional)}: ${describir(choque)}. Elija otro consultorio u otro horario.`);
    // El profesional no puede estar en dos lugares a la vez.
    const propia = asignaciones.find((a) => a.id !== editando?.id && sePisan(a, franja));
    if (propia) return setError(`${profesional.nombre} ya atiende en ese horario: ${describir(propia)}. Edite o quite ese horario primero.`);

    const datos = { consultorio, dias: [...dias].sort((x, y) => x - y), desde, hasta };
    if (editando) {
      const nueva: Asignacion = { ...editando, ...datos };
      cambiar(`Agenda de ${profesional.nombre}: ${describir(editando)} → ${describir(nueva)}`, (c) => ({ ...c, asignaciones: c.asignaciones.map((x) => (x.id === editando.id ? nueva : x)) }));
      onAviso(`Se modificó la agenda de ${profesional.nombre}: ${describir(nueva)}.`);
    } else {
      const nueva: Asignacion = { id: `a-${profesional.id}-${Date.now()}`, profesional: profesional.id, ...datos };
      cambiar(`Agenda de ${profesional.nombre}: ${describir(nueva)}`, (c) => ({ ...c, asignaciones: [...c.asignaciones, nueva] }));
      onAviso(`Se agregó a la agenda de ${profesional.nombre}: ${describir(nueva)}.`);
    }
    limpiar();
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
    if (editando?.id === a.id) limpiar();
    onAviso(`Se quitó de la agenda de ${profesional.nombre}: ${describir(a)}.`);
  };

  return (
    <div className="admin__agenda">
      {asignaciones.length === 0 ? (
        <p className="tarjeta__ayuda">Sin agenda: no aparece en ninguna sucursal.</p>
      ) : (
        <ul>
          {asignaciones.map((a) => (
            <li key={a.id} className={editando?.id === a.id ? 'admin__agenda-editando' : undefined}>
              <span>{describir(a)}</span>
              <span className="admin__acciones">
                <button type="button" className="link-boton" onClick={() => (editando?.id === a.id ? limpiar() : editar(a))}>
                  {editando?.id === a.id ? 'Cancelar edición' : 'Editar'}
                </button>
                <button type="button" className="link-boton link-boton--peligro" onClick={() => quitar(a)}>
                  Quitar
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form className="admin__form" onSubmit={guardar} noValidate>
        <h3>{editando ? 'Modificar horario' : 'Agregar a la agenda'}</h3>
        <div className="admin__campos">
          <div className="campo">
            <label htmlFor={`ag-cons-${profesional.id}`}>Consultorio</label>
            <select id={`ag-cons-${profesional.id}`} className="select" value={consultorio} onChange={(e) => { setConsultorio(e.target.value); setError(null); }}>
              {consultorios.map((c) => {
                const ocupado = ocupacion(c.id);
                return (
                  <option key={c.id} value={c.id}>
                    {nombreSucursal(c.sucursal)} · Consultorio {c.numero}
                    {ocupado ? ` · Ocupado (${nombreDe(ocupado.profesional)})` : ' · Libre'}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="campo">
            <label htmlFor={`ag-desde-${profesional.id}`}>Desde</label>
            <input id={`ag-desde-${profesional.id}`} type="time" className="input" value={desde} onChange={(e) => { setDesde(e.target.value); setError(null); }} />
          </div>
          <div className="campo">
            <label htmlFor={`ag-hasta-${profesional.id}`}>Hasta</label>
            <input id={`ag-hasta-${profesional.id}`} type="time" className="input" value={hasta} onChange={(e) => { setHasta(e.target.value); setError(null); }} />
          </div>
        </div>
        <fieldset className="admin__checks admin__checks--fila">
          <legend>Días</legend>
          {DIAS.map((d, i) => (
            <label key={d} className="modal__opcion">
              <input
                type="checkbox"
                checked={dias.includes(i)}
                onChange={(e) => {
                  setError(null);
                  setDias((xs) => (e.target.checked ? [...xs, i] : xs.filter((x) => x !== i)));
                }}
              />{' '}
              {d}
            </label>
          ))}
        </fieldset>
        {error && (
          <p className="campo__error" role="alert">
            <Icon name="x-circle" size={18} /> {error}
          </p>
        )}
        <div className="admin__botones">
          {editando && (
            <Button variant="secondary" className="btn--compacto" onClick={limpiar}>
              Cancelar
            </Button>
          )}
          <Button type="submit" variant={editando ? 'primary' : 'secondary'} className="btn--compacto" icon={<Icon name="calendar-check" size={20} />}>
            {editando ? 'Guardar cambios' : 'Agregar a la agenda'}
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
  const formRef = useRef<HTMLFormElement>(null);
  // Se lleva el formulario a la vista: puede abrirse desde un profesional del final de la lista.
  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    formRef.current?.querySelector<HTMLInputElement>('#pr-nombre')?.focus({ preventScroll: true });
  }, []);

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
    <form ref={formRef} className="admin__form" onSubmit={guardar} noValidate>
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
