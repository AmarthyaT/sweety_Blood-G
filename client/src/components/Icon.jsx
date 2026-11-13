const PATHS = {
  droplet:
    'M12 2.7s6 6.1 6 10.4a6 6 0 0 1-12 0C6 8.8 12 2.7 12 2.7Z M9.5 13.6a2.5 2.5 0 0 0 2.5 2.5',
  plus: 'M12 5v14M5 12h14',
  pencil: 'M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3ZM13.5 6.5l3 3',
  trash: 'M4 7h16M9 7V5h6v2M7 7l1 13h8l1-13M10 11v5M14 11v5',
  calendar: 'M7 3v3M17 3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z',
  chevronLeft: 'M15 5l-7 7 7 7',
  chevronRight: 'M9 5l7 7-7 7',
  logout: 'M15 17l5-5-5-5M20 12H9M12 3H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h7',
  users:
    'M16 20v-1.5a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4V20M9 10a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM17 11a3 3 0 1 0 0-6M22 20v-1a3.5 3.5 0 0 0-3-3.4',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  close: 'M6 6l12 12M18 6L6 18',
  check: 'M4 12l5 5L20 6',
  alert: 'M12 8v5M12 16.5v.5M10.3 3.9 2.6 17.4A2 2 0 0 0 4.3 20h15.4a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z',
  info: 'M12 11v5M12 8v.5M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  mail: 'M3 6h18v12H3V6Zm0 1 9 7 9-7',
  lock: 'M7 11V8a5 5 0 0 1 10 0v3M5 11h14v10H5V11Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21v-1a5 5 0 0 1 5-5h6a5 5 0 0 1 5 5v1',
  sparkle: 'M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M18 6l-2.5 2.5M8.5 15.5 6 18',
  trend: 'M3 17l6-6 4 4 8-8M15 7h6v6',
};

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.8, filled = false }) {
  const path = PATHS[name];
  if (!path) return null;

  return (
    <svg
      aria-hidden="true"
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={path} />
    </svg>
  );
}
