import type { Preview } from '@storybook/react-vite';
import '../src/styles/tokens.css';

const preview: Preview = {
  parameters: {
    layout: 'padded',
    // Fail loudly in the a11y panel on WCAG A/AA rules (the standard requires AA).
    a11y: { options: { runOnly: ['wcag2a', 'wcag2aa'] } },
  },
  globalTypes: {
    theme: {
      description: 'Color theme',
      toolbar: { icon: 'mirror', items: ['light', 'dark'], dynamicTitle: true },
    },
  },
  initialGlobals: { theme: 'light' },
  decorators: [
    (Story, context) => {
      document.documentElement.dataset.theme = context.globals.theme as string;
      return <Story />;
    },
  ],
};

export default preview;
