import { Link, useSearchParams } from 'react-router-dom';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Alerta } from '../../componentes/Alerta';
import { MenuUsuario } from '../../componentes/MenuUsuario';
import { useUsuario } from '../../servicios/sesion';
import { destinosPorRol, ETIQUETA_ROL } from '../../servicios/usuarios';
import { profesionalesDelDia } from '../../servicios/configuracion';
import './inicio.css';

/** Menú principal (#48): muestra solo las pantallas que corresponden al rol. */
export function InicioPage() {
  const usuario = useUsuario()!;
  const [params] = useSearchParams();
  const destinos = destinosPorRol(usuario, profesionalesDelDia(usuario.sucursal));
  // Profesional: una sola opción, centrada y grande para que la pantalla no quede vacía.
  const unica = destinos.length === 1;

  return (
    <div className="inicio">
      <header className="inicio__header">
        <Logo size={40} />
        <MenuUsuario />
      </header>
      <main className={`inicio__main ${unica ? 'inicio__main--unica' : ''}`}>
        <div className="inicio__titulo">
          <h1>Hola, {usuario.nombre}</h1>
          <p>
            {ETIQUETA_ROL[usuario.rol]} · {usuario.centro}. Elija a dónde quiere ir.
          </p>
        </div>
        {params.get('sin-permiso') && (
          <Alerta tono="warning" titulo="No tiene permiso para abrir esa pantalla">
            Se muestran solo las opciones de su rol.
          </Alerta>
        )}
        <ul className={`inicio__grilla ${unica ? 'inicio__grilla--unica' : ''}`}>
          {destinos.map((d) => {
            const contenido = (
              <>
                <span className="inicio__icono">
                  <Icon name={d.icono} size={unica ? 56 : 32} />
                </span>
                <span className="inicio__texto">
                  <strong>{d.titulo}</strong>
                  <span>{d.descripcion}</span>
                </span>
                {unica ? (
                  <span className="inicio__entrar">
                    Entrar <Icon name="arrow-right" size={24} />
                  </span>
                ) : (
                  <Icon name={d.nuevaPestana ? 'external' : 'arrow-right'} size={24} className="inicio__flecha" />
                )}
              </>
            );
            return (
              <li key={d.ruta}>
                {d.nuevaPestana ? (
                  <a className="inicio__opcion" href={d.ruta} target="_blank" rel="noreferrer">
                    {contenido}
                    <span className="visually-hidden">(se abre en otra pestaña)</span>
                  </a>
                ) : (
                  <Link className="inicio__opcion" to={d.ruta}>
                    {contenido}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
