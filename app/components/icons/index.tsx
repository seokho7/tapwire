// 16px stroke-1.6 SVG icons

interface IconProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

const props = (size = 16) => ({
  width: size,
  height: size,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const IconActivity = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <polyline points="1,8 3,8 5,3 7,13 9,5 11,11 13,8 15,8" />
  </svg>
);

export const IconFilter = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <polygon points="2,2 14,2 9,8 9,14 7,14 7,8" />
  </svg>
);

export const IconPlay = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <polygon points="3,2 13,8 3,14" />
  </svg>
);

export const IconPause = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <line x1="5" y1="2" x2="5" y2="14" />
    <line x1="11" y1="2" x2="11" y2="14" />
  </svg>
);

export const IconTrash = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <polyline points="1,4 2,4 15,4" />
    <path d="M13,4 L12,14 A1,1,0,0,1,11,15 L5,15 A1,1,0,0,1,4,14 L3,4" />
    <path d="M6,4 L6,2 A1,1,0,0,1,7,1 L9,1 A1,1,0,0,1,10,2 L10,4" />
  </svg>
);

export const IconDownload = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M8,2 L8,10" />
    <polyline points="4,6 8,10 12,6" />
    <path d="M2,13 L14,13 M2,13 L2,14 A1,1,0,0,0,3,15 L13,15 A1,1,0,0,0,14,14 L14,13" />
  </svg>
);

export const IconUpload = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M8,10 L8,2" />
    <polyline points="4,6 8,2 12,6" />
    <path d="M2,13 L14,13 M2,13 L2,14 A1,1,0,0,0,3,15 L13,15 A1,1,0,0,0,14,14 L14,13" />
  </svg>
);

export const IconRefresh = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M1,8 A7,7,0,1,0,8,1" />
    <polyline points="1,1 1,8 8,8" />
  </svg>
);

export const IconSearch = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <circle cx="7" cy="7" r="5" />
    <line x1="10.5" y1="10.5" x2="15" y2="15" />
  </svg>
);

export const IconSettings = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="2.5" />
    <path d="M6.7,1.2 L6,2.5 A5.5,5.5,0,0,0,4.5,3.4 L3,3.1 L1.2,6.1 L2.2,7.2 A5.8,5.8,0,0,0,2.2,8.8 L1.2,9.9 L3,12.9 L4.5,12.6 A5.5,5.5,0,0,0,6,13.5 L6.7,14.8 L9.3,14.8 L10,13.5 A5.5,5.5,0,0,0,11.5,12.6 L13,12.9 L14.8,9.9 L13.8,8.8 A5.8,5.8,0,0,0,13.8,7.2 L14.8,6.1 L13,3.1 L11.5,3.4 A5.5,5.5,0,0,0,10,2.5 L9.3,1.2 Z" />
  </svg>
);

export const IconSun = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="3" />
    <line x1="8" y1="1" x2="8" y2="3" />
    <line x1="8" y1="13" x2="8" y2="15" />
    <line x1="1" y1="8" x2="3" y2="8" />
    <line x1="13" y1="8" x2="15" y2="8" />
    <line x1="3" y1="3" x2="4.5" y2="4.5" />
    <line x1="11.5" y1="11.5" x2="13" y2="13" />
    <line x1="13" y1="3" x2="11.5" y2="4.5" />
    <line x1="4.5" y1="11.5" x2="3" y2="13" />
  </svg>
);

export const IconMoon = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M13,9 A5,5,0,1,1,7,3 A7,7,0,0,0,13,9 Z" />
  </svg>
);

export const IconGlobe = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="7" />
    <path d="M1,8 L15,8 M8,1 A10,10,0,0,1,8,15 M8,1 A10,10,0,0,0,8,15" />
  </svg>
);

export const IconSessions = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M3,2 L13,2 A1,1,0,0,1,14,3 L14,13 A1,1,0,0,1,13,14 L3,14 A1,1,0,0,1,2,13 L2,3 A1,1,0,0,1,3,2 Z" />
    <line x1="5" y1="6" x2="11" y2="6" />
    <line x1="5" y1="9" x2="11" y2="9" />
    <line x1="5" y1="12" x2="8" y2="12" />
  </svg>
);

export const IconRules = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M1,4 A3,3,0,0,1,7,4 A3,3,0,0,1,13,4" />
    <line x1="7" y1="4" x2="7" y2="12" />
    <circle cx="7" cy="12" r="2" />
  </svg>
);

