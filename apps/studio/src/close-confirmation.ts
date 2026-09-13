/** A reply can only approve the currently displayed request. Cancel is reusable. */
export function createCloseConfirmation(newId: () => string, request: (id: string) => void) {
  let pending: string | null = null, confirmed = false;
  return {
    allowClose(dirty: boolean) {
      if (!dirty || confirmed) return true;
      if (pending === null) { pending = newId(); request(pending); }
      return false;
    },
    reply(id: string, discard: boolean) {
      if (pending === null || id !== pending) throw Error('Close confirmation is no longer current');
      pending = null;
      confirmed = discard;
      return discard;
    },
  };
}
