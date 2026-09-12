# TR-01 preflight 2026-09-12T03-50-51-931Z

Source: 7a588e39ca710d796738e9865e1ddcde8b044c39

Decision: UNAVAILABLE — dependent integration gate remains blocked. Inventory and fixture success are not GPU/host acceptance.

- **pass** Windows inventory: {"caption":"Microsoft Windows 11 Pro","architecture":"64-bit","build":"26200","version":"10.0.26200"}
- **pass** native x64 process: win32/x64
- **pass** dependency electron: 44.3.0
- **pass** dependency three: 0.186.0
- **pass** dependency @modelcontextprotocol/sdk: 1.30.0
- **pass** dependency typescript: 7.0.2
- **pass** dependency zod: 3.25.76
- **pass** pinned development tools: Node 24.12.0; pnpm 10.33.0
- **pass** visualStudio: 18.1.11312.151
- **pass** compiler: 19.50.35721.0
- **pass** cmake: cmake version 4.1.1-msvc1
- **pass** windowsSdk: 10.0.26100.0
- **pass** Electron executable version tuple: {"node":"24.20.0","acorn":"8.18.0","ada":"4.0.0","amaro":"1.1.11","ares":"1.34.8","brotli":"1.2.0","cldr":"48.0","icu":"78.2","llhttp":"9.4.3","merve":"1.2.2","modules":"149","napi":"10","nbytes":"0.1.4","ncrypto":"0.0.1","nghttp2":"1.70.0","nghttp3":"","ngtcp2":"","openssl":"0.0.0","simdjson":"4.6.6","simdutf":"7.7.0","sqlite":"3.53.4","tz":"2025c","undici":"7.29.0","unicode":"17.0","uv":"1.52.1","uvwasi":"0.0.23","v8":"15.2.124.19-electron.0","zlib":"1.3.2.1-motley","zstd":"1.6.0","electron":"44.3.0","chrome":"152.0.7977.78"}
- **pass** native QPC smoke: {"target":"lux_native_smoke","architecture":"x64","qpcFrequency":10000000,"compiler":195035721,"gpuTested":false,"hostTested":false}
- **unavailable** host executable inventory: TR-01 prerequisite: installed Resolume Avenue executable; LUX_PREFLIGHT_HOST can select its path
- **unavailable** host plugin directory: Requires actual host preference observation; no host settings changed
- **unavailable** host refresh: Requires actual host/display measurement; inventory cannot prove 60 Hz
- **unavailable** adapter selection: TR-02 must record renderer/bridge/host DXGI LUIDs and reject mismatch
- **unavailable** GPU timestamp queries: TR-02 must probe selected device feature, enable it, and establish full timing coverage
- **unavailable** trace capability: TR-02 must discover runtime trace categories and record selected process coverage
- **unavailable** external client image observation: Run pnpm test:mcp -- --profile-fixture, then record separate actual client image observation; automated image decoding is insufficient

Full commands, outputs, source pins and version tuples are retained in environment.json.
