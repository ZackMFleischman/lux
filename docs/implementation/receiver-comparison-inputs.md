# Retained receiver build inputs: investigation result

LUX-48 specification 2, investigated 13 September 2026 by `/root/receiver_inputs_provenance`, stable agent `7079fdf6-10b4-437d-918b-9d74d6b43650`, session `67796d69-5b8b-4969-903b-51a4f526b797`. Isolated checkout `C:/Users/zFlei/repos/lux/.worktrees/receiver-inputs-provenance`, branch `codex/receiver-inputs-provenance`, application source base `f176aaad6b9af46aee14546553451f14c69d2ee2`. The exact submitted documentation commit is recorded by Conductor and the submission receipt.

**The investigation is complete; receiver package preparation prerequisites are not.** The accepted [comparison plan](receiver-comparison-plan.md) and its independent LUX-41 review remain unchanged. Local Node header/archive equality and FFGL source identity are established. No Node archive/import-library acquisition receipt was found in the bounded retained project evidence search. The prescribed main Electron dependency contains package metadata but no runtime distribution. Neither gap is resolved by this report. No build, export, installation, network acquisition, package execution, GPU, Studio, portal or graphics reservation occurred.

## Evidence location and reproduction

All artifacts below are relative to `C:/Users/zFlei/repos/lux/.worktrees/receiver-inputs-provenance/artifacts/receiver-comparison-inputs/`. Root explicitly approved retaining this bounded directory **untracked**, with only this report staged; no shared ignore configuration was changed. Original partial runs remain intact. The exact successful read-only inventory is `inventory.mjs` with `v3/` outputs; `inventory-v1.mjs`, `inventory-v2.mjs` and their failed logs are retained separately. Run with `C:/Program Files/nodejs/node.exe` from the worker checkout. A repeat must select new output paths to preserve these observations.

`acquisition-search.mjs` produced `acquisition-search-v2.json`; `retained-candidate.mjs` produced `candidate/electron-retained-candidate.json`. These use only Node built-ins for filesystem reads, SHA256, bounded gzip/tar reads and scoped Git inspection. No inspected package module is imported. `system-tool-identities.json` and `candidate-executable-version.json` were produced using PowerShell `Get-Item`, `Get-FileHash -Algorithm SHA256`, and the returned file's `VersionInfo.FileVersion`/`ProductVersion`, without launching those binaries. Full paths, byte lengths and hashes are in the records.

| Artifact | SHA256 | Scope |
| --- | --- | --- |
| `v3/dependencies.json` | `4d43b83a0f8e7312da6512528b6ace71533d5b2771df601e80c147de4dae4e85` | Full canonical dependency inventory and link topology |
| `acquisition-search-v2.json` | `cec9a104c28d4fa51e69418194a01c2bc14e7c50e25ec839fd861353eabf0b33` | Exact searched paths, lengths, hashes, matches and exclusions |
| `system-tool-identities.json` | `79157efaf77334c8f4aa621640f37ec6a86fe2a61f4fc7865482943f79272164` | Seven CRT DLLs, selected installed build tools and missing main Electron executable |
| `candidate/electron-retained-candidate.json` | `6938c821c9e206311c7739deaa92b86cc91737c005e620f7d29381811b4e2ec7` | Separate retained Electron candidate; not a substituted dependency |

`v3/inventory-summary.json` indexes the remaining successful manifests by hash and records admission/phase observations. This is point-in-time investigation evidence, not the before/after input manifests of a future build. Any subsequent preparation must establish its own unchanged input closure and command-to-output attribution.

## Node headers and import library

Canonical retained root: `C:/Users/zFlei/repos/lux/.worktrees/transport/native/vendor/node`. `v3/node-retained.json` inventories 2,812 regular files, zero links and 621 directories: the archive, import library and 2,810 extracted files. `v3/node-archive-comparison.json` verifies tar header checksums, bounded size and termination, rejects unsafe paths/unsupported entry kinds, reads GNU long-name metadata, and compares each regular member's byte length and SHA256 directly to its extracted counterpart without writing extracted files. All 2,810 match and there are no extra extracted files. Expanded archive size is 63,805,440 bytes; decompression admission was 128 MiB.

