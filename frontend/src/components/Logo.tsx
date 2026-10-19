type LogoProps = { size?: number };

/** Cruz de dos barras iguales (18×6) + palabra SaludPlus. */
export function Logo({ size = 48 }: LogoProps) {
  return (
    <span className="logo" style={{ fontSize: size * 0.75 }}>
      <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
        <rect x="6" y="0" width="6" height="18" rx="0.8" fill="var(--color-primary)" />
        <rect x="0" y="6" width="18" height="6" rx="0.8" fill="var(--color-primary)" />
      </svg>
      <span className="logo__text">SaludPlus</span>
    </span>
  );
}
