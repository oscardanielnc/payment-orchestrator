import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TextField } from './TextField';

describe('TextField', () => {
  it('is reachable by its label', () => {
    render(<TextField label="Email" type="email" />);

    expect(screen.getByLabelText('Email')).toHaveAttribute('type', 'email');
  });

  it('marks itself invalid and links the error message', () => {
    render(<TextField label="Password" error="Invalid email or password" />);
    const input = screen.getByLabelText('Password');

    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Invalid email or password');
  });
});
