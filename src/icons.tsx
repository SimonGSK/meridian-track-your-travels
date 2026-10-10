// Small inline icons, drawn with the current text color

type Props = { size?: number }

const svg = (size: number, children: React.ReactNode) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    {children}
  </svg>
)

export const PinIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <path d="M12 21s-7-6.1-7-11.5a7 7 0 0 1 14 0C19 14.9 12 21 12 21z" />
      <path d="m9.2 9.6 2 2 3.6-3.8" />
    </>,
  )

export const GamepadIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <path d="M7 7h10a5 5 0 0 1 4.9 6l-.7 3.4a2.6 2.6 0 0 1-4.5 1.2L14.5 15h-5l-2.2 2.6a2.6 2.6 0 0 1-4.5-1.2L2.1 13A5 5 0 0 1 7 7z" />
      <path d="M8 10v3M6.5 11.5h3M15.5 11h.01M17.5 12.5h.01" />
    </>,
  )

export const CheckIcon = ({ size = 16 }: Props) => svg(size, <path d="m5 12.5 4.5 4.5L19 7.5" />)

export const CompassIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>,
  )

export const EyeIcon = ({ size = 18 }: Props) =>
  svg(
    size,
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.8" />
    </>,
  )

export const EyeOffIcon = ({ size = 18 }: Props) =>
  svg(
    size,
    <>
      <path d="M9.9 5.7A9.6 9.6 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a16 16 0 0 1-2.6 3.4M6.3 7.4C3.9 9.1 2.5 12 2.5 12S6 18.5 12 18.5c1.6 0 3-.4 4.2-1" />
      <path d="M9.9 10a2.8 2.8 0 0 0 4 4M3.5 3.5l17 17" />
    </>,
  )

export const SearchIcon = ({ size = 18 }: Props) =>
  svg(
    size,
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.4-4.4" />
    </>,
  )

export const PlusIcon = ({ size = 16 }: Props) => svg(size, <path d="M12 5v14M5 12h14" />)

export const CloseIcon = ({ size = 16 }: Props) => svg(size, <path d="m6 6 12 12M18 6 6 18" />)

export const PlayIcon = ({ size = 16 }: Props) => svg(size, <path d="M8 5.5v13l10.5-6.5z" />)

export const PencilIcon = ({ size = 16 }: Props) =>
  svg(
    size,
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-4-4L4 16z" />
      <path d="m13.5 6.5 4 4" />
    </>,
  )

const STAR = 'M12 3.5l2.6 5.3 5.9.9-4.25 4.1 1 5.8L12 16.9l-5.25 2.7 1-5.8L3.5 9.7l5.9-.9z'

/** Outlined, or filled when `filled` */
export const StarIcon = ({ size = 16, filled = false }: Props & { filled?: boolean }) =>
  svg(size, <path d={STAR} fill={filled ? 'currentColor' : 'none'} />)

export const TrophyIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
      <path d="M17 6h2.5a1.5 1.5 0 0 1 1.5 1.5c0 2.2-1.8 4-4 4M7 6H4.5A1.5 1.5 0 0 0 3 7.5c0 2.2 1.8 4 4 4" />
    </>,
  )

export const FlagIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <path d="M5 21V4" />
      <path d="M5 4h12l-2.5 4.5L17 13H5" />
    </>,
  )

/** Seen from above, nose up */
export const PlaneIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <path d="M12 2.5c.8 0 1.4.7 1.4 1.5v5.2l7.1 4.3v2l-7.1-2.1v4.2l2.3 1.8v1.6L12 20l-3.7 1v-1.6l2.3-1.8v-4.2l-7.1 2.1v-2l7.1-4.3V4c0-.8.6-1.5 1.4-1.5z" />,
  )

export const CalendarIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M4 10h16M9 3v4M15 3v4" />
    </>,
  )

/** Two people, side by side */
export const PeopleIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 20c0-3.3 2.5-5.5 5.5-5.5s5.5 2.2 5.5 5.5" />
      <circle cx="17" cy="9" r="2.6" />
      <path d="M16.2 14.6c2.6.3 4.3 2.3 4.3 5" />
    </>,
  )

export const LayersIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 12.5 9 5 9-5" />
      <path d="m3 16.5 9 5 9-5" />
    </>,
  )

export const DownloadIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <path d="M12 4v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </>,
  )

export const PhoneIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.2" />
      <path d="M11 17.5h2" />
    </>,
  )

export const MonitorIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <rect x="3" y="4.5" width="18" height="12" rx="1.8" />
      <path d="M9 20h6M12 16.5V20" />
    </>,
  )

export const ChevronIcon = ({ size = 16 }: Props) => svg(size, <path d="m9.5 6 6 6-6 6" />)

export const MoreIcon = ({ size = 24 }: Props) =>
  svg(
    size,
    <>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" />
    </>,
  )

/** Six dots, to drag something by */
export const GripIcon = ({ size = 16 }: Props) =>
  svg(
    size,
    <>
      {[8, 16].flatMap((x) =>
        [6, 12, 18].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.3" fill="currentColor" stroke="none" />),
      )}
    </>,
  )