| Retained input | Bytes | SHA256 |
| --- | --- | --- |
| `headers.tar.gz` | 10,299,706 | `7b2141e77e66ab23ead6b200c546afc5837136e3075d8a3ac5a67e540dcc59c1` |
| `node.lib` | 1,334,576 | `fc08ff294c2db5f0c9184a60ba52aa756fdada5b458108b6eda2308a3da5e48f` |
| `node-v24.20.0/include/node/node_version.h` | 4,247 | `60ebf5f2ed30034c897df39ac163918b7b84e4f82a68355af7b6466922768ee1` |

The actual header declares major/minor/patch 24/20/0, N-API supported range 1–10 and default module API 8. Its module-version definition is conditional: `NODE_EMBEDDER_MODULE_VERSION` overrides the default 137. This is header text, not evidence that a built addon activates under Electron. `native/CMakeLists.txt` selects these relative headers and `vendor/node/node.lib`; no configuration was generated to prove the eventual build's selected paths or flags.

The final bounded search examined 1,222 files / 76,153,339 bytes under main `docs/` and transport `docs/`, `evidence/`, `artifacts/`, `scripts/`. Its 21 actual exclusions are browser-profile directories, individually listed; links are not followed, only documented text extensions are searched, and files over 16 MiB would be recorded as excluded. Every searched file has a hash. Five matching files contain current plan/ticket references, not acquisition receipts. The preceding search of 1,219 files is retained; root added coordination evidence between scans. This supports **no receipt found in this specified evidence scope**, not an assertion that no receipt exists anywhere on the machine. Filename, timestamp, local hash, the historical TR-01 runtime tuple and equal archive contents do not establish upstream authenticity or the archive/library acquisition source.

## Dependencies, source and tooling

`v3/dependencies.json` covers 15,733 regular files / 221,839,309 bytes, 2,697 canonical directories and 750 links. Canonical visited-directory tracking prevents duplicate traversal; cycles and unexplained outside-root targets are rejected. The actual `pnpm-workspace.yaml` and four `@lux` links explain the explicitly allowed extra roots: main `apps/build-worker`, `apps/studio`, `packages/runtime-contracts`, `packages/visual-sdk`. The inventory is a conservative superset, not an esbuild read trace. The 142 regular files under these workspace roots were rehashed in `workspace-input-recheck.json`: all match. Scoped Git diff between the worker base and observed main `b02622d23576ffb9376ce7ee853eee5e7f1c248b` contains no change in those four roots. Main is active; future reuse requires fresh verification.

`v3/dependency-package-identities.json` records package.json identities and their hashes. TypeScript and its actual Windows x64 compiler package are 7.0.2; esbuild and its Windows x64 binary package are 0.28.2. Both compiler/bundler binaries and transitive package files are included in the full hash inventory. No version-discovery import ran. `v3/tracked-source.json` hashes all 716 tracked worker-base files, including package/lock/workspace metadata, native receiver/bridge, render worker, build/export owners, runtime scripts and triangle fixture. It does not claim that the missing generated runtime outputs exist.

Read-only tool metadata identifies CLI Node 24.12.0, CMake/CTest 4.1.1-msvc1, MSVC compiler 19.50.35721.0 and linker 14.50.35721.0 in toolset 14.50.35717, MSBuild 18.0.5.56406, and SDK resource tools under 10.0.26100.0 with file version 10.0.26100.7175. Their exact executable hashes are recorded. This is selected tool identity, not a complete trace of future compiler DLL/header/library inputs or proof of selected build flags. The actual b1 build and transitive native attribution remain required.

