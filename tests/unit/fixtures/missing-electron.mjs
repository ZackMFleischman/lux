import Module from 'node:module';

// Test-only loader: exercise a missing package without changing node_modules.
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (specifier, ...args) {
  if (specifier === 'electron') {
    throw Object.assign(new Error("Cannot find module 'electron' (missing dependency regression)"), { code: 'MODULE_NOT_FOUND' });
  }
  return originalResolve.call(this, specifier, ...args);
};
