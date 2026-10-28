import { describe, expect, it } from 'vitest';
import { atajoDeTecla, escribiendoEnCampo, moverEnLista, pacientesSaltados } from './llamados';

const cola = [{ turnoId: 'a' }, { turnoId: 'b' }, { turnoId: 'c' }];

describe('pacientesSaltados (#42)', () => {
  it('llamar al primero no saltea a nadie', () => {
    expect(pacientesSaltados(cola, 'a')).toEqual([]);
  });

  it('llamar fuera de orden devuelve a los que estaban antes', () => {
    expect(pacientesSaltados(cola, 'c').map((x) => x.turnoId)).toEqual(['a', 'b']);
  });

  it('un paciente que no está en la cola no saltea a nadie', () => {
    expect(pacientesSaltados(cola, 'z')).toEqual([]);
  });
});

describe('atajos de teclado (DEV-38)', () => {
  const boton = { tagName: 'BUTTON', closest: () => null };

  it('reconoce las teclas en mayúscula o minúscula', () => {
    expect(atajoDeTecla({ key: 'n' }, boton)).toBe('llamar-siguiente');
    expect(atajoDeTecla({ key: 'R' }, boton)).toBe('volver-a-llamar');
    expect(atajoDeTecla({ key: 'f' }, boton)).toBe('finalizar');
    expect(atajoDeTecla({ key: 'l' }, null)).toBe('ir-a-lista');
  });

  it('no se activan mientras se escribe en un campo', () => {
    expect(atajoDeTecla({ key: 'n' }, { tagName: 'INPUT' })).toBeNull();
    expect(atajoDeTecla({ key: 'n' }, { tagName: 'textarea' })).toBeNull();
    expect(atajoDeTecla({ key: 'n' }, { tagName: 'SELECT' })).toBeNull();
    expect(atajoDeTecla({ key: 'n' }, { tagName: 'DIV', isContentEditable: true })).toBeNull();
  });

  it('no se activan dentro de un diálogo de confirmación', () => {
    expect(escribiendoEnCampo({ tagName: 'BUTTON', closest: (s: string) => (s.includes('dialog') ? {} : null) })).toBe(true);
  });

  it('ignora combinaciones con Ctrl, Alt o Cmd y la tecla mantenida', () => {
    expect(atajoDeTecla({ key: 'r', ctrlKey: true }, boton)).toBeNull();
    expect(atajoDeTecla({ key: 'f', altKey: true }, boton)).toBeNull();
    expect(atajoDeTecla({ key: 'n', metaKey: true }, boton)).toBeNull();
    expect(atajoDeTecla({ key: 'n', repeat: true }, boton)).toBeNull();
  });

  it('otras teclas no hacen nada', () => {
    expect(atajoDeTecla({ key: 'x' }, boton)).toBeNull();
    expect(atajoDeTecla({ key: 'Enter' }, boton)).toBeNull();
  });
});

describe('moverEnLista (DEV-38)', () => {
  it('las flechas no salen de la lista', () => {
    expect(moverEnLista('ArrowDown', 2, 3)).toBe(2);
    expect(moverEnLista('ArrowUp', 0, 3)).toBe(0);
    expect(moverEnLista('ArrowDown', 0, 3)).toBe(1);
  });

  it('Inicio y Fin van al primero y al último', () => {
    expect(moverEnLista('Home', 2, 3)).toBe(0);
    expect(moverEnLista('End', 0, 3)).toBe(2);
  });

  it('con la lista vacía o con otra tecla no se mueve', () => {
    expect(moverEnLista('ArrowDown', 0, 0)).toBeNull();
    expect(moverEnLista('a', 0, 3)).toBeNull();
  });
});
