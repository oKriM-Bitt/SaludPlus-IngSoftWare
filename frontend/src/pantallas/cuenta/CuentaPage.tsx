import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '../../componentes/Logo';
import { Icon } from '../../componentes/Icon';
import { Alerta } from '../../componentes/Alerta';
import { MenuUsuario } from '../../componentes/MenuUsuario';
import { FormularioClave } from '../../componentes/FormularioClave';
import { useUsuario } from '../../servicios/sesion';
import { ETIQUETA_ROL } from '../../servicios/usuarios';
import '../inicio/inicio.css';
import './cuenta.css';

/** #79: el usuario cambia su contraseña desde el menú. */
export function CuentaPage() {
  const usuario = useUsuario()!;
  const [listo, setListo] = useState(false);
  const [intento, setIntento] = useState(0);

  return (
    <div className="inicio">
      <header className="inicio__header">
        <Logo size={40} />
        <MenuUsuario />
      </header>
      <main className="inicio__main cuenta">
        <Link to="/inicio" className="cuenta__volver">
          <Icon name="undo" size={20} /> Volver al inicio
        </Link>
        <div className="inicio__titulo">
          <h1>Cambiar contraseña</h1>
          <p>
            {usuario.nombre} · {ETIQUETA_ROL[usuario.rol]} · usuario <strong>{usuario.usuario}</strong>
          </p>
        </div>
        <section className="cuenta__card">
          {listo ? (
            <>
              <Alerta tono="success" titulo="La contraseña se cambió correctamente">
                Úsela la próxima vez que ingrese.
              </Alerta>
              <button
                type="button"
                className="cuenta__otra"
                onClick={() => {
                  setListo(false);
                  setIntento((n) => n + 1);
                }}
              >
                Cambiarla de nuevo
              </button>
            </>
          ) : (
            <FormularioClave key={intento} usuario={usuario.usuario} pedirActual onListo={() => setListo(true)} />
          )}
        </section>
        <p className="cuenta__nota">
          <Icon name="info" size={20} /> Si olvidó su contraseña, dirección puede restablecerla desde Administración. Después de 5 intentos fallidos el usuario se bloquea durante 15 minutos.
        </p>
      </main>
    </div>
  );
}
