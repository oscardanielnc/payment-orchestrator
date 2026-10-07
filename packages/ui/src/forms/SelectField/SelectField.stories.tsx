import type { Meta, StoryObj } from '@storybook/react-vite';
import { SelectField } from './SelectField';

const meta = {
  title: 'Forms/SelectField',
  component: SelectField,
  args: {
    label: 'Currency',
    options: [
      { value: 'USD', label: 'USD · US dollar' },
      { value: 'PEN', label: 'PEN · Peruvian sol' },
      { value: 'USDT', label: 'USDT · Tether (TRON Nile testnet)' },
    ],
  },
} satisfies Meta<typeof SelectField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Disabled: Story = { args: { disabled: true } };
