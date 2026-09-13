// Bundle this trusted CPU worker separately before enabling async imports in UI.
import { handleSourceAdmission } from './admission-worker-handler.mjs';
globalThis.onmessage = event => { globalThis.postMessage(handleSourceAdmission(event.data)); };
