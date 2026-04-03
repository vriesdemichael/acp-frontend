<script lang="ts">
  import { onMount } from 'svelte'
  import ChatPage from './routes/ChatPage.svelte'
  import SettingsPage from './routes/SettingsPage.svelte'

  type Route = 'chat' | 'settings'

  function getRouteFromHash(): Route {
    const hash = window.location.hash
    if (hash.startsWith('#/settings')) return 'settings'
    return 'chat'
  }

  let route = $state<Route>(getRouteFromHash())

  onMount(() => {
    const handleHashChange = () => {
      route = getRouteFromHash()
    }
    window.addEventListener('hashchange', handleHashChange)
    // Redirect bare / or empty hash to #/chat
    if (!window.location.hash || window.location.hash === '#/') {
      window.location.hash = '#/chat'
    }
    return () => window.removeEventListener('hashchange', handleHashChange)
  })
</script>

{#if route === 'settings'}
  <SettingsPage />
{:else}
  <ChatPage />
{/if}
