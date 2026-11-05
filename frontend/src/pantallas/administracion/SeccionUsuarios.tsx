import { useState, type FormEvent } from 'react';
import { Icon } from '../../componentes/Icon';
import { Button } from '../../componentes/Button';
import { Alerta } from '../../componentes/Alerta';
import { nombreSucursal, profesionalPorId, type Rol, type UsuarioRegistrado } from '../../servicios/configuracion';
import { claveTemporal, minutosDeBloqueo, resumenClave } from '../../servicios/claves';
import { ETIQUETA_ROL } from '../../servicios/usuarios';
import { useUsuario } from '../../servicios/sesion';
import { cambiar } from './cambios';
import { Estado, useConfiguracion } from './comun';
import { useConfirmar } from '../../componentes/Confirmar';

type Edicion = { modo: 'nuevo' } | { modo: 'editar'; usuario: UsuarioRegistrado } | null;

/** #60 y #79: alta, modificación, baja, desbloqueo y restablecimiento de contraseña. */
export function SeccionUsuarios() {
  const config = useConfiguracion();
  const yo = useUsuario();
  const [edicion, setEdicion] = useState<Edicion>(null);
  const [aviso, setAviso] = useState<{ titulo: string; texto: string; clave?: string } | null>(null);
  const { confirmar, dialogo } = useConfirmar(); // #87

  const restablecer = async (u: UsuarioRegistrado) => {
    const acepta = await confirmar({
      titulo: `¿Restablecer la contraseña de ${u.nombre}?`,
      mensaje: 'Su contraseña actual deja de funcionar. Se genera una temporal que tendrá que cambiar al ingresar.',
      aceptar: 'Restablecer contraseña',
    });
    if (!acepta) return;
    const temporal = claveTemporal();
    const hash = await resumenClave(u.usuario, temporal);
    cambiar(`Contraseña restablecida: ${u.usuario}`, (c) => ({
      ...c,
      usuarios: c.usuarios.map((x) => (x.usuario === u.usuario ? { ...x, claveHash: hash, debeCambiarClave: true, intentosFallidos: 0, bloqueadoHasta: undefined } : x)),
    }), 'restablecer-clave');
    setAviso({ titulo: `Contraseña temporal de ${u.nombre}`, texto: 'Entréguesela en persona. Al ingresar, el sistema le pedirá que elija una propia. No se vuelve a mostrar.', clave: temporal });
  };

  const desbloquear = (u: UsuarioRegistrado) => {
    cambiar(`Usuario desbloqueado: ${u.usuario}`, (c) => ({ ...c, usuarios: c.usuarios.map((x) => (x.usuario === u.usuario ? { ...x, intentosFallidos: 0, bloqueadoHasta: undefined } : x)) }), 'desbloquear-usuario');
    setAviso({ titulo: `${u.nombre} ya puede ingresar`, texto: 'Se reiniciaron los intentos fallidos.' });
  };

  const alternarBaja = async (u: UsuarioRegistrado) => {
    if (u.activo) {
      const acepta = await confirmar({
        titulo: `¿Dar de baja a ${u.nombre}?`,
        mensaje: 'Ya no va a poder ingresar. Sus registros anteriores se conservan y se puede reactivar.',
        aceptar: 'Dar de baja',
        peligro: true,
      });
      if (!acepta) return;
    }
    cambiar(`${u.activo ? 'Baja' : 'Reactivación'} de usuario: ${u.usuario}`, (c) => ({ ...c, usuarios: c.usuarios.map((x) => (x.usuario === u.usuario ? { ...x, activo: !x.activo } : x)) }));
    setAviso({ titulo: u.activo ? `${u.nombre} quedó de baja` : `${u.nombre} se reactivó`, texto: u.activo ? 'Ya no puede ingresar. Sus registros anteriores se conservan.' : 'Puede volver a ingresar con su contraseña.' });
  };

  return (
    <section className="tarjeta">
      <div className="admin__encabezado">
        <h2>Usuarios · {config.usuarios.length}</h2>
        <Button className="btn--compacto" icon={<Icon name="user" size={20} />} onClick={() => setEdicion({ modo: 'nuevo' })}>
          Nuevo usuario
        </Button>
      </div>

      {aviso && (
        <Alerta tono="success" titulo={aviso.titulo}>
          {aviso.clave && (
            <>
              Contraseña temporal: <code className="admin__clave">{aviso.clave}</code>.{' '}
            </>
          )}
          {aviso.texto}
        </Alerta>
      )}

      {edicion && <FormularioUsuario edicion={edicion} onListo={(t) => { setEdicion(null); if (t) setAviso(t); }} />}

      <div className="tabla-caja">
        <table className="tabla">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Nombre</th>
              <th>Rol</th>
              <th>Sucursales</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {config.usuarios.map((u) => {
              const bloqueo = minutosDeBloqueo(u.bloqueadoHasta);
              const soyYo = yo?.usuario === u.usuario;
              return (
                <tr key={u.usuario}>
                  <td>
                    <code>{u.usuario}</code>
                  </td>
                  <td>
                    {u.nombre}
                    {u.profesional && <span className="admin__sub">{profesionalPorId(u.profesional)?.especialidad}</span>}
                  </td>
                  <td>{ETIQUETA_ROL[u.rol]}</td>
                  <td>{u.sucursales.map(nombreSucursal).join(', ')}</td>
                  <td>
                    {bloqueo > 0 ? (
                      <span className="admin__estado admin__estado--bloqueado">
                        <Icon name="lock" size={18} /> Bloqueado · {bloqueo} min
                      </span>
                    ) : (
                      <Estado activo={u.activo} />
                    )}
                    {u.debeCambiarClave && <span className="admin__sub">Debe cambiar la contraseña</span>}
                  </td>
                  <td>
                    <span className="admin__acciones">
                      <button type="button" className="link-boton" onClick={() => setEdicion({ modo: 'editar', usuario: u })}>
                        Editar
                      </button>
                      <button type="button" className="link-boton" onClick={() => restablecer(u)}>
                        Restablecer contraseña
                      </button>
                      {bloqueo > 0 && (
                        <button type="button" className="link-boton" onClick={() => desbloquear(u)}>
                          Desbloquear
                        </button>
                      )}
                      {!soyYo && (
                        <button type="button" className={`link-boton ${u.activo ? 'link-boton--peligro' : ''}`} onClick={() => alternarBaja(u)}>
                          {u.activo ? 'Dar de baja' : 'Reactivar'}
                        </button>
                      )}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {dialogo}
    </section>
  );
}

function FormularioUsuario({ edicion, onListo }: { edicion: NonNullable<Edicion>; onListo: (aviso?: { titulo: string; texto: string; clave?: string }) => void }) {
  const config = useConfiguracion();
  const base = edicion.modo === 'editar' ? edicion.usuario : undefined;
  const [usuario, setUsuario] = useState(base?.usuario ?? '');
  const [nombre, setNombre] = useState(base?.nombre ?? '');
  const [rol, setRol] = useState<Rol>(base?.rol ?? 'secretaria');
  const [sucursales, setSucursales] = useState<string[]>(base?.sucursales ?? [config.sucursales[0]?.id].filter(Boolean));
  const [profesional, setProfesional] = useState(base?.profesional ?? config.profesionales.find((p) => p.activo)?.id ?? '');
  const [error, setError] = useState<string | null>(null);

  const guardar = async (e: FormEvent) => {
    e.preventDefault();
    const id = usuario.trim().toLowerCase();
    if (!base && !/^[a-z][a-z0-9.]{2,19}$/.test(id)) return setError('El usuario debe tener entre 3 y 20 letras minúsculas o números, sin espacios, y empezar con una letra.');
    if (!base && config.usuarios.some((u) => u.usuario === id)) return setError('Ya existe un usuario con ese nombre.');
    if (nombre.trim().length < 3) return setError('Escriba el nombre y apellido.');
    if (sucursales.length === 0) return setError('Elija al menos una sucursal.');
    if (rol === 'profesional' && !profesional) return setError('Elija a qué profesional corresponde el usuario.');
    const datos = { nombre: nombre.trim(), rol, sucursales, profesional: rol === 'profesional' ? profesional : undefined };
    if (base) {
      cambiar(`Usuario modificado: ${base.usuario}`, (c) => ({ ...c, usuarios: c.usuarios.map((u) => (u.usuario === base.usuario ? { ...u, ...datos } : u)) }));
      onListo({ titulo: `Se guardaron los cambios de ${datos.nombre}`, texto: 'Se aplican la próxima vez que ingrese o cambie de sucursal.' });
    } else {
      const temporal = claveTemporal();
      const nuevo: UsuarioRegistrado = { usuario: id, ...datos, activo: true, claveHash: await resumenClave(id, temporal), debeCambiarClave: true };
      cambiar(`Alta de usuario: ${id} (${rol})`, (c) => ({ ...c, usuarios: [...c.usuarios, nuevo] }));
      onListo({ titulo: `Se creó el usuario ${id}`, texto: 'Entréguele la contraseña temporal en persona: al ingresar deberá elegir una propia.', clave: temporal });
    }
  };

  return (
    <form className="admin__form" onSubmit={guardar} noValidate>
      <h3>{base ? `Editar ${base.usuario}` : 'Nuevo usuario'}</h3>
      <div className="admin__campos">
        <div className="campo">
          <label htmlFor="us-usuario">Usuario</label>
          <input id="us-usuario" className="input" value={usuario} disabled={!!base} autoCapitalize="none" onChange={(e) => setUsuario(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="us-nombre">Nombre y apellido</label>
          <input id="us-nombre" className="input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        </div>
        <div className="campo">
          <label htmlFor="us-rol">Rol</label>
          <select id="us-rol" className="select" value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {(Object.keys(ETIQUETA_ROL) as Rol[]).map((r) => (
              <option key={r} value={r}>
                {ETIQUETA_ROL[r]}
              </option>
            ))}
          </select>
        </div>
        {rol === 'profesional' && (
          <div className="campo">
            <label htmlFor="us-profesional">Profesional</label>
            <select id="us-profesional" className="select" value={profesional} onChange={(e) => setProfesional(e.target.value)}>
              {config.profesionales
                .filter((p) => p.activo)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nombre} · {p.especialidad}
                  </option>
                ))}
            </select>
          </div>
        )}
      </div>
      <fieldset className="admin__checks">
        <legend>Sucursales en las que trabaja</legend>
        {config.sucursales.map((s) => (
          <label key={s.id} className="modal__opcion">
            <input
              type="checkbox"
              checked={sucursales.includes(s.id)}
              onChange={(e) => setSucursales((xs) => (e.target.checked ? [...xs, s.id] : xs.filter((x) => x !== s.id)))}
            />
            {s.nombre}
            {!s.activa && ' (de baja)'}
          </label>
        ))}
      </fieldset>
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
          {base ? 'Guardar cambios' : 'Crear usuario'}
        </Button>
      </div>
    </form>
  );
}
