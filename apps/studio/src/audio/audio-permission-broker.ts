export type AudioPermissionArm = Readonly<{ token: string; expiresAtMs: number }>;

type PermissionWebContents = Readonly<{
  isDestroyed(): boolean;
  on(event: 'did-start-navigation' | 'render-process-gone' | 'destroyed', listener: () => void): unknown;
  removeListener(event: 'did-start-navigation' | 'render-process-gone' | 'destroyed', listener: () => void): unknown;
}>;

type PermissionRequestDetails = Readonly<{
  isMainFrame?: boolean;
  requestingUrl?: string;
  securityOrigin?: string;
  mediaTypes?: readonly string[];
}>;

type PermissionCheckDetails = Readonly<{
  isMainFrame?: boolean;
  requestingUrl?: string;
  securityOrigin?: string;
  mediaType?: string;
}>;

type PermissionSession = Readonly<{
  setPermissionRequestHandler(handler: ((webContents: PermissionWebContents, permission: string,
    callback: (allowed: boolean) => void, details: PermissionRequestDetails) => void) | null): void;
  setPermissionCheckHandler(handler: ((webContents: PermissionWebContents | null, permission: string,
    requestingOrigin: string, details: PermissionCheckDetails) => boolean) | null): void;
}>;

type BrokerState = {
  phase: 'armed' | 'attempting' | 'active';
  webContents: PermissionWebContents;
  token: string;
  expiresAtMs: number;
  detach: () => void;
};

export function createAudioPermissionBroker(options: Readonly<{
  session: PermissionSession;
  getMainWebContents(): PermissionWebContents | null;
  pageUrl: string;
  securityOrigin: string;
  now(): number;
  createToken(): string;
  setExpiry(callback: () => void, milliseconds: number): unknown;
  clearExpiry(handle: unknown): void;
}>) {
  const armLifetimeMs = 5000;
  let state: BrokerState | null = null;
  let expiry: unknown;
  let disposed = false;

  function clearExpiry() {
    if (expiry === undefined) return;
    options.clearExpiry(expiry);
    expiry = undefined;
  }

  function clearState() {
    clearExpiry();
    const previous = state;
    state = null;
    previous?.detach();
  }

  function exactWebContents(webContents: PermissionWebContents | null) {
    const main = options.getMainWebContents();
    return !!webContents && !!main && webContents === main && !webContents.isDestroyed();
  }

  function exactRequest(webContents: PermissionWebContents, permission: string, details: PermissionRequestDetails) {
    return exactWebContents(webContents) && permission === 'media' && details?.isMainFrame === true &&
      details.requestingUrl === options.pageUrl && details.securityOrigin === options.securityOrigin &&
      Array.isArray(details.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === 'audio';
  }

  function exactCheck(webContents: PermissionWebContents | null, permission: string,
    requestingOrigin: string, details: PermissionCheckDetails) {
    return exactWebContents(webContents) && permission === 'media' && requestingOrigin === options.securityOrigin &&
      details?.isMainFrame === true && details.requestingUrl === options.pageUrl &&
      details.securityOrigin === options.securityOrigin && details.mediaType === 'audio';
  }

  function observe(webContents: PermissionWebContents) {
    const revoke = () => clearState();
    const events = ['did-start-navigation', 'render-process-gone', 'destroyed'] as const;
    for (const event of events) webContents.on(event, revoke);
    return () => { for (const event of events) webContents.removeListener(event, revoke); };
  }

  options.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const current = state;
    if (!current || current.phase !== 'armed' || current.webContents !== webContents) {
      callback(false);
      return;
    }
    const fresh = options.now() <= current.expiresAtMs;
    clearExpiry();
    const allowed = fresh && exactRequest(webContents, permission, details);
    if (allowed) current.phase = 'attempting';
    else clearState();
    callback(allowed);
  });
  options.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const current = state;
    if (!current || current.webContents !== webContents || !exactCheck(webContents, permission, requestingOrigin, details)) return false;
    if (current.phase !== 'armed') return true;
    if (options.now() <= current.expiresAtMs) return true;
    clearState();
    return false;
  });

  return Object.freeze({
    arm(webContents: PermissionWebContents): AudioPermissionArm {
      if (disposed) throw new Error('Audio permission broker is disposed');
      if (!exactWebContents(webContents)) throw new Error('Untrusted audio permission sender');
      clearState();
      const token = options.createToken();
      if (typeof token !== 'string' || token.length < 16 || token.length > 256) throw new Error('Invalid audio permission token');
      const expiresAtMs = options.now() + armLifetimeMs;
      state = { phase: 'armed', webContents, token, expiresAtMs, detach: observe(webContents) };
      expiry = options.setExpiry(() => {
        if (state?.phase === 'armed' && state.token === token) clearState();
      }, armLifetimeMs);
      return Object.freeze({ token, expiresAtMs });
    },
    activate(webContents: PermissionWebContents, token: string) {
      if (!state || state.phase !== 'attempting' || state.webContents !== webContents || state.token !== token) return false;
      state.phase = 'active';
      return true;
    },
    cancel(webContents: PermissionWebContents, token: string) {
      if (!state || state.webContents !== webContents || state.token !== token) return false;
      clearState();
      return true;
    },
    revoke(webContents?: PermissionWebContents) {
      if (!state || (webContents && state.webContents !== webContents)) return false;
      clearState();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearState();
      options.session.setPermissionRequestHandler(null);
      options.session.setPermissionCheckHandler(null);
    },
  });
}
