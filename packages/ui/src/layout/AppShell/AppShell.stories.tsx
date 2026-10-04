import type { Meta, StoryObj } from '@storybook/react-vite';
import { Amount } from '../../data-display/Amount/Amount';
import { StatusChip } from '../../data-display/StatusChip/StatusChip';
import { AppShell, navLinkClass, PageHeader, Panel } from './AppShell';

const meta = { title: 'Layout/AppShell', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const nav = [
  {
    group: 'Payments',
    items: [
      { label: 'Charges', href: '#charges', active: true },
      { label: 'Balances', href: '#balances' },
    ],
  },
  { group: 'Developers', items: [{ label: 'API keys', href: '#keys' }] },
];

export const Default: Story = {
  render: () => (
    <AppShell
      organizationName="Acme Coffee Roasters"
      nav={nav}
      renderLink={(item) => (
        <a href={item.href} className={navLinkClass(Boolean(item.active))}>
          {item.label}
        </a>
      )}
      userSlot={<span className="text-sm text-muted">oscar@acme.test</span>}
    >
      <PageHeader title="Charge detail">
        <div className="flex items-center gap-3">
          <Amount value="10000000" currency="USDT" size="hero" />
          <StatusChip status="processing" />
        </div>
      </PageHeader>
      <Panel title="Details">
        <p className="text-sm text-muted">Panels hold one topic each.</p>
      </Panel>
    </AppShell>
  ),
};
