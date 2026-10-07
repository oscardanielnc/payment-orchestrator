import { useEffect, useState } from 'react';

const pad = (n: number) => String(n).padStart(2, '0');

/** "Expires in 29:41". Only the visible label ticks; the server stays the source of truth. */
export function Countdown({ until }: { until: string }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const left = Math.max(0, Math.floor((new Date(until).getTime() - now) / 1000));
  const hours = Math.floor(left / 3600);
  const clock = `${hours > 0 ? `${hours}:` : ''}${pad(Math.floor((left % 3600) / 60))}:${pad(left % 60)}`;

  return (
    <p className="text-sm text-muted">
      Expires in <time className="font-mono text-ink tabular-nums">{clock}</time>
    </p>
  );
}
