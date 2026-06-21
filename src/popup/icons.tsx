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

export const SunIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <circle cx="8" cy="8" r="3.2" />
    <path d="M8 1v1.6M8 13.4V15M1 8h1.6M13.4 8H15M3.05 3.05l1.13 1.13M11.82 11.82l1.13 1.13M3.05 12.95l1.13-1.13M11.82 4.18l1.13-1.13" />
  </svg>
);

export const MoonIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M13.5 9.2A5.5 5.5 0 1 1 6.8 2.5a4.3 4.3 0 0 0 6.7 6.7Z" />
  </svg>
);

export const SettingsIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <line x1="2.5" y1="5" x2="13.5" y2="5" />
    <line x1="2.5" y1="11" x2="13.5" y2="11" />
    <circle cx="5.5" cy="5" r="2" fill="var(--surface-titlebar)" />
    <circle cx="10.5" cy="11" r="2" fill="var(--surface-titlebar)" />
  </svg>
);

export const BackIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <path d="M10 3 5 8l5 5" />
  </svg>
);

export const GitHubIcon = ({ className }: IconProps) => (
  <svg {...base(className)} fill="currentColor" stroke="none">
    <path d="M8 0.8a7.2 7.2 0 0 0-2.28 14.03c.36.07.49-.16.49-.35v-1.23c-2 .44-2.42-.96-2.42-.96-.33-.83-.8-1.05-.8-1.05-.65-.45.05-.44.05-.44.72.05 1.1.74 1.1.74.64 1.1 1.68.78 2.09.6.06-.47.25-.79.45-.97-1.6-.18-3.28-.8-3.28-3.56 0-.79.28-1.43.74-1.93-.07-.18-.32-.91.07-1.9 0 0 .6-.2 1.98.73a6.9 6.9 0 0 1 3.6 0c1.37-.93 1.97-.73 1.97-.73.4.99.15 1.72.07 1.9.47.5.74 1.14.74 1.93 0 2.77-1.68 3.38-3.28 3.56.26.22.49.66.49 1.33v1.97c0 .19.13.42.5.35A7.2 7.2 0 0 0 8 .8Z" />
  </svg>
);

export const StackIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="2.5" y="2.5" width="11" height="8" rx="1.5" />
    <path d="M3.5 11v1.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V11" />
    <path d="M5 13.5V15a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-1.5" />
  </svg>
);

export const DoubleStackIcon = ({ className }: IconProps) => (
  <svg {...base(className)}>
    <rect x="2.5" y="3.5" width="11" height="8" rx="1.5" />
    <path d="M3.5 12v1.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V12" />
  </svg>
);

export const LogoMark = ({ className }: IconProps) => (
  <svg className={className ?? 'hd-mark'} viewBox="0 0 128 128" fill="none" aria-hidden={true} xmlns="http://www.w3.org/2000/svg">
    <rect width="128" height="128" rx="26" fill="#0e0e0e"/>
    <circle cx="24"  cy="24"  r="5.5" fill="#00d062" opacity="0.22"/>
    <circle cx="64"  cy="24"  r="5.5" fill="#00d062" opacity="0.22"/>
    <circle cx="104" cy="24"  r="5.5" fill="#00d062" opacity="0.22"/>
    <circle cx="24"  cy="64"  r="5.5" fill="#00d062" opacity="0.22"/>
    <circle cx="104" cy="64"  r="5.5" fill="#00d062" opacity="0.22"/>
    <circle cx="24"  cy="104" r="5.5" fill="#00d062" opacity="0.22"/>
    <circle cx="64"  cy="104" r="5.5" fill="#00d062" opacity="0.22"/>
    <circle cx="104" cy="104" r="5.5" fill="#00d062" opacity="0.22"/>
    <line x1="64" y1="12"  x2="64"  y2="46"  stroke="#00d062" strokeWidth="2" strokeLinecap="round" opacity="0.28"/>
    <line x1="64" y1="82"  x2="64"  y2="116" stroke="#00d062" strokeWidth="2" strokeLinecap="round" opacity="0.28"/>
    <line x1="12" y1="64"  x2="46"  y2="64"  stroke="#00d062" strokeWidth="2" strokeLinecap="round" opacity="0.28"/>
    <line x1="82" y1="64"  x2="116" y2="64"  stroke="#00d062" strokeWidth="2" strokeLinecap="round" opacity="0.28"/>
    <circle cx="64" cy="64" r="16" fill="#00d062"/>
  </svg>
);
