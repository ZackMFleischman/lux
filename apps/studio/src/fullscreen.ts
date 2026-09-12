/** Use transition events as the authoritative state. Some native window
 * backends still return the prior value from isFullScreen inside the event. */
export function observeFullscreen(window: {
  isFullScreen(): boolean;
  on(event: 'enter-full-screen' | 'leave-full-screen', listener: () => void): unknown;
}, changed: (value: boolean) => void): () => boolean {
  let value = window.isFullScreen();
  window.on('enter-full-screen', () => { value = true; changed(value); });
  window.on('leave-full-screen', () => { value = false; changed(value); });
  return () => value;
}
