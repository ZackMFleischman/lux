import type { RuntimeKey } from './service-client.ts';

export interface PresentationLease { detach(): Promise<void> }
export interface PresentationPort<Target = HTMLElement> {
  /** Attach a completed-output consumer, never create a producer or a clock.
   * A rejected attach must release anything it acquired before rejecting. */
  attach(request: { target: Target; runtimeKey: RuntimeKey }): Promise<PresentationLease>;
}

/** Serialize consumer handoffs. Late attachments are released; failed releases
 * retain ownership and prevent attaching over an uncertain consumer. */
export class PreviewBinding<Target = HTMLElement> {
  private readonly port: PresentationPort<Target>;
  private lease: PresentationLease | null = null;
  private revision = 0;
  private queue: Promise<void> = Promise.resolve();
  constructor(port: PresentationPort<Target>) { this.port = port; }
  move(target: Target, runtimeKey: RuntimeKey): Promise<void> {
    const revision = ++this.revision;
    return this.enqueue(async () => {
      await this.release();
      if (revision !== this.revision) return;
      this.lease = await this.port.attach({ target, runtimeKey: { ...runtimeKey } });
      if (revision !== this.revision) await this.release();
    });
  }
  close(): Promise<void> {
    ++this.revision;
    return this.enqueue(() => this.release());
  }
  private async release(): Promise<void> {
    if (!this.lease) return;
    await this.lease.detach();
    this.lease = null;
  }
  private enqueue(operation: () => Promise<void>): Promise<void> {
    const next = this.queue.then(operation, operation);
    this.queue = next;
    return next;
  }
}
