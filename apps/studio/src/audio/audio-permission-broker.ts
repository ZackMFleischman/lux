export type AudioPermissionArm = Readonly<{ token: string; expiresAtMs: number }>;

type PermissionWebContents = Readonly<{
  isDestroyed(): boolean;
  getURL(): string;
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
  embeddingOrigin?: string;
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
  phase: 'discovering' | 'armed' | 'attempting' | 'active';
  webContents: PermissionWebContents;
  token: string;
  expiresAtMs: number;
  startedAtMs:number;
  attemptedAtMs?:number;
  attemptExpiresAtMs?:number;
  checkReported?:boolean;
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
  diagnostic?(details:Readonly<{stage:string;code:string;elapsedMs:number;attemptMs?:number}>):void;
}>) {
  const armLifetimeMs = 5000,attemptLifetimeMs=60000;
  let state: BrokerState | null = null;
  let expiry: unknown;
  let disposed = false;

  function report(code:string,current:BrokerState|null=state){
    const now=options.now();
    try{options.diagnostic?.({stage:current?.phase??'none',code,elapsedMs:current?Math.max(0,now-current.startedAtMs):0,...(current?.attemptedAtMs===undefined?{}:{attemptMs:Math.max(0,now-current.attemptedAtMs)})});}catch{}
  }

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
    return !!webContents && !!main && webContents === main && !webContents.isDestroyed() && webContents.getURL() === options.pageUrl;
  }

  function exactRequest(webContents: PermissionWebContents, permission: string, details: PermissionRequestDetails) {
    return exactWebContents(webContents) && permission === 'media' && details?.isMainFrame === true &&
      details.requestingUrl === options.pageUrl && details.securityOrigin === options.securityOrigin &&
      Array.isArray(details.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === 'audio';
  }

  function exactAudioCheck(webContents: PermissionWebContents | null, permission: string,
    requestingOrigin: string, details: PermissionCheckDetails, phase: BrokerState['phase']) {
    if (!exactWebContents(webContents) || permission !== 'media' || details?.isMainFrame !== true) return false;
    const legacyProbe = requestingOrigin === '' && details.requestingUrl === '' &&
      details.securityOrigin === undefined && details.embeddingOrigin === options.securityOrigin && details.mediaType === 'audio';
    const documentAudio = requestingOrigin === options.securityOrigin && details.requestingUrl === options.pageUrl &&
      details.securityOrigin === options.securityOrigin && details.embeddingOrigin === undefined && details.mediaType === 'audio';
    const captureContinuation = requestingOrigin === options.securityOrigin && details.requestingUrl === options.pageUrl &&
      details.securityOrigin === undefined && details.embeddingOrigin === options.securityOrigin && details.mediaType === undefined;
    return legacyProbe || documentAudio || ((phase === 'attempting' || phase === 'active') && captureContinuation);
  }

  function observe(webContents: PermissionWebContents) {
    const revoke = () => {report('context-revoked');clearState();};
    const events = ['did-start-navigation', 'render-process-gone', 'destroyed'] as const;
    for (const event of events) webContents.on(event, revoke);
    return () => { for (const event of events) webContents.removeListener(event, revoke); };
  }

  options.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const current = state;
    if (!current || current.phase !== 'armed' || current.webContents !== webContents) {
      if (current?.phase === 'discovering') clearState();
      callback(false);
      return;
    }
    const fresh = options.now() <= current.expiresAtMs;
    const allowed = fresh && exactRequest(webContents, permission, details);
    if (allowed) {
      clearExpiry();current.phase = 'attempting';current.attemptedAtMs=options.now();current.attemptExpiresAtMs=current.attemptedAtMs+attemptLifetimeMs;
      expiry=options.setExpiry(()=>{if(state===current&&state.phase==='attempting'){report('attempt-expired');clearState();}},attemptLifetimeMs);
      report('request-accepted');
    }
    else {report(fresh?'request-rejected':'intent-expired');clearState();}
    callback(allowed);
  });
  options.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const current = state;
    if (!current || current.webContents !== webContents || !exactAudioCheck(webContents, permission, requestingOrigin, details, current.phase)) return false;
    if (current.phase === 'armed') {
      if(options.now()>current.expiresAtMs){report('intent-expired');clearState();}
      else if(!current.checkReported){current.checkReported=true;report('check-await-request');}
      return false; // An armed intent is not a cached capture grant: require the exact request handler.
    }
    if (current.phase === 'attempting') {
      if(options.now()>current.attemptExpiresAtMs!){report('attempt-expired');clearState();return false;}
      // Only continuation of the admitted capture passes; a new capture must request again and is denied.
      return requestingOrigin===options.securityOrigin&&details.requestingUrl===options.pageUrl&&details.securityOrigin===undefined&&details.embeddingOrigin===options.securityOrigin&&details.mediaType===undefined;
    }
    if (current.phase === 'active') return true;
    if (options.now() <= current.expiresAtMs) return true;
    clearState();
    return false;
  });

  function begin(webContents: PermissionWebContents, phase: 'discovering' | 'armed'): AudioPermissionArm {
    if (disposed) throw new Error('Audio permission broker is disposed');
    if (!exactWebContents(webContents)) throw new Error('Untrusted audio permission sender');
    clearState();
    const token = options.createToken();
    if (typeof token !== 'string' || token.length < 16 || token.length > 256) throw new Error('Invalid audio permission token');
    const startedAtMs=options.now(),expiresAtMs = startedAtMs + armLifetimeMs;
    state = { phase, webContents, token, expiresAtMs,startedAtMs, detach: observe(webContents) };
    report('intent-created');
    expiry = options.setExpiry(() => {
      if ((state?.phase === 'armed'||state?.phase === 'discovering') && state.token === token) {report('intent-expired');clearState();}
    }, armLifetimeMs);
    return Object.freeze({ token, expiresAtMs });
  }

  return Object.freeze({
    discover(webContents: PermissionWebContents): AudioPermissionArm {
      return begin(webContents, 'discovering');
    },
    arm(webContents: PermissionWebContents): AudioPermissionArm {
      return begin(webContents, 'armed');
    },
    activate(webContents: PermissionWebContents, token: string) {
      if (!state || state.phase !== 'attempting' || state.webContents !== webContents || state.token !== token) {report('activation-mismatch');return false;}
      if(options.now()>state.attemptExpiresAtMs!){report('attempt-expired');clearState();return false;}
      if(!exactWebContents(webContents)){report('activation-context-rejected');clearState();return false;}
      clearExpiry();
      state.phase = 'active';
      report('capture-activated');
      return true;
    },
    cancel(webContents: PermissionWebContents, token: string) {
      if (!state || state.webContents !== webContents || state.token !== token) return false;
      report('intent-cancelled');clearState();
      return true;
    },
    revoke(webContents?: PermissionWebContents) {
      if (!state || (webContents && state.webContents !== webContents)) return false;
      report('capture-revoked');clearState();
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
