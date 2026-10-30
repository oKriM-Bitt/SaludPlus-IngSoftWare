import { useSyncExternalStore } from 'react';
import { Icon } from '../../componentes/Icon';
import { configuracion, escucharConfiguracion } from '../../servicios/configuracion';

/** Configuración actual; se vuelve a dibujar cuando cambia (también desde otra pestaña). */
export function useConfiguracion() {
  return useSyncExternalStore(escucharConfiguracion, configuracion);
}

/** Etiqueta de estado con ícono y texto. */
export function Estado({ activo, textoActivo = 'Activo', textoBaja = 'De baja' }: { activo: boolean; textoActivo?: string; textoBaja?: string }) {
  return (
    <span className={`admin__estado ${activo ? 'admin__estado--activo' : 'admin__estado--baja'}`}>
      <Icon name={activo ? 'check-circle' : 'x-circle'} size={18} /> {activo ? textoActivo : textoBaja}
    </span>
  );
}
