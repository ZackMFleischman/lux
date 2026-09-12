# TR-01 preflight 2026-09-12T03-58-13-463Z

Source: ab6e699582fb89a6b810da7b3161a24fb4e75066

Decision: UNAVAILABLE — dependent integration gate remains blocked. Inventory and fixture success are not GPU/host acceptance.

- **pass** Windows inventory: {"caption":"Microsoft Windows 11 Pro","architecture":"64-bit","build":"26200","version":"10.0.26200"}
- **pass** native x64 process: win32/x64
- **fail** dependency electron: TR-01 prerequisite: pnpm install --frozen-lockfile; Cannot find module 'electron' (missing dependency regression)
- **pass** dependency three: 0.186.0
- **pass** dependency @modelcontextprotocol/sdk: 1.30.0
- **pass** dependency typescript: 7.0.2
- **pass** dependency zod: 3.25.76
- **pass** pinned development tools: Node 24.12.0; pnpm 10.33.0
- **pass** visualStudio: 18.1.11312.151
- **pass** compiler: 19.50.35721.0
- **pass** cmake: cmake version 4.1.1-msvc1
- **pass** windowsSdk: 10.0.26100.0
- **unavailable** Electron executable version tuple: TR-01 prerequisite: pnpm install --frozen-lockfile, then install the pinned Electron binary; Cannot find module 'electron' (missing dependency regression)
- **pass** native QPC smoke: {"target":"lux_native_smoke","architecture":"x64","qpcFrequency":10000000,"compiler":195035721,"gpuTested":false,"hostTested":false}
- **pass** host executable inventory: C:/Program Files/Resolume Avenue/Avenue.exe: 7.27.1.15990
- **unavailable** host plugin directory: Requires actual host preference observation; no host settings changed
- **unavailable** host refresh: Requires actual host/display measurement; inventory cannot prove 60 Hz
- **unavailable** adapter selection: TR-02 must record renderer/bridge/host DXGI LUIDs and reject mismatch
- **unavailable** GPU timestamp queries: TR-02 must probe selected device feature, enable it, and establish full timing coverage
- **unavailable** trace capability: TR-02 must discover runtime trace categories and record selected process coverage
- **unavailable** external client image observation: Run pnpm test:mcp -- --profile-fixture, then record separate actual client image observation; automated image decoding is insufficient

Full commands, outputs, source pins and version tuples are retained in environment.json.
