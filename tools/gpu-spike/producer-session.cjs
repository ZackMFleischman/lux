// Shared by the Electron producer and CPU-only lease/lifecycle tests.
class ProducerSession {
  constructor(bridge) {
    this.bridge = bridge;
    this.held = new Map();
    this.uncertain = new Set();
    this.stopping = false;
    this.closed = false;
  }
  submit(texture) {
    if (this.stopping) { texture.release(); return { drop: 'stopping' }; }
    let result;
    try {
      result = JSON.parse(this.bridge.submit(texture.textureInfo.handle.ntHandle));
      const accepted = result && Number.isSafeInteger(result.id) && result.id > 0 && result.drop === undefined;
      const rejected = result && result.id === undefined && typeof result.drop === 'string';
      if (!accepted && !rejected) throw Error('invalid native submission response');
      if (accepted && this.held.has(result.id)) throw Error('duplicate borrowed lease id');
    }
    catch (error) {
      // Neither a thrown exception nor malformed response proves rejection.
      // Preserve the texture until supervised process failure; never guess ownership.
      this.uncertain.add(texture);
      this.stopping = true;
      throw error;
    }
    if (result.id) {
      this.held.set(result.id, texture);
    } else texture.release();
    return result;
  }
  poll() {
    if (this.closed) return [];
    const completed = JSON.parse(this.bridge.poll());
    // Validate the entire completion batch before releasing any lease.
    const unique = new Set();
    for (const id of completed) {
      if (!this.held.has(id) || unique.has(id)) throw Error('unknown completion or duplicate lease id');
      unique.add(id);
    }
    for (const id of completed) {
      this.held.get(id).release();
      this.held.delete(id);
    }
    return completed;
  }
  stop() { this.stopping = true; }
  drain() {
    if (this.closed) return true;
    if (!this.stopping) throw Error('stop must precede drain');
    this.poll();
    if (this.held.size || this.uncertain.size) return false;
    this.closed = JSON.parse(this.bridge.shutdown()).closed === true;
    return this.closed;
  }
}
module.exports = { ProducerSession };
