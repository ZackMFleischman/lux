// Private installed diagnostic, absent from authored SDK/context.
export function createInitializationProbe(owner, post) {
  let resolve, pending = true;
  const wait = new Promise(done => { resolve = done; });
  post({type:'init-probe-ready',...owner});
  return {wait, cancel() { pending=false; resolve=undefined; }, accept(message) {
    if (!pending || message?.type !== 'init-probe-go' ||
        ['instanceId','generation','revisionId','initProbeId'].some(key => message[key] !== owner[key])) return false;
    pending=false; const done=resolve;resolve=undefined;done(); return true;
  }};
}
