export type ChargeStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'expired';

/** Shape + color + text: readable without color vision (WCAG 1.4.1). */
const STATUS: Record<ChargeStatus, { label: string; symbol: string; tone: string }> = {
  pending: { label: 'Pending', symbol: '◐', tone: 'text-warning' },
  processing: { label: 'Processing', symbol: '◐', tone: 'text-warning' },
  succeeded: { label: 'Succeeded', symbol: '●', tone: 'text-success' },
  failed: { label: 'Failed', symbol: '✕', tone: 'text-danger' },
  expired: { label: 'Expired', symbol: '○', tone: 'text-neutral' },
};

export function StatusChip({ status }: { status: ChargeStatus }) {
  const { label, symbol, tone } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-current px-2.5 text-[13px] leading-5 font-semibold whitespace-nowrap ${tone}`}
    >
      <span aria-hidden className="text-[11px]">
        {symbol}
      </span>
      {label}
    </span>
  );
}
