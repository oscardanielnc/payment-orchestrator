import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AppShell, navLinkClass } from './AppShell';

describe('AppShell', () => {
  it('always shows the test-mode banner, the organization and the main navigation', () => {
    render(
      <AppShell
        organizationName="Acme Coffee"
        nav={[{ group: 'Payments', items: [{ label: 'Charges', href: '/charges', active: true }] }]}
        renderLink={(item) => (
          <a href={item.href} className={navLinkClass(Boolean(item.active))}>
            {item.label}
          </a>
        )}
      >
        <p>content</p>
      </AppShell>,
    );

    expect(screen.getByRole('note')).toHaveTextContent('Test mode');
    expect(screen.getByText('Acme Coffee')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main' })).toContainElement(
      screen.getByRole('link', { name: 'Charges' }),
    );
  });
});
