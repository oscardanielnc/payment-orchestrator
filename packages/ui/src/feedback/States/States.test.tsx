import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EmptyState, ErrorState, Skeleton, TestModeBanner } from './States';

describe('feedback states', () => {
  it('ErrorState is announced and offers a retry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState message="Could not load charges" onRetry={onRetry} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Could not load charges');
    await userEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('Skeleton exposes a single status to screen readers', () => {
    render(<Skeleton label="Loading charges" />);

    expect(screen.getByRole('status', { name: 'Loading charges' })).toBeInTheDocument();
  });

  it('EmptyState shows its title and guidance', () => {
    render(<EmptyState title="No charges yet">Create one with the API.</EmptyState>);

    expect(screen.getByText('No charges yet')).toBeInTheDocument();
  });

  it('TestModeBanner always states the environment', () => {
    render(<TestModeBanner networks={['TRON Nile']} />);

    expect(screen.getByRole('note')).toHaveTextContent('Test mode');
  });
});
