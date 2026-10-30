import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from './Logo';
import { Icon } from './Icon';
import { MenuUsuario } from './MenuUsuario';
import '../pantallas/inicio/inicio.css';
import './pagina.css';

type Props = { titulo: string; subtitulo?: ReactNode; volver?: { ruta: string; texto: string }; acciones?: ReactNode; ancho?: 'normal' | 'amplio'; children: ReactNode };

/** Encabezado con menú, título y vuelta atrás para las pantallas internas. */
export function PaginaInterna({ titulo, subtitulo, volver = { ruta: '/inicio', texto: 'Volver al inicio' }, acciones, ancho = 'normal', children }: Props) {
  return (
    <div className="inicio">
      <header className="inicio__header">
        <Logo size={40} />
        <MenuUsuario />
      </header>
      <main className={`inicio__main pagina ${ancho === 'amplio' ? 'pagina--amplia' : ''}`}>
        <Link to={volver.ruta} className="pagina__volver">
          <Icon name="undo" size={20} /> {volver.texto}
        </Link>
        <div className="pagina__titulo">
          <div className="inicio__titulo">
            <h1>{titulo}</h1>
            {subtitulo && <p>{subtitulo}</p>}
          </div>
          {acciones && <div className="pagina__acciones">{acciones}</div>}
        </div>
        {children}
      </main>
    </div>
  );
}

/** Tarjeta de indicador: número grande con etiqueta. */
export function Indicador({ valor, etiqueta, tono }: { valor: ReactNode; etiqueta: string; tono?: 'alerta' | 'ok' }) {
  return (
    <div className={`indicador ${tono ? `indicador--${tono}` : ''}`}>
      <strong>{valor}</strong>
      <span>{etiqueta}</span>
    </div>
  );
}
