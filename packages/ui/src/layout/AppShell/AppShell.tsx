import type { ReactNode } from 'react';
import { TestModeBanner } from '../../feedback/States/States';

export interface NavItem {
  label: string;
  href: string;
  active?: boolean;
}

export interface AppShellProps {
  organizationName: string;
  nav: { group: string; items: NavItem[] }[];
  /** Renders each nav link (the app passes its router's Link). */
  renderLink: (item: NavItem) => ReactNode;
  userSlot?: ReactNode;
  children: ReactNode;
}

/** Layout L1: test-mode strip, fixed sidebar, content. The sidebar stacks on top below 900px. */
export function AppShell({ organizationName, nav, renderLink, userSlot, children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-bg">
      <TestModeBanner
        networks={['Stripe test', 'Mercado Pago test', 'TRON Nile', 'Base Sepolia']}
      />
      <div className="grid min-h-[calc(100dvh-28px)] grid-cols-1 min-[900px]:grid-cols-[232px_minmax(0,1fr)]">
        <aside className="flex flex-col gap-5 border-b border-line bg-surface px-3 py-4 min-[900px]:border-r min-[900px]:border-b-0">
          <div className="px-2">
            <p className="font-heading text-[15px] font-bold">Payment Orchestrator</p>
            <p className="text-[13px] text-muted">{organizationName}</p>
          </div>
          <nav
            aria-label="Main"
            className="flex flex-wrap gap-1 min-[900px]:flex-col min-[900px]:flex-nowrap"
          >
            {nav.map((section) => (
              <div
                key={section.group}
                className="contents min-[900px]:flex min-[900px]:flex-col min-[900px]:gap-0.5"
              >
                <span className="hidden px-2 pt-3 pb-1 text-xs font-semibold tracking-wide text-muted uppercase min-[900px]:block">
                  {section.group}
                </span>
                {section.items.map((item) => (
                  <span key={item.href}>{renderLink(item)}</span>
                ))}
              </div>
            ))}
          </nav>
          {userSlot && <div className="mt-auto px-2">{userSlot}</div>}
        </aside>
        <main className="flex w-full max-w-[1120px] flex-col gap-6 px-4 py-6 min-[900px]:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

/** Nav link styling shared by the app's router links. */
export const navLinkClass = (active: boolean) =>
  `block rounded-sm px-2 py-1.5 text-sm ${active ? 'bg-surface-accent font-semibold text-accent' : 'text-ink hover:bg-bg'}`;

export function PageHeader({
  title,
  actions,
  children,
}: {
  title: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl leading-[30px] font-bold">{title}</h1>
        {children}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section
      aria-label={title}
      className="flex min-w-0 flex-col gap-3.5 rounded-md border border-line bg-surface p-5"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-lg leading-6 font-bold">{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
