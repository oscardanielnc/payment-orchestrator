import type { Meta, StoryObj } from '@storybook/react-vite';
import { Button } from './Button';

const meta = {
  title: 'Primitives/Button',
  component: Button,
  args: { children: 'Create charge' },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary', children: 'Copy payment link' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Revoke key' } };
export const Loading: Story = { args: { loading: true, children: 'Signing in' } };
export const Disabled: Story = { args: { disabled: true } };
