import { type SelectHTMLAttributes, useId } from 'react';

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: { value: string; label: string }[];
}

/** Native select: keyboard, screen readers and mobile pickers work without extra code. */
export function SelectField({ label, options, className = '', ...props }: SelectFieldProps) {
  const id = useId();
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      <label htmlFor={id} className="text-sm font-semibold text-ink">
        {label}
      </label>
      <select
        id={id}
        className="rounded-sm border border-line bg-surface px-3 py-2 text-ink"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
