type IconProps = { size?: number; className?: string }

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 16 16',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
})

export const ChevronLeft = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M10 3.5 5.5 8l4.5 4.5" />
  </svg>
)

export const ChevronRight = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3.5 10.5 8 6 12.5" />
  </svg>
)

export const Check = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3 8.5 6.5 12 13 4.5" />
  </svg>
)

export const Plus = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 3v10M3 8h10" />
  </svg>
)

export const Lock = ({ size = 12, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="7" width="10" height="7" rx="2" />
    <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
  </svg>
)

export const Returned = ({ size = 12, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M6 3 2.5 6.5 6 10" />
    <path d="M2.5 6.5H10a3.5 3.5 0 0 1 0 7H8" />
  </svg>
)

export const Unlimited = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M8 8c-1.2-1.8-2.3-3-3.9-3a3 3 0 0 0 0 6C5.7 11 6.8 9.8 8 8Zm0 0c1.2 1.8 2.3 3 3.9 3a3 3 0 0 0 0-6C10.3 5 9.2 6.2 8 8Z" />
  </svg>
)

export const Question = ({ size = 16, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M5.5 6a2.6 2.6 0 1 1 3.9 2.2c-.9.6-1.4 1.1-1.4 2.1" />
    <circle cx="8" cy="13" r="0.5" fill="currentColor" />
  </svg>
)

export const Flag = ({ size = 12, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="M3.5 14V2.8M3.5 3c3-1.6 5.5 1.4 9 0v6.6c-3.5 1.4-6-1.6-9 0" />
  </svg>
)

export const Calendar = ({ size = 12, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <rect x="2.5" y="3.5" width="11" height="10" rx="2" />
    <path d="M2.5 6.8h11M5.5 2v3M10.5 2v3" />
  </svg>
)

export const Close = ({ size = 14, className }: IconProps) => (
  <svg {...base(size)} className={className}>
    <path d="m4 4 8 8M12 4l-8 8" />
  </svg>
)

export const Cursor = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <path d="M3 2.5 13 7.2 8.6 8.6 7.2 13 3 2.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

export const Camera = ({ size = 14, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <rect x="1.75" y="4" width="8.5" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
    <path d="m10.25 7.2 3.5-2v5.6l-3.5-2" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)

export const ClockIcon = ({ size = 12, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" className={className}>
    <circle cx="8" cy="8" r="6.25" stroke="currentColor" strokeWidth="1.5" />
    <path d="M8 4.6V8l2.3 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)
