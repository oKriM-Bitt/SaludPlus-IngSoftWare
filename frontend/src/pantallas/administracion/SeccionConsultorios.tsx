import { useState, type FormEvent } from 'react';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { profesionalPorId } from '../../servicios/configuracion';
import { useUsuario } from '../../servicios/sesion';
import { cambiar } from './cambios';
import { Estado, useConfiguracion } from './comun';

type Tipo = 'consultorios' | 'boxes';

/** #60: consultorios y boxes de admisión de cada sucursal. Se dan de baja, no se borran. */
export function SeccionConsultorios() {
  const config = useConfiguracion();
  const yo = useUsuario();
  const [sucursal, setSucursal] = useState(yo?.sucursal ?? config.sucursales[0]?.id ?? '');
  const [aviso, setAviso] = useState<string | null>(null);

  const agregar = (tipo: Tipo, numero: string) => {
    const lista = config[tipo];
    if (lista.some((x) => x.sucursal === sucursal && x.numero === numero)) return `Ya existe el ${tipo === 'boxes' ? 'box' : 'consultorio'} ${numero} en esta sucursal.`;
    const id = `${sucursal}-${tipo === 'boxes' ? 'b' : 'c'}${numero}`;
    cambiar(`Alta de ${tipo === 'boxes' ? 'box' : 'consultorio'} ${numero} en ${sucursal}`, (c) => ({ ...c, [tipo]: [...c[tipo], { id, sucursal, numero, activo: true }] }));
    setAviso(`Se agregó el ${tipo === 'boxes' ? 'box' : 'consultorio'} ${numero}.`);
    return null;
  };

  const alternar = (tipo: Tipo, id: string) => {
    const x = config[tipo].find((y) => y.id === id)!;
    cambiar(`${x.activo ? 'Baja' : 'Reactivación'} de ${tipo === 'boxes' ? 'box' : 'consultorio'} ${x.numero} en ${sucursal}`, (c) => ({ ...c, [tipo]: c[tipo].map((y) => (y.id === id ? { ...y, activo: !y.activo } : y)) }));
    setAviso(`${tipo === 'boxes' ? 'Box' : 'Consultorio'} ${x.numero} ${x.activo ? 'dado de baja' : 'reactivado'}.`);
  };

  const quienAtiende = (consultorioId: string) =>
    config.asignaciones
      .filter((a) => a.consultorio === consultorioId)
      .map((a) => profesionalPorId(a.profesional)?.nombre)
      .filter(Boolean)
      .join(', ');

  return (
    <section className="tarjeta">
      <div className="admin__encabezado">
        <h2>Consultorios y boxes</h2>
        <div className="campo admin__selector">
          <label htmlFor="co-sucursal">Sucursal</label>
          <select id="co-sucursal" className="select" value={sucursal} onChange={(e) => setSucursal(e.target.value)}>
            {config.sucursales.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre}
              </option>
            ))}
          </select>
        </div>
      </div>
      {aviso && <Alerta tono="info" titulo={aviso} />}
      <div className="admin__dos">
        {(['consultorios', 'boxes'] as Tipo[]).map((tipo) => (
          <div key={tipo} className="admin__bloque">
            <h3>{tipo === 'consultorios' ? 'Consultorios' : 'Boxes de admisión'}</h3>
            <ul className="admin__lista">
              {config[tipo]
                .filter((x) => x.sucursal === sucursal)
                .sort((a, b) => Number(a.numero) - Number(b.numero) || a.numero.localeCompare(b.numero))
                .map((x) => (
                  <li key={x.id} className="admin__item">
                    <span className="admin__item-datos">
                      <strong>
                        {tipo === 'consultorios' ? 'Consultorio' : 'Box'} {x.numero}
                      </strong>
                      {tipo === 'consultorios' && <span>{quienAtiende(x.id) || 'Sin profesional en la agenda'}</span>}
                    </span>
                    <Estado activo={x.activo} />
                    <button type="button" className={`link-boton ${x.activo ? 'link-boton--peligro' : ''}`} onClick={() => alternar(tipo, x.id)}>
                      {x.activo ? 'Dar de baja' : 'Reactivar'}
                    </button>
                  </li>
                ))}
            </ul>
            <AgregarNumero etiqueta={tipo === 'consultorios' ? 'Número de consultorio' : 'Número de box'} onAgregar={(n) => agregar(tipo, n)} />
          </div>
        ))}
      </div>
    </section>
  );
}

function AgregarNumero({ etiqueta, onAgregar }: { etiqueta: string; onAgregar: (numero: string) => string | null }) {
  const [numero, setNumero] = useState('');
  const [error, setError] = useState<string | null>(null);
  const id = etiqueta.replace(/\s/g, '-').toLowerCase();
  const enviar = (e: FormEvent) => {
    e.preventDefault();
    const n = numero.trim();
    if (!/^[0-9A-Za-z]{1,4}$/.test(n)) return setError('Use hasta 4 letras o números.');
    const problema = onAgregar(n);
    if (problema) return setError(problema);
    setNumero('');
    setError(null);
  };
  return (
    <form className="admin__agregar" onSubmit={enviar} noValidate>
      <div className="campo">
        <label htmlFor={id}>{etiqueta}</label>
        <input id={id} className="input" value={numero} onChange={(e) => setNumero(e.target.value)} />
      </div>
      <Button type="submit" variant="secondary" className="btn--compacto" icon={<Icon name="check" size={20} />}>
        Agregar
      </Button>
      {error && (
        <p className="campo__error" role="alert">
          <Icon name="x-circle" size={18} /> {error}
        </p>
      )}
    </form>
  );
}
