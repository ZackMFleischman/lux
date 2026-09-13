import type { StudioClient, StudioSnapshot } from './service-client.ts';

// Only these observations may wait. Newly added state fields conservatively
// remain urgent, including applied controls, transport, owner, faults and jobs.
function urgentState(snapshot: StudioSnapshot): string {
  const { receivedAtMs, visualFps, uiFps, performance, authoring, ...state } = snapshot;
  const runtime = authoring ? (({ frameId, ...rest }) => rest)(authoring) : null;
  return JSON.stringify({ ...state, authoring: runtime });
}

/** React's external-store notifications are synchronous. Feeding every worker
 * frame into the whole dock tree can starve pending UI work and trip React's
 * nested-update guard. Cache/coalesce observations at the UI boundary; runtime
 * command guards, acknowledgements, persistence and agent reads use the raw client.
 */
export function createRendererSnapshot(client: StudioClient) {
  let current = client.getSnapshot(), signature = urgentState(current);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let detach: (() => void) | undefined;
  const listeners = new Set<() => void>();
  function cancel() { clearTimeout(timer); timer = undefined; }
  function publish() {
    cancel();
    const next = client.getSnapshot();
    if (next === current) return;
    current = next; signature = urgentState(next);
    for (const listener of listeners) listener();
  }
  function changed() {
    const next = client.getSnapshot();
    if (next === current) return;
    if (urgentState(next) !== signature) publish();
    else timer ??= setTimeout(publish, 100);
  }
  return {
    // Do not bypass the cache here: React reads again during commit consistency
    // checks, which would otherwise reintroduce per-frame synchronous renders.
    getSnapshot: () => current,
    subscribe(listener: () => void) {
      listeners.add(listener);
      if (!detach) { detach = client.subscribe(changed); publish(); }
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) { detach?.(); detach = undefined; cancel(); }
      };
    },
  };
}
