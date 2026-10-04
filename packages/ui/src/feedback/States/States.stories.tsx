import type { Meta, StoryObj } from '@storybook/react-vite';
import { EmptyState, ErrorState, Skeleton, TestModeBanner } from './States';

const meta = { title: 'Feedback/States' } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <EmptyState title="No charges yet">
      Create your first charge with <code>POST /v1/charges</code> and it will appear here.
    </EmptyState>
  ),
};
export const Failure: Story = {
  render: () => (
    <ErrorState message="Could not load charges. Check your connection." onRetry={() => {}} />
  ),
};
export const Loading: Story = { render: () => <Skeleton rows={5} label="Loading charges" /> };
export const TestMode: Story = {
  render: () => <TestModeBanner networks={['Stripe test', 'TRON Nile', 'Base Sepolia']} />,
};
