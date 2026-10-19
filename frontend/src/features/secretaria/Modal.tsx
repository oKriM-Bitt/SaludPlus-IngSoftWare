import { useEffect, useRef, type ReactNode } from 'react';

type ModalProps = { titulo: string; subtitulo?: string; onCerrar: () => void; children: ReactNode };

/** Ventana modal accesible: foco inicial, Escape para cerrar y foco atrapado dentro. */
export function Modal({ titulo, subtitulo, onCerrar, children }: ModalProps) {
  const ref = useRef<HTMLDivElement>(null);
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    const previo = document.activeElement as HTMLElement | null;
    const primero = ref.current?.querySelector<HTMLElement>('select, input, button');
    primero?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cerrar.current();
      if (e.key !== 'Tab' || !ref.current) return;
      const focos = ref.current.querySelectorAll<HTMLElement>('select, input, button:not(:disabled)');
      const a = focos[0];
      const z = focos[focos.length - 1];
      if (e.shiftKey && document.activeElement === a) {
        e.preventDefault();
        z.focus();
      } else if (!e.shiftKey && document.activeElement === z) {
        e.preventDefault();
        a.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previo?.focus();
    };
  }, []);

  return (
    <div className="modal__fondo" onMouseDown={(e) => e.target === e.currentTarget && onCerrar()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-titulo" ref={ref}>
        <h2 id="modal-titulo">{titulo}</h2>
        {subtitulo && <p className="modal__subtitulo">{subtitulo}</p>}
        {children}
      </div>
    </div>
  );
}
