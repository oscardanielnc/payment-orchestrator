import type { Meta, StoryObj } from '@storybook/react-vite';
import { TextField } from './TextField';

const meta = {
  title: 'Forms/TextField',
  component: TextField,
  args: { label: 'Email', type: 'email', placeholder: 'you@company.com' },
} satisfies Meta<typeof TextField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {};
export const WithHint: Story = {
  args: { label: 'Key name', type: 'text', hint: 'Only you see this name.' },
};
export const WithError: Story = {
  args: { label: 'Password', type: 'password', error: 'Invalid email or password' },
};
