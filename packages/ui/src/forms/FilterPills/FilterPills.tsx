export interface FilterOption<T extends string> {
  label: string;
  /** `undefined` is the "All" option. */
  value?: T;
}

export interface FilterPillsProps<T extends string> {
  /** Accessible name of the group, e.g. "Filter by status". */
  label: string;
  options: FilterOption<T>[];
  value: T | undefined;
  onChange: (value: T | undefined) => void;
}

/** One-of-many filter as toggle buttons; the active one is announced with aria-pressed. */
export function FilterPills<T extends string>({
  label,
  options,
  value,
  onChange,
}: FilterPillsProps<T>) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              active
                ? 'border-accent bg-surface-accent font-semibold text-accent'
                : 'border-line bg-surface text-ink hover:bg-bg'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
