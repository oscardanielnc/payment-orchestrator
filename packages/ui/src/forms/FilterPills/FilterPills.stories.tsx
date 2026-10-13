import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FilterPills } from './FilterPills';

type Status = 'open' | 'resolved' | 'cleared';

const OPTIONS = [
  { label: 'All' },
  { label: 'Open', value: 'open' as const },
  { label: 'Resolved', value: 'resolved' as const },
  { label: 'Cleared', value: 'cleared' as const },
];

function Interactive({ initial }: { initial?: Status }) {
  const [value, setValue] = useState<Status | undefined>(initial);
  return (
    <FilterPills label="Filter by status" options={OPTIONS} value={value} onChange={setValue} />
  );
}

const meta = {
  title: 'Forms/FilterPills',
  component: Interactive,
} satisfies Meta<typeof Interactive>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AllSelected: Story = {};
export const OneSelected: Story = { args: { initial: 'open' } };
