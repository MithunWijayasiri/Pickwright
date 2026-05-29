// Inline SVG icons (currentColor-driven) — replaces a Font Awesome dependency.

type IconProps = { className?: string };

const base = (className?: string) => ({
  className: className ?? 'icon',
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
});

export const CrosshairsIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="8" cy="8" r="4.2" />
    <path d="M8 1v2.2M8 12.8V15M1 8h2.2M12.8 8H15" />
  </svg>
);

export const StopIcon = ({ className }: IconProps) => (
  <svg {...base(className)} fill="currentColor" stroke="none">
    <rect x="3" y="3" width="10" height="10" rx="2" />
  </svg>
);

export const CheckIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M3 8.5l3.2 3.2L13 4.5" />
  </svg>
);

export const CopyIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
    <path d="M10.5 5.5V4a1.5 1.5 0 0 0-1.5-1.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" />
  </svg>
);

export const HistoryIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M2.6 5.2A6 6 0 1 1 2 8" />
    <path d="M2 2.5V5.5H5" />
    <path d="M8 5v3l2 1.4" />
  </svg>
);

export const GitHubIcon = ({ className }: IconProps) => (
  <svg {...base(className)} fill="currentColor" stroke="none">
    <path d="M8 0.8a7.2 7.2 0 0 0-2.28 14.03c.36.07.49-.16.49-.35v-1.23c-2 .44-2.42-.96-2.42-.96-.33-.83-.8-1.05-.8-1.05-.65-.45.05-.44.05-.44.72.05 1.1.74 1.1.74.64 1.1 1.68.78 2.09.6.06-.47.25-.79.45-.97-1.6-.18-3.28-.8-3.28-3.56 0-.79.28-1.43.74-1.93-.07-.18-.32-.91.07-1.9 0 0 .6-.2 1.98.73a6.9 6.9 0 0 1 3.6 0c1.37-.93 1.97-.73 1.97-.73.4.99.15 1.72.07 1.9.47.5.74 1.14.74 1.93 0 2.77-1.68 3.38-3.28 3.56.26.22.49.66.49 1.33v1.97c0 .19.13.42.5.35A7.2 7.2 0 0 0 8 .8Z" />
  </svg>
);

export const LogoMark = ({ className }: IconProps) => (
  <svg
    className={className ?? 'hd-mark'}
    viewBox="0 0 128 128"
    fill="none"
    aria-hidden={true}
  >
    <defs>
      <linearGradient id="pw-logo-g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#4FC34F" />
        <stop offset="1" stopColor="#1E8D22" />
      </linearGradient>
    </defs>
    <rect x="2" y="2" width="124" height="124" rx="30" fill="#1B1B1D" />
    <g transform="translate(64 64) scale(1.42) translate(-64 -64)">
      <g
        stroke="url(#pw-logo-g)"
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        <path d="M30 50 L30 30 L50 30" />
        <path d="M78 30 L98 30 L98 50" />
        <path d="M30 78 L30 98 L50 98" />
        <path d="M78 98 L98 98 L98 78" />
      </g>
      <path
        d="M50 48 L50 89.6 L60.4 79.2 L68.2 94.8 L73.4 92.2 L65.6 76.6 L78.6 76.6 Z"
        fill="#D65348"
        stroke="#1B1B1D"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </g>
  </svg>
);
