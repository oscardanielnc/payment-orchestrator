import { useEffect, useState } from 'react';

export interface CopyValueProps {
  /** Names the value for screen readers: "Copy deposit address". */
  label: string;
  value: string;
}

/**
 * A value people must copy exactly (address, API key, link): monospace, wraps instead of
 * truncating, one click to copy, and a spoken confirmation.
 */
export function CopyValue({ label, value }: CopyValueProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
  };

  return (
    <div className="flex items-start gap-2 rounded-sm border border-line bg-bg px-3 py-2">
      <code className="min-w-0 flex-1 font-mono text-[13px] break-all text-ink">{value}</code>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        className="shrink-0 rounded-sm px-1.5 text-sm font-semibold text-accent hover:underline"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      <span role="status" className="sr-only">
        {copied ? `${label} copied` : ''}
      </span>
    </div>
  );
}
