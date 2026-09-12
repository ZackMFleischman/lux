# Tracer environment and preflight

## Read-only inventory

Observed during the planning pass on 12 September 2026 UTC (11 September local). This is inventory, not a successful runtime or host test.

| Item | Observed value | Implementation check |
| --- | --- | --- |
| OS | Windows 11 Pro, 10.0.26200, x64 | Record patch/build and display refresh configuration. |
| Discrete GPU | NVIDIA GeForce RTX 2070, driver 32.0.15.9144 | Explicitly select this adapter for renderer/native/host; record DXGI adapter LUID and WebGPU adapter details. |
| Other adapter | Intel UHD Graphics, driver 26.20.100.7642 | Do not silently cross adapters. Detect and report mismatch. |
| Resolume | Avenue 7.27.1; executable file version 7.27.1.15990 | Launch installed host, verify plugin discovery, supported GL/FFGL behavior and 60 Hz test settings. |
| Host path | `C:/Program Files/Resolume Avenue/Avenue.exe` | Do not overwrite the installation; follow host plugin search paths and isolated tracer plugin naming. |
| Node | 24.12.0 on PATH | Separate development Node from Electron's embedded Node ABI. |
| pnpm | 10.33.0 | Pin package manager and lockfile. |
| Native tooling | Visual Studio Build Tools 2026, 18.1.11312.151 installed | Verify x64 C++ compiler, Windows SDK and CMake availability via Developer PowerShell; inventory alone did not establish workloads. |
| Repository | Documentation only at source commit `1c9c884` | No pre-existing app build/test commands exist. Proposed commands in tracer plan must be created by their owning task. |

WMI AdapterRAM is not reliable evidence of physical VRAM capacity and is intentionally omitted. No application or package versions other than those above have been installed or exercised by this planning pass.

## Preflight output

Task TR-01 must create `evidence/tracer-0.1/environment.json` containing OS, CPU, physical GPU/driver and chosen adapter IDs, display/host refresh, host path/version, Electron/Chromium/Node versions, Three.js and MCP SDK versions, FFGL and Spout source commit hashes, native compiler/SDK/CMake versions, build configuration and source commit. Resolve package versions once, pin exact versions/commits and retain the lockfile. Do not use moving branch heads in benchmark manifests.

Create `evidence/tracer-0.1/preflight.md` with actual discovery commands, successes/failures, device selection evidence and client MCP protocol compatibility. Confirm external AI tool discovery and PNG image display using a known fixture before relying on generated output. Fixture success is only preflight evidence, not T01/T02 completion.

Missing tools can be installed in the implementation phase within authorized scope. An unavailable host/GPU or license is a hardware acceptance blocker; headless CI cannot replace the actual-host run. Preserve useful unit-test work, but do not mark tracer complete until host gates run.
