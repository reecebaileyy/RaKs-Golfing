// Small inline line icons for the weather codes saved with each snapshot. Server-component friendly.

const PATHS: Record<string, React.ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </>
  ),
  cloud: <path d="M7 18a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 8.5a4.75 4.75 0 0 1 0 9.5H7z" />,
  rain: (
    <>
      <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5a4.75 4.75 0 0 1 0 9.5H7z" />
      <path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" />
    </>
  ),
  storm: (
    <>
      <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5a4.75 4.75 0 0 1 0 9.5h-1" />
      <path d="M12 12l-3 5h4l-2 5" />
    </>
  ),
  snow: (
    <>
      <path d="M7 14a4 4 0 0 1-.5-7.97A5.5 5.5 0 0 1 17 4.5a4.75 4.75 0 0 1 0 9.5H7z" />
      <path d="M8 18v2M12 18v3M16 18v2" />
    </>
  ),
  fog: <path d="M4 8h16M3 12h18M5 16h14M8 20h8" />,
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h7" />,
};

export function WeatherIcon({ icon, className = "h-5 w-5" }: { icon: string | null; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[icon ?? ""] ?? PATHS.cloud}
    </svg>
  );
}