`v3/ffgl-source-comparison.json` compares the canonical transport `native/vendor/ffgl/source/lib` against main `docs/conductor-onboarding/receiver-vendor-source-manifest.json`: all 203 files / 3,504,300 bytes match, no extra files or links. Scoped Git inspection of the canonical FFGL checkout returns `fda8d4a5904eaf09dd97ac0f95c246bd7f9f9a46`, matching the retained source manifest. No vendor files or Git metadata were copied; destination preparation and revalidation remain future work.

## Electron and CRT inputs

Main `node_modules/electron` resolves to `C:/Users/zFlei/repos/lux/node_modules/.pnpm/electron@44.3.0/node_modules/electron`. Its package.json says 44.3.0; `dist/` and `path.txt` are absent (`v3/electron-distribution.json`, `v3/electron-metadata.json`). The existing exporter explicitly copies this resolved root's `dist`; package metadata alone cannot satisfy its input. No Electron binary was launched or downloaded.

Transport's Electron junction resolves elsewhere: `C:/Users/zFlei/repos/lux/.worktrees/tracer/node_modules/.pnpm/electron@44.3.0/node_modules/electron`. The separate retained-candidate inventory has 73 regular runtime files / 385,279,660 bytes, zero links, package metadata/license files and `path.txt`. Its 246,070,272-byte `dist/electron.exe` has file/product version 44.3.0 and SHA256 `e048632e03fabc96de5e10afbebc0aa31f4e1674155ea3d270597fe7523f9d80`. Historical `docs/implementation/tr01-report.md` says Electron's installer was run, but it does not by itself bind this entire candidate distribution to a verified acquisition. The candidate was not copied, activated, substituted into main, or approved as satisfying b1.

All seven filenames actually declared by `packageIO.nativeRuntimeFiles` exist at their prescribed `C:/Windows/System32` locations: `msvcp140.dll`, `msvcp140_1.dll`, `msvcp140_2.dll`, `msvcp140_atomic_wait.dll`, `msvcp140_codecvt_ids.dll`, `vcruntime140.dll`, `vcruntime140_1.dll`. Every observed file version is 14.51.36247.0. Exact hashes and byte lengths are in `system-tool-identities.json`. No system file was copied or changed. Future paired arms must use the same reverified bytes.

## Limits, failures and handoff

Successful v3 inventory used 22,280 file-hash operations, below 200,000, and about 6.74 MB of manifest output, below 128 MiB. Admission and subsequent phase checks observed over 394 GB free, above 12 GiB. No build/package output was generated. Final whole-evidence byte/log checks are retained with submission; the 8 GiB generated-storage and 16 MiB individual-log limits were not approached. These are admission/phase checks, not hard OS quotas or deadlines.

Preserved setup failures: unsupported Conductor `session start --help` returned usage without mutation; an initial receipt write targeted a not-yet-created coordination directory, then the directory was created before successful startup receipt persistence. The first archive reader refused GNU `L` metadata, and the next dependency reader rejected the first workspace link outside node_modules. Corrected investigation scripts explicitly support bounded long names and the four evidenced workspace roots. These failed probes executed no archive contents and modified no source inputs. Only one ticket claim was attempted, after own ACK and dynamic-ready verification; successful claim `0354056e-4442-47ba-b4f4-7e4ade3a3238` is retained in main `.worktrees/_coordination/LUX-48/claim.json`.

Prerequisite problem LUX-P44 (`cfc8f93e-a31c-407d-81d8-bb859d71abf3`) records the unavailable Node acquisition attribution and missing main Electron distribution. Root and a fresh independent reviewer must resolve those original prerequisites before b1, without silently weakening its criteria or treating this candidate inventory as approval. Then b1 still needs its own prepared input paths, unchanged input rehash, semantic checks, nine-target build, CPU/JS evidence, frozen transport, actual treatment package and command-to-output provenance. Baseline patch review, paired observation and physical execution remain later gates.

Investigation status: **local closures and missing facts documented**. Package status: `hostTested=false`, `gpuTested=false`, `installed=false`, `performanceAcceptance=false`, `pairedComparisonReady=false`; no package was produced. This report is ready for independent review and serial document integration, not package acceptance.
