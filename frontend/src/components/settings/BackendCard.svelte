<script lang="ts">
  import type { BackendSummary } from '../../store/backendStore.svelte.js'

  interface Props {
    backend: BackendSummary
  }

  const { backend }: Props = $props()

  const statusLabel = $derived(
    backend.status === 'active'
      ? 'Online'
      : backend.status === 'detected'
        ? 'Detected'
        : backend.status === 'disabled'
          ? 'Disabled'
          : 'Unavailable'
  )

  const statusClass = $derived(
    backend.status === 'active'
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      : backend.status === 'detected'
        ? 'border-amber-500/25 bg-amber-500/10 text-amber-200'
        : 'border-slate-500/20 bg-slate-800/70 text-slate-300'
  )

  const statusDotClass = $derived(
    backend.status === 'active'
      ? 'h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
      : backend.status === 'detected'
        ? 'h-2.5 w-2.5 rounded-full bg-amber-400'
        : 'h-2.5 w-2.5 rounded-full bg-slate-500'
  )
</script>

<section class="rounded-2xl border border-white/10 bg-slate-900/70 p-4 sm:p-5">
  <div class="flex items-start justify-between gap-4">
    <div class="min-w-0 flex-1">
      <p class="truncate text-xl font-semibold text-slate-50">{backend.name}</p>
      <p class="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">{backend.id}</p>
    </div>

    <span class={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${statusClass}`}>
      {statusLabel}
    </span>
  </div>

  <div class="mt-4 rounded-xl border border-white/10 bg-slate-950/50 px-3 py-3">
    <p class="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500">Runtime command</p>
    <p class="mt-2 font-mono text-xs text-slate-300">{backend.command ?? 'not detected'}</p>
  </div>

  <div class="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
    <p class="text-xs text-slate-400">Managed by acpx runtime configuration.</p>
    <div class="inline-flex items-center gap-2 text-xs text-slate-300">
      <span class={statusDotClass} aria-label={statusLabel}></span>
      <span>{backend.canResume ? 'Can resume sessions' : 'Cannot resume sessions'}</span>
    </div>
  </div>
</section>
