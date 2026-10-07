import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { SelectField } from './SelectField';

describe('SelectField', () => {
  it('is reachable by its label and reports the chosen value', async () => {
    const onChange = vi.fn<(value: string) => void>();
    render(
      <SelectField
        label="Currency"
        options={[
          { value: 'USD', label: 'USD' },
          { value: 'USDT', label: 'USDT' },
        ]}
        onChange={(e) => onChange(e.target.value)}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Currency'), 'USDT');

    expect(onChange).toHaveBeenCalledWith('USDT');
  });
});
