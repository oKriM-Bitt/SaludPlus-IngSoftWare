/**
 * DEV-54: buscador de la cola de secretaría por número de orden, DNI o nombre.
 * Funciones puras: se prueban sin la pantalla.
 */

/** Minúsculas y sin tildes, para comparar "Sofía" con "sofia". */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

type Buscable = { numero: string; paciente: string; documento?: string };

/**
 * true si el registro coincide con lo buscado.
 * - Solo números: número de orden (A023 o 23) o DNI (desde 3 dígitos).
 * - Letra y números ("A023", "a23"): número de orden.
 * - Texto: nombre del paciente.
 */
export function coincideBusqueda(a: Buscable, consulta: string): boolean {
  const q = normalizar(consulta).replace(/[.-]/g, '');
  if (!q) return true;
  const numero = normalizar(a.numero);
  if (/^\d+$/.test(q)) {
    const soloDigitos = numero.replace(/\D/g, '');
    if (soloDigitos && Number(soloDigitos) === Number(q)) return true;
    return q.length >= 3 && !!a.documento && a.documento.includes(q);
  }
  const orden = q.match(/^([a-z])\s*0*(\d+)$/);
  if (orden) return numero.startsWith(orden[1]) && Number(numero.slice(1)) === Number(orden[2]);
  return normalizar(a.paciente).includes(q);
}

/** Parte un texto para resaltar lo buscado (ignora tildes y mayúsculas). */
export function partesResaltadas(texto: string, consulta: string): { texto: string; marca: boolean }[] {
  const q = normalizar(consulta);
  if (!q || /^\d+$/.test(q)) return [{ texto, marca: false }];
  const base = normalizar(texto);
  const desde = base.indexOf(q);
  if (desde === -1) return [{ texto, marca: false }];
  return [
    { texto: texto.slice(0, desde), marca: false },
    { texto: texto.slice(desde, desde + q.length), marca: true },
    { texto: texto.slice(desde + q.length), marca: false },
  ].filter((p) => p.texto);
}
