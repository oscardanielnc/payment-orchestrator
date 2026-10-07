import type { Meta, StoryObj } from '@storybook/react-vite';
import { CopyValue } from './CopyValue';

const meta = {
  title: 'Data display/CopyValue',
  component: CopyValue,
  args: { label: 'deposit address', value: 'TQn9Y2khEsLJW1ChVWFMSMeRDow5KcbLSE' },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 360 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CopyValue>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Address: Story = {};
export const LongLink: Story = {
  args: { label: 'payment link', value: 'http://localhost:5173/pay/q4Yc2T9pX1mBv7Kd0Lz8Wg' },
};
