import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { CopyValue } from './CopyValue';

describe('CopyValue', () => {
  it('copies the exact value and announces it', async () => {
    const user = userEvent.setup();
    render(<CopyValue label="deposit address" value="TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE" />);

    await user.click(screen.getByRole('button', { name: 'Copy deposit address' }));

    await expect(navigator.clipboard.readText()).resolves.toBe(
      'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE',
    );
    expect(screen.getByRole('status')).toHaveTextContent('deposit address copied');
  });
});
