export const hora = (d: Date | string) =>
  new Date(d).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false });

export const fechaLarga = (d: Date) => d.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

export const minutosEntre = (desde: Date | string, hasta: Date) =>
  Math.max(0, Math.round((hasta.getTime() - new Date(desde).getTime()) / 60_000));
