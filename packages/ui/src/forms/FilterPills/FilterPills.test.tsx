import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { FilterPills } from './FilterPills';

describe('FilterPills', () => {
  it('marks the active option as pressed and reports the chosen one', async () => {
    const onChange = vi.fn<(value: 'open' | undefined) => void>();
    render(
      <FilterPills
        label="Filter by status"
        options={[{ label: 'All' }, { label: 'Open', value: 'open' }]}
        value={undefined}
        onChange={onChange}
      />,
    );

    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));

    expect(onChange).toHaveBeenCalledWith('open');
    expect(screen.getByRole('group', { name: 'Filter by status' })).toBeInTheDocument();
  });
});
