export type StationState = 'done' | 'current' | 'upcoming' | 'failed';

export interface Station {
  label: string;
  detail?: string;
  state: StationState;
}

/**
 * The signature element (docs/design/direction.md, S2): a charge's journey as stations.
 * Stations come from real events, never invented. Only the current station pulses.
 */
export function PaymentRail({ stations }: { stations: Station[] }) {
  return (
    <ol
      className="grid overflow-x-auto"
      style={{ gridTemplateColumns: `repeat(${stations.length}, minmax(84px, 1fr))` }}
    >
      {stations.map((station, index) => (
        <li
          key={station.label}
          aria-current={station.state === 'current' ? 'step' : undefined}
          className="relative grid justify-items-center gap-2 text-center"
        >
          {index > 0 && (
            <span
              aria-hidden
              className={`absolute top-[9px] right-1/2 h-[3px] w-full ${station.state === 'upcoming' ? 'bg-line' : station.state === 'failed' ? 'bg-danger' : 'bg-accent'}`}
            />
          )}
          <span
            aria-hidden
            className={`relative z-10 grid size-5 place-items-center rounded-full border-[3px] text-[10px] font-bold ${
              station.state === 'done'
                ? 'border-accent bg-accent'
                : station.state === 'current'
                  ? 'animate-pulse border-accent bg-surface-accent'
                  : station.state === 'failed'
                    ? 'border-danger bg-danger text-surface'
                    : 'border-line bg-surface'
            }`}
          >
            {station.state === 'failed' ? '✕' : ''}
          </span>
          <span
            className={`font-heading text-sm font-bold ${station.state === 'current' ? 'text-accent' : station.state === 'failed' ? 'text-danger' : 'text-ink'}`}
          >
            {station.label}
            <span className="sr-only"> ({station.state})</span>
          </span>
          {station.detail && <span className="text-xs text-muted">{station.detail}</span>}
        </li>
      ))}
    </ol>
  );
}
