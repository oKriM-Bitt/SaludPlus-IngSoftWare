/**
 * Logo de SaludPlus: "Red de seis centros".
 * Un hexágono (la red), un punto en cada vértice (los seis centros) y la cruz de la salud adentro.
 * - color: para fondos claros (encabezados, tótem, sala, login).
 * - claro: para fondos oscuros.
 * - mono: una sola tinta, para el ticket impreso.
 * En 20 px o menos se dibuja sin los puntos, que a ese tamaño ensucian.
 */
export type VarianteLogo = 'color' | 'claro' | 'mono';

const COLORES: Record<VarianteLogo, { red: string; centros: string; cruz: string }> = {
  color: { red: 'var(--color-primary)', centros: 'var(--color-accent)', cruz: 'var(--color-secondary)' },
  claro: { red: '#ffffff', centros: '#2dd4bf', cruz: '#ffffff' },
  mono: { red: 'currentColor', centros: 'currentColor', cruz: 'currentColor' },
};

/** Vértices del hexágono (punta arriba, radio 26, centro 32,32). */
const CENTROS: [number, number][] = [
  [32, 6],
  [54.52, 19],
  [54.52, 45],
  [32, 58],
  [9.48, 45],
  [9.48, 19],
];

type MarcaProps = { size?: number; variante?: VarianteLogo; className?: string };

/** Solo el símbolo, sin el nombre. */
export function MarcaSaludPlus({ size = 48, variante = 'color', className }: MarcaProps) {
  const c = COLORES[variante];
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <polygon points={CENTROS.map(([x, y]) => `${x},${y}`).join(' ')} fill="none" stroke={c.red} strokeWidth={size <= 20 ? 5 : 4} strokeLinejoin="round" />
      {size > 20 && CENTROS.map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r={4.5} fill={c.centros} />)}
      <rect x="27" y="20" width="10" height="24" rx="2.5" fill={c.cruz} />
      <rect x="20" y="27" width="24" height="10" rx="2.5" fill={c.cruz} />
    </svg>
  );
}

type LogoProps = { size?: number; variante?: VarianteLogo };

/** Símbolo + nombre. El tamaño del texto acompaña al del símbolo. */
export function Logo({ size = 48, variante = 'color' }: LogoProps) {
  return (
    <span className={`logo logo--${variante}`} style={{ fontSize: size * 0.75 }}>
      <MarcaSaludPlus size={size} variante={variante} />
      <span className="logo__text">SaludPlus</span>
    </span>
  );
}
