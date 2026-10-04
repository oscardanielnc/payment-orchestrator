import type { ReactNode } from 'react';
import { Button } from '../../primitives/Button/Button';

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-line px-6 py-10 text-center">
      <p className="font-heading text-lg font-bold text-ink">{title}</p>
      {children && <div className="max-w-prose text-sm text-muted">{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-danger px-4 py-4"
    >
      <p className="text-sm text-danger">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Placeholder rows while data loads; hidden from screen readers, which get the label. */
export function Skeleton({ rows = 3, label = 'Loading' }: { rows?: number; label?: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-2">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} aria-hidden className="h-9 animate-pulse rounded-sm bg-line/60" />
      ))}
    </div>
  );
}

/** Fixed strip on every screen: this environment never moves real money (ADR 0006). */
export function TestModeBanner({ networks }: { networks: string[] }) {
  return (
    <div
      role="note"
      className="bg-warning px-4 py-1 text-center text-sm font-semibold text-surface"
    >
      Test mode{' '}
      <span className="font-normal opacity-90">
        · {networks.join(' · ')} · no real money moves here
      </span>
    </div>
  );
}
