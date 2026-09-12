# lux
A tool for generating visuals for VJs

Tracer 0.1 implementation is in progress. The environment/build/MCP fixture harness is implemented; the real GPU-to-Resolume path is under experiment. There is no finished Studio application yet. See [implementation progress](docs/implementation/progress.md), [architecture](docs/architecture.md), and the [tracer plan](docs/implementation/tracer-0.1.md).

## Development harness

Current reference: Windows x64, Node 24.12.0, pnpm 10.33.0, Visual Studio Build Tools 2026 with the x64 C++ workload and CMake, Windows SDK 10.0.26100.0. Exact package/source pins are in `config/dependency-pins.json` and `pnpm-lock.yaml`.

```powershell
pnpm install --frozen-lockfile
node node_modules/electron/install.js
pnpm typecheck
pnpm test:unit
pnpm build
pnpm native:build
pnpm test:mcp -- --profile-fixture
pnpm preflight
```

The Electron install is explicit; preflight never downloads it implicitly. Preflight records actual observations and exits nonzero while hardware integration requirements are unavailable. That is expected before the GPU experiment passes, not a passing hardware test. Later-task commands similarly report their missing prerequisite rather than silently passing.

The MCP fixture is test-only. It proves protocol negotiation and PNG delivery, not visual generation or live playback. Native smoke verifies the C++ toolchain and monotonic clock, not GPU transport. Preserve these distinctions in test reports.
