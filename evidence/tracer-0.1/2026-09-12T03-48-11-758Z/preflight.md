# TR-01 preflight 2026-09-12T03-48-11-758Z

Source: 7d7a5f15a7df2c031311f9b1ba879c0bbfaa33d1

Decision: UNAVAILABLE — dependent integration gate remains blocked. Inventory and fixture success are not GPU/host acceptance.

- **pass** Windows inventory: {"caption":"Microsoft Windows 11 Pro","architecture":"64-bit","build":"26200","version":"10.0.26200"}
- **pass** native x64 process: win32/x64
- **pass** dependency electron: 44.3.0
- **pass** dependency three: 0.186.0
- **fail** dependency @modelcontextprotocol/sdk: TR-01 prerequisite: pnpm install --frozen-lockfile; Cannot find module 'C:\Users\zFlei\repos\lux\.worktrees\tr01-harness\node_modules\@modelcontextprotocol\sdk\dist\cjs\index.js'
- **pass** dependency typescript: 7.0.2
- **pass** dependency zod: 3.25.76
- **pass** pinned development tools: Node 24.12.0; pnpm 10.33.0
- **pass** visualStudio: 18.1.11312.151
- **pass** compiler: 19.50.35721.0
- **pass** cmake: cmake version 4.1.1-msvc1
- **pass** windowsSdk: 10.0.26100.0
- **unavailable** Electron executable version tuple: spawnSync C:\Program Files\nodejs\node.exe ETIMEDOUT
- **pass** native QPC smoke: {"target":"lux_native_smoke","architecture":"x64","qpcFrequency":10000000,"compiler":195035721,"gpuTested":false,"hostTested":false}
- **pass** host executable inventory: C:/Program Files/Resolume Avenue/Avenue.exe: 7.27.1.15990
- **unavailable** host plugin directory: Requires actual host preference observation; no host settings changed
- **unavailable** host refresh: Requires actual host/display measurement; inventory cannot prove 60 Hz
- **unavailable** adapter selection: TR-02 must record renderer/bridge/host DXGI LUIDs and reject mismatch
- **unavailable** GPU timestamp queries: TR-02 must probe selected device feature, enable it, and establish full timing coverage
- **unavailable** trace capability: TR-02 must discover runtime trace categories and record selected process coverage
- **unavailable** external client image observation: Run pnpm test:mcp -- --profile-fixture, then record separate actual client image observation; automated image decoding is insufficient

Full commands, outputs, source pins and version tuples are retained in environment.json.
