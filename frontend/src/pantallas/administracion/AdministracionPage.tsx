import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon, type IconName } from '../../componentes/Icon';
import { PaginaInterna } from '../../componentes/PaginaInterna';
import { SeccionUsuarios } from './SeccionUsuarios';
import { SeccionSucursales } from './SeccionSucursales';
import { SeccionConsultorios } from './SeccionConsultorios';
import { SeccionProfesionales } from './SeccionProfesionales';
import { SeccionParametros } from './SeccionParametros';
import { SeccionAuditoria } from './SeccionAuditoria';
import './administracion.css';

const SECCIONES: { id: string; titulo: string; icono: IconName; contenido: () => ReactNode }[] = [
  { id: 'usuarios', titulo: 'Usuarios', icono: 'users', contenido: () => <SeccionUsuarios /> },
  { id: 'sucursales', titulo: 'Sucursales y equipos', icono: 'building', contenido: () => <SeccionSucursales /> },
  { id: 'consultorios', titulo: 'Consultorios y boxes', icono: 'grid', contenido: () => <SeccionConsultorios /> },
  { id: 'profesionales', titulo: 'Profesionales y agenda', icono: 'user-check', contenido: () => <SeccionProfesionales /> },
  { id: 'parametros', titulo: 'Parámetros', icono: 'settings', contenido: () => <SeccionParametros /> },
  { id: 'auditoria', titulo: 'Auditoría', icono: 'lock', contenido: () => <SeccionAuditoria /> },
];

/** #60: dirección configura quién trabaja, dónde y con qué rol. Solo dirección entra. */
export function AdministracionPage() {
  const [params, setParams] = useSearchParams();
  const actual = SECCIONES.find((s) => s.id === params.get('seccion')) ?? SECCIONES[0];

  return (
    <PaginaInterna titulo="Administración" subtitulo="Lo que se deja de usar se da de baja: nada se borra. Cada cambio queda en la auditoría." ancho="amplio">
      <div className="admin">
        <nav className="admin__secciones" aria-label="Secciones de administración">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={`admin__seccion ${s.id === actual.id ? 'admin__seccion--actual' : ''}`}
              aria-current={s.id === actual.id ? 'page' : undefined}
              onClick={() => setParams({ seccion: s.id }, { replace: true })}
            >
              <Icon name={s.icono} size={22} /> {s.titulo}
            </button>
          ))}
        </nav>
        <div className="admin__contenido">{actual.contenido()}</div>
      </div>
    </PaginaInterna>
  );
}
