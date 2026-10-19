import type { SVGProps } from 'react';

export type IconName =
  | 'hand'
  | 'arrow-right'
  | 'wifi-off'
  | 'check-circle'
  | 'search-x'
  | 'alert-triangle'
  | 'x-circle'
  | 'clock'
  | 'help-circle'
  | 'wifi'
  | 'megaphone'
  | 'check'
  | 'users'
  | 'building'
  | 'user'
  | 'user-check'
  | 'user-x'
  | 'swap'
  | 'info'
  | 'calendar-check'
  | 'chevron-down';

const paths: Record<IconName, JSX.Element> = {
  hand: (
    <path d="M18 11V6a2 2 0 0 0-4 0v5M14 10V4a2 2 0 0 0-4 0v6M10 10.5V6a2 2 0 0 0-4 0v8M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  ),
  'arrow-right': <path d="M5 12h14M13 6l6 6-6 6" />,
  'wifi-off': (
    <>
      <path d="M2 2l20 20" />
      <path d="M8.5 16.5a5 5 0 0 1 7 0M2 8.82a15 15 0 0 1 4.17-2.65M10.66 5c4.01-.36 8.14.9 11.34 3.76M16.85 11.25a10 10 0 0 1 2.22 1.68M5 13a10 10 0 0 1 5.24-2.76" />
      <path d="M12 20h.01" />
    </>
  ),
  'check-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12l3 3 5-6" />
    </>
  ),
  'search-x': (
    <>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35M8.5 8.5l5 5M13.5 8.5l-5 5" />
    </>
  ),
  'alert-triangle': (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  'x-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M15 9l-6 6M9 9l6 6" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  wifi: <path d="M5 12.55a11 11 0 0 1 14.08 0M1.42 9a16 16 0 0 1 21.16 0M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01" />,
  megaphone: (
    <>
      <path d="M3 11l18-5v12L3 14v-3z" />
      <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6" />
    </>
  ),
  check: <path d="M20 6L9 17l-5-5" />,
  users: (
    <>
      <circle cx="9" cy="8" r="4" />
      <path d="M2 21a7 7 0 0 1 14 0M16 3.13a4 4 0 0 1 0 7.75M22 21a7 7 0 0 0-4-6.32" />
    </>
  ),
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 21v-4h6v4M8 7h2M14 7h2M8 11h2M14 11h2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21a8 8 0 0 1 16 0" />
    </>
  ),
  'user-check': (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21a7 7 0 0 1 11-5.7M16 19l2 2 4-4" />
    </>
  ),
  'user-x': (
    <>
      <circle cx="10" cy="8" r="4" />
      <path d="M3 21a7 7 0 0 1 11-5.7M17 17l4 4M21 17l-4 4" />
    </>
  ),
  swap: <path d="M7 4L3 8l4 4M3 8h14M17 12l4 4-4 4M21 16H7" />,
  info: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </>
  ),
  'calendar-check': (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18M9 15l2 2 4-4" />
    </>
  ),
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  'help-circle': (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
};

type IconProps = SVGProps<SVGSVGElement> & { name: IconName; size?: number };

export function Icon({ name, size = 24, ...rest }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
