# lux
A tool for generating visuals for VJs

Tracer 0.1 implementation is in progress. The environment/build/MCP fixture harness is implemented; the real GPU-to-Resolume path is under experiment. There is no finished Studio application yet. See [implementation progress](docs/implementation/progress.md), [architecture](docs/architecture.md), and the [tracer plan](docs/implementation/tracer-0.1.md).

## Development harness

Current reference: Windows x64, Node 24.12.0, pnpm 10.33.0, Visual Studio Build Tools 2026 with the x64 C++ workload and CMake, Windows SDK 10.0.26100.0. Exact package/source pins are in `config/dependency-pins.json` and `pnpm-lock.yaml`.

```powershell
pnpm install --frozen-lockfile
pnpm studio:setup
pnpm studio:check
pnpm typecheck
pnpm test:unit
pnpm build
pnpm native:build
pnpm test:mcp -- --profile-fixture
pnpm preflight
```

`pnpm studio:setup` installs or repairs the exact Electron version pinned in this checkout using Electron's official installer and checksum verification. It reuses Electron's shared download cache (`%LOCALAPPDATA%/electron/Cache` on Windows); no global Electron installation is needed. Each checkout keeps its own dependencies and runtime. See [Electron installation](https://www.electronjs.org/docs/latest/tutorial/installation).

Normal `pnpm studio` and `pnpm studio:creative` launches also prepare a missing runtime before opening Studio. First-use creative startup needs `pnpm install --frozen-lockfile` in the reserved checkout returned by `node scripts/studio-creative.mjs --prepare`; `/start-lux` handles this setup. Existing creative reservations stay pinned. Setup never upgrades the pin or falls back to repairing another checkout's dependencies.

`pnpm studio:check`, preflight, and automated tests never download Electron. Run `pnpm studio:setup` before live tests. A failed download reports its error and stops startup; rerun setup after restoring network access. Preflight records actual observations and exits nonzero while hardware integration requirements are unavailable. That is expected before the GPU experiment passes, not a passing hardware test.

The MCP fixture is test-only. It proves protocol negotiation and PNG delivery, not visual generation or live playback. Native smoke verifies the C++ toolchain and monotonic clock, not GPU transport. Preserve these distinctions in test reports.
