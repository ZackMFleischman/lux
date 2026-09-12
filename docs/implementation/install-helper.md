# Native-dialog package installation

`install-gui.cjs` is the double-click package entrypoint using the bundled
Electron executable. It disables hardware acceleration and creates no browser
window, texture bridge, visual worker or playback producer. `install.cjs` remains
available for explicit CLI/CPU tooling.

The helper validates the whole package and installed-runtime capability markers
before presenting its source name. The user chooses the Extra Effects folder
configured in Resolume and confirms the two destination paths. Cancelling any
dialog performs no installation or registration.

A hidden, read-only `System32/tasklist.exe /FO CSV /NH` query checks Avenue.exe
and Arena.exe, with a five-second timeout and bounded output. Query failures fail
closed. The helper checks before installation and again after the immutable
package copy, immediately before calling registration. If Resolume opens during
the copy, package storage remains but no DLL is registered. The user can close
Resolume and rerun the same package. These checks are a preflight; they cannot
prevent a user launching Resolume concurrently after the final check.

Packaging integration must include `install-gui.cjs` and `install-flow.cjs` at
the runtime root, and change the CRLF `install.cmd` body to:

```bat
@echo off
setlocal
set "ELECTRON_RUN_AS_NODE="
start "" "%~dp0runtime\electron\electron.exe" "%~dp0runtime\install-gui.cjs" "%~dp0."
```

CPU tests inject dialogs, process queries and package filesystem operations.
They cover each cancellation point, corrupt packages, hosts already running or
starting during copy, bounded tasklist invocation and malformed tasklist output.
No actual Electron installer or plugin registration was run for this checkpoint.
