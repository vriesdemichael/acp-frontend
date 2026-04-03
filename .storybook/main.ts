import type { StorybookConfig } from '@storybook/svelte-vite'

const config: StorybookConfig = {
  stories: ['../frontend/src/**/*.stories.@(ts|svelte.ts)'],
  addons: ['@storybook/addon-a11y', '@storybook/addon-vitest'],
  framework: {
    name: '@storybook/svelte-vite',
    options: {},
  },
}

export default config
