const PATHS = {
  menu: <path d="M4 7h16M4 12h16M4 17h10" />,
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7L3 8" />
      <path d="M3 3v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  back: <path d="M15 18l-6-6 6-6" />,
  bell: (
    <>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </>
  ),
  check: <path d="M5 12l5 5L20 7" />,
  plus: <path d="M12 5v14M5 12h14" />,
  cloud: <path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4 12a4 4 0 0 0 2 7z" />,
  cloudOff: (
    <>
      <path d="M17.5 19a4.5 4.5 0 1 0-1.4-8.8A6 6 0 0 0 4 12a4 4 0 0 0 2 7z" />
      <path d="M3 3l18 18" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  pause: <path d="M9 5v14M15 5v14" />,
  play: <path d="M7 5l12 7-12 7z" />,
  edit: (
    <>
      <path d="M4 20h4L19 9l-4-4L4 16z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
    </>
  ),
}

export function Icon({ name, size = 20, strokeWidth = 2 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}

export function Header({ title, onBack, right }) {
  return (
    <header className="header">
      {onBack && (
        <button className="icon-btn" onClick={onBack} aria-label="Back">
          <Icon name="back" />
        </button>
      )}
      <h1 className="header-title">{title}</h1>
      {right}
    </header>
  )
}

const SYNC_LABEL = {
  synced: 'Synced',
  syncing: 'Syncing…',
  offline: 'Offline',
  error: 'Not synced',
  off: 'On this device',
}

export function SyncBadge({ status }) {
  return (
    <span className={`sync-badge sync-${status}`}>
      <Icon name={status === 'synced' || status === 'syncing' ? 'cloud' : 'cloudOff'} size={16} />
      {SYNC_LABEL[status]}
    </span>
  )
}
