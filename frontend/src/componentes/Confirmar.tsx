import { useCallback, useRef, useState } from 'react';
import { Modal } from '../pantallas/secretaria/Modal';
import { Button } from './Button';

export type PedidoConfirmacion = {
  /** Pregunta, por ejemplo "¿Cerrar sesión?" */
  titulo: string;
  /** Qué va a pasar si acepta. */
  mensaje?: string;
  /** Texto del botón que confirma: dice la acción, no "Aceptar". */
  aceptar: string;
  cancelar?: string;
  /** La acción quita o da de baja algo: el botón se ve en rojo. */
  peligro?: boolean;
};

type Pendiente = PedidoConfirmacion & { responder: (acepta: boolean) => void };

/**
 * #87: pide confirmación antes de una acción importante, para que no se haga sin querer.
 *
 *   const { confirmar, dialogo } = useConfirmar();
 *   if (await confirmar({ titulo: '¿Cerrar sesión?', aceptar: 'Cerrar sesión' })) salir();
 *   …
 *   {dialogo}
 *
 * El foco arranca en "Cancelar", así un Enter de más no confirma; Escape o un clic afuera cancelan.
 */
export function useConfirmar() {
  const [pendiente, setPendiente] = useState<Pendiente | null>(null);
  const actual = useRef<Pendiente | null>(null);

  const confirmar = useCallback(
    (pedido: PedidoConfirmacion) =>
      new Promise<boolean>((responder) => {
        actual.current?.responder(false);
        const nuevo = { ...pedido, responder };
        actual.current = nuevo;
        setPendiente(nuevo);
      }),
    [],
  );

  const responder = (acepta: boolean) => {
    actual.current?.responder(acepta);
    actual.current = null;
    setPendiente(null);
  };

  const dialogo = pendiente ? (
    <Modal titulo={pendiente.titulo} subtitulo={pendiente.mensaje} onCerrar={() => responder(false)}>
      <div className="modal__acciones confirmar__acciones">
        <Button variant="secondary" onClick={() => responder(false)}>
          {pendiente.cancelar ?? 'Cancelar'}
        </Button>
        <Button className={pendiente.peligro ? 'btn--peligro' : ''} onClick={() => responder(true)}>
          {pendiente.aceptar}
        </Button>
      </div>
    </Modal>
  ) : null;

  return { confirmar, dialogo };
}
