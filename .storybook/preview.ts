import type { Preview } from '@storybook/svelte-vite'
import '../frontend/src/index.css'

const preview: Preview = {
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    viewport: {
      options: {
        mobile: {
          name: 'Mobile',
          styles: { width: '390px', height: '844px' },
        },
        desktop: {
          name: 'Desktop',
          styles: { width: '1440px', height: '1024px' },
        },
      },
    },
  },
}

export default preview
