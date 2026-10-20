import type { ReactNode } from 'react'

// Набор линейных иконок 24×24 в одном стиле (обводка 1.8, скруглённые концы).
// Цвет берётся из currentColor, поэтому иконку красят классом text-*.
const PATHS = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  'card-plus': <><path d="M20 11V7.5A2.5 2.5 0 0 0 17.5 5h-12A2.5 2.5 0 0 0 3 7.5v9A2.5 2.5 0 0 0 5.5 19H13" /><path d="M3 10h17M18 15v6M15 18h6" /></>,
  card: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></>,
  bell: <><path d="M6 16v-5a6 6 0 1 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  tasks: <><rect x="4" y="4" width="16" height="16" rx="3.5" /><path d="m8.5 12 2.5 2.5 4.5-5" /></>,
  target: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" /></>,
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z" />,
  plus: <path d="M12 5v14M5 12h14" />,
  'chevron-right': <path d="m9.5 6 6 6-6 6" />,
  'chevron-left': <path d="m14.5 6-6 6 6 6" />,
  'arrow-in': <path d="M12 4v12m0 0 5-5m-5 5-5-5M5 20h14" />,
  'arrow-up': <path d="M12 20V6m0 0 5 5m-5-5-5 5" />,
  lock: <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>,
  unlock: <><rect x="5" y="11" width="14" height="10" rx="2.5" /><path d="M8 11V8a4 4 0 0 1 7.6-1.7" /></>,
  food: <path d="M7 3v7a2 2 0 0 0 2 2v9M5 3v5M9 3v5M17 21V3c-2.2 1-3.5 3.8-3.5 7v3H17" />,
  bus: <><rect x="5" y="3" width="14" height="15" rx="2.5" /><path d="M5 11h14M8 21v-3M16 21v-3" /><circle cx="8.5" cy="14.5" r="1" fill="currentColor" stroke="none" /><circle cx="15.5" cy="14.5" r="1" fill="currentColor" stroke="none" /></>,
  game: <><path d="M7 8h10a4 4 0 0 1 4 4v2.5a2.5 2.5 0 0 1-4.4 1.6L15 14H9l-1.6 2.1A2.5 2.5 0 0 1 3 14.5V12a4 4 0 0 1 4-4z" /><path d="M8 10.5v3M6.5 12h3" /><circle cx="16" cy="12" r="1" fill="currentColor" stroke="none" /></>,
  play: <><rect x="3" y="5" width="18" height="13" rx="2.5" /><path d="M10 9v5l4.5-2.5zM8 21h8" /></>,
  bag: <><path d="M5 8h14l-1 13H6z" /><path d="M9 8V7a3 3 0 0 1 6 0v1" /></>,
  ticket: <><path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4z" /><path d="M14 7.5v9" /></>,
  book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H19v15H6.5A2.5 2.5 0 0 0 4 20.5z" /><path d="M4 20.5A2.5 2.5 0 0 1 6.5 18H19v3H6.5" /></>,
  ban: <><circle cx="12" cy="12" r="9" /><path d="m5.6 5.6 12.8 12.8" /></>,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  chat: <><path d="M4 5h16v11H10l-6 4.5z" /><path d="M8 9.5h8M8 12.5h5" /></>,
  wallet: <><path d="M5 7V6a2 2 0 0 1 2-2h11v3" /><rect x="3" y="7" width="18" height="13" rx="2.5" /><circle cx="16.5" cy="13.5" r="1.2" fill="currentColor" stroke="none" /></>,
  shield: <><path d="M12 3 5 6v5.5c0 4.3 2.9 7.8 7 9.5 4.1-1.7 7-5.2 7-9.5V6z" /><path d="m9 12 2 2 4-4" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.4 2.5 3.7 5.6 3.7 9s-1.3 6.5-3.7 9c-2.4-2.5-3.7-5.6-3.7-9S9.6 5.5 12 3z" /></>,
  phone: <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  gift: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M5 12v8h14v-8M12 8v12M12 8c-1.5-3-5.5-3.5-5.5-1S10.5 8 12 8zm0 0c1.5-3 5.5-3.5 5.5-1S13.5 8 12 8z" /></>,
  coins: <><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v4c0 1.7 2.7 3 6 3s6-1.3 6-3V7M9 14v3c0 1.7 2.7 3 6 3s6-1.3 6-3v-4c0-1.7-2.7-3-6-3" /></>,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  alert: <><path d="M12 3.5 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></>,
  heart: <path d="M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0 1 12 7.3a4.2 4.2 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z" />,
  refresh: <path d="M20 11.5A8 8 0 1 1 17.7 6M20 4v5h-5" />,
} satisfies Record<string, ReactNode>

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24, className = '', strokeWidth = 1.8 }: {
  name: IconName; size?: number; className?: string; strokeWidth?: number
}) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      className={`shrink-0 ${className}`} aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  )
}
