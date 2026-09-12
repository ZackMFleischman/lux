export interface PreviewWindow {
  focus(): void; close(): void; setFullScreen(value: boolean): void; isFullScreen(): boolean;
}
/** UI windows only. No process, session, simulation, or runtime dependency. */
export class StudioWindows {
  private preview: PreviewWindow | null = null;
  private opening: Promise<void> | null = null;
  private revision = 0;
  private create: (closed: () => void) => Promise<PreviewWindow>;
  private changed: (detached: boolean) => void;
  constructor(create: (closed: () => void) => Promise<PreviewWindow>, changed: (detached: boolean) => void) {
    this.create = create; this.changed = changed;
  }
  get detached(): boolean { return this.preview !== null; }
  async popout(): Promise<void> {
    if (this.preview) { this.preview.focus(); return; }
    if (this.opening) return this.opening;
    const revision = ++this.revision;
    this.opening = (async () => {
      const preview = await this.create(() => { this.preview = null; this.changed(false); });
      if (revision !== this.revision) { preview.close(); return; }
      this.preview = preview;
      this.changed(true);
    })();
    try { await this.opening; } finally { this.opening = null; }
  }
  dock(): void { ++this.revision; this.preview?.close(); }
}
export function isTrustedStudioUrl(candidate: string, expected: string): boolean {
  try {
    const url = new URL(candidate), page = new URL(expected);
    return url.protocol === 'file:' && url.protocol === page.protocol && url.host === page.host &&
      url.pathname === page.pathname && !url.hash && (url.search === '' || url.search === '?view=preview');
  } catch { return false; }
}