export const IconReplay = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M13,3 A7,7,0,1,0,15,8" />
    <polyline points="13,1 13,5 9,5" />
    <line x1="8" y1="5" x2="8" y2="11" />
    <polygon points="5,9 11,9 8,13" />
  </svg>
);

export const IconPhone = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <rect x="4" y="1" width="8" height="14" rx="2" />
    <line x1="8" y1="12" x2="8" y2="12.5" strokeWidth="2" />
  </svg>
);

export const IconCert = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <circle cx="8" cy="7" r="2" />
    <path d="M5,12 A3,3,0,0,1,11,12" />
  </svg>
);

export const IconStats = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <line x1="1" y1="15" x2="15" y2="15" />
    <rect x="2" y="10" width="3" height="5" />
    <rect x="6.5" y="6" width="3" height="9" />
    <rect x="11" y="3" width="3" height="12" />
  </svg>
);

export const IconCheck = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <polyline points="2,8 6,12 14,4" />
  </svg>
);

export const IconX = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <line x1="3" y1="3" x2="13" y2="13" />
    <line x1="13" y1="3" x2="3" y2="13" />
  </svg>
);

export const IconCopy = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <rect x="5" y="5" width="9" height="9" rx="1" />
    <path d="M11,5 L11,3 A1,1,0,0,0,10,2 L3,2 A1,1,0,0,0,2,3 L2,10 A1,1,0,0,0,3,11 L5,11" />
  </svg>
);

export const IconTag = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M2,2 L8,2 L14,8 L8,14 L2,8 Z" />
    <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
  </svg>
);

export const IconMore = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <circle cx="4" cy="8" r="1" fill="currentColor" />
    <circle cx="8" cy="8" r="1" fill="currentColor" />
    <circle cx="12" cy="8" r="1" fill="currentColor" />
  </svg>
);

export const IconLightning = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <polyline points="10,1 6,9 9,9 6,15 10,7 7,7" />
  </svg>
);

export const IconPlus = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <line x1="8" y1="2" x2="8" y2="14" />
    <line x1="2" y1="8" x2="14" y2="8" />
  </svg>
);

export const IconQr = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <rect x="1" y="1" width="6" height="6" rx="1" />
    <rect x="9" y="1" width="6" height="6" rx="1" />
    <rect x="1" y="9" width="6" height="6" rx="1" />
    <rect x="3" y="3" width="2" height="2" fill="currentColor" strokeWidth="0" />
    <rect x="11" y="3" width="2" height="2" fill="currentColor" strokeWidth="0" />
    <rect x="3" y="11" width="2" height="2" fill="currentColor" strokeWidth="0" />
    <line x1="9" y1="9" x2="11" y2="9" />
    <line x1="11" y1="9" x2="11" y2="11" />
    <line x1="11" y1="11" x2="15" y2="11" />
    <line x1="13" y1="9" x2="15" y2="9" />
    <line x1="9" y1="13" x2="9" y2="15" />
    <line x1="13" y1="13" x2="15" y2="13" />
    <line x1="13" y1="13" x2="13" y2="15" />
  </svg>
);

export const IconEdit = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M10.5,2.5 L13.5,5.5 L5,14 L2,14 L2,11 Z" />
    <line x1="8.5" y1="4.5" x2="11.5" y2="7.5" />
  </svg>
);

export const IconWrench = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M11,2 A4,4,0,0,1,14,6 A4,4,0,0,1,10,10 L4,14 A1.5,1.5,0,0,1,2,12 L6,6 A4,4,0,0,1,11,2 Z" />
    <line x1="6" y1="6" x2="10" y2="10" />
  </svg>
);

export const IconBroom = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <path d="M3,13 L8,8" />
    <path d="M8,8 L13,3 A2,2,0,0,1,15,5 L10,10" />
    <path d="M3,13 L2,14 A1,1,0,0,0,3,15 L5,14 L6,12 L4,11 Z" />
    <line x1="10" y1="10" x2="8" y2="8" />
  </svg>
);

export const IconChrome = ({ size, className, style }: IconProps) => (
  <svg {...props(size)} className={className} style={style}>
    <circle cx="8" cy="8" r="3" />
    <line x1="8" y1="1" x2="15" y2="1" />
    <line x1="1" y1="13" x2="4.5" y2="7" />
    <line x1="11.5" y1="7" x2="15" y2="13" />
  </svg>
);
