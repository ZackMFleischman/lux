"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// apps/studio/src/audio/audio-permission-broker.ts
var audio_permission_broker_exports = {};
__export(audio_permission_broker_exports, {
  createAudioPermissionBroker: () => createAudioPermissionBroker
});
module.exports = __toCommonJS(audio_permission_broker_exports);
function createAudioPermissionBroker(options) {
  const armLifetimeMs = 5e3, attemptLifetimeMs = 6e4;
  let state = null;
  let expiry;
  let disposed = false;
  function report(code, current = state) {
    const now = options.now();
    try {
      options.diagnostic?.({ stage: current?.phase ?? "none", code, elapsedMs: current ? Math.max(0, now - current.startedAtMs) : 0, ...current?.attemptedAtMs === void 0 ? {} : { attemptMs: Math.max(0, now - current.attemptedAtMs) } });
    } catch {
    }
  }
  function clearExpiry() {
    if (expiry === void 0) return;
    options.clearExpiry(expiry);
    expiry = void 0;
  }
  function clearState() {
    clearExpiry();
    const previous = state;
    state = null;
    previous?.detach();
  }
  function exactWebContents(webContents) {
    const main = options.getMainWebContents();
    return !!webContents && !!main && webContents === main && !webContents.isDestroyed() && webContents.getURL() === options.pageUrl;
  }
  function exactRequest(webContents, permission, details) {
    return exactWebContents(webContents) && permission === "media" && details?.isMainFrame === true && details.requestingUrl === options.pageUrl && details.securityOrigin === options.securityOrigin && Array.isArray(details.mediaTypes) && details.mediaTypes.length === 1 && details.mediaTypes[0] === "audio";
  }
  function exactAudioCheck(webContents, permission, requestingOrigin, details, phase) {
    if (!exactWebContents(webContents) || permission !== "media" || details?.isMainFrame !== true) return false;
    const legacyProbe = requestingOrigin === "" && details.requestingUrl === "" && details.securityOrigin === void 0 && details.embeddingOrigin === options.securityOrigin && details.mediaType === "audio";
    const documentAudio = requestingOrigin === options.securityOrigin && details.requestingUrl === options.pageUrl && details.securityOrigin === options.securityOrigin && details.embeddingOrigin === void 0 && details.mediaType === "audio";
    const captureContinuation = requestingOrigin === options.securityOrigin && details.requestingUrl === options.pageUrl && details.securityOrigin === void 0 && details.embeddingOrigin === options.securityOrigin && details.mediaType === void 0;
    return legacyProbe || documentAudio || (phase === "attempting" || phase === "active") && captureContinuation;
  }
  function observe(webContents) {
    const revoke = () => {
      report("context-revoked");
      clearState();
    };
    const events = ["did-start-navigation", "render-process-gone", "destroyed"];
    for (const event of events) webContents.on(event, revoke);
    return () => {
      for (const event of events) webContents.removeListener(event, revoke);
    };
  }
  options.session.setPermissionRequestHandler((webContents, permission, callback, details) => {
    const current = state;
    if (!current || current.phase !== "armed" || current.webContents !== webContents) {
      if (current?.phase === "discovering") clearState();
      callback(false);
      return;
    }
    const fresh = options.now() <= current.expiresAtMs;
    const allowed = fresh && exactRequest(webContents, permission, details);
    if (allowed) {
      clearExpiry();
      current.phase = "attempting";
      current.attemptedAtMs = options.now();
      current.attemptExpiresAtMs = current.attemptedAtMs + attemptLifetimeMs;
      expiry = options.setExpiry(() => {
        if (state === current && state.phase === "attempting") {
          report("attempt-expired");
          clearState();
        }
      }, attemptLifetimeMs);
      report("request-accepted");
    } else {
      report(fresh ? "request-rejected" : "intent-expired");
      clearState();
    }
    callback(allowed);
  });
  options.session.setPermissionCheckHandler((webContents, permission, requestingOrigin, details) => {
    const current = state;
    if (!current || current.webContents !== webContents || !exactAudioCheck(webContents, permission, requestingOrigin, details, current.phase)) return false;
    if (current.phase === "armed") {
      if (options.now() > current.expiresAtMs) {
        report("intent-expired");
        clearState();
      } else if (!current.checkReported) {
        current.checkReported = true;
        report("check-await-request");
      }
      return false;
    }
    if (current.phase === "attempting") {
      if (options.now() > current.attemptExpiresAtMs) {
        report("attempt-expired");
        clearState();
        return false;
      }
      return requestingOrigin === options.securityOrigin && details.requestingUrl === options.pageUrl && details.securityOrigin === void 0 && details.embeddingOrigin === options.securityOrigin && details.mediaType === void 0;
    }
    if (current.phase === "active") return true;
    if (options.now() <= current.expiresAtMs) return true;
    clearState();
    return false;
  });
  function begin(webContents, phase) {
    if (disposed) throw new Error("Audio permission broker is disposed");
    if (!exactWebContents(webContents)) throw new Error("Untrusted audio permission sender");
    clearState();
    const token = options.createToken();
    if (typeof token !== "string" || token.length < 16 || token.length > 256) throw new Error("Invalid audio permission token");
    const startedAtMs = options.now(), expiresAtMs = startedAtMs + armLifetimeMs;
    state = { phase, webContents, token, expiresAtMs, startedAtMs, detach: observe(webContents) };
    report("intent-created");
    expiry = options.setExpiry(() => {
      if ((state?.phase === "armed" || state?.phase === "discovering") && state.token === token) {
        report("intent-expired");
        clearState();
      }
    }, armLifetimeMs);
    return Object.freeze({ token, expiresAtMs });
  }
  return Object.freeze({
    discover(webContents) {
      return begin(webContents, "discovering");
    },
    arm(webContents) {
      return begin(webContents, "armed");
    },
    activate(webContents, token) {
      if (!state || state.phase !== "attempting" || state.webContents !== webContents || state.token !== token) {
        report("activation-mismatch");
        return false;
      }
      if (options.now() > state.attemptExpiresAtMs) {
        report("attempt-expired");
        clearState();
        return false;
      }
      if (!exactWebContents(webContents)) {
        report("activation-context-rejected");
        clearState();
        return false;
      }
      clearExpiry();
      state.phase = "active";
      report("capture-activated");
      return true;
    },
    cancel(webContents, token) {
      if (!state || state.webContents !== webContents || state.token !== token) return false;
      report("intent-cancelled");
      clearState();
      return true;
    },
    revoke(webContents) {
      if (!state || webContents && state.webContents !== webContents) return false;
      report("capture-revoked");
      clearState();
      return true;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      clearState();
      options.session.setPermissionRequestHandler(null);
      options.session.setPermissionCheckHandler(null);
    }
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createAudioPermissionBroker
});
