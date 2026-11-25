# Independent runtime setup review

## Final re-review: PASS

Final reviewed commit: `204f985ae42f5e20b4f6b2feb036da71f695bbd5`.

The P2 finding below is resolved. The final two-file delta normalizes environment key case and underscores, then strips direct, npm configuration, and package configuration aliases for mirror, custom version/path/name, platform/architecture, and remote checksum overrides. This covers the downloader aliases observed in the original review. The inert child-installer regression confirms representative aliases do not reach the subprocess and the shared-cache setting remains. Proxy settings are preserved by inspection of the narrowly matched filter.

Independently reran the same four-file focused test command below at the final commit: exit 0; 22 passed, 0 failed, 0 skipped. No actionable findings remain in this bounded source review. No real installation, download, or Studio/GPU launch was performed. Installed-runtime, real creative-workflow, skill-installation, and host acceptance remain outside this review.

Fresh re-review session: `a70c894b-87af-41f5-a1c3-8c24b04f72fa`, using the same distinct reviewer identity. No ticket claim or source changes were made. Original finding and evidence are preserved below.

## Original review

Reviewed 2026-09-13 by `lux-runtime-setup-review-20260913`.

- Reviewer agent: `4fda68a4-775b-4358-be81-065864674840`.
- Reviewer session: `5c84b121-c3fc-401b-a92d-5abcf9065c77`.
- Worktree: `C:/Users/zFlei/repos/lux/.worktrees/runtime-setup`.
- Branch: `codex/runtime-setup`.
- Base: `ea1a2e57013f03a3379c11e8dbb0d64057a4814c`.
- Reviewed head: `bee9b6d81ae55114d3dbc1cc5133fe8348d03342`.
- LUX-96 ownership remained with the implementer. The reviewer took no claim.

## Finding

### P2: Remove every supported Electron mirror and custom-version environment alias

Location: `scripts/studio-electron.mjs:70-71`.

The setup subprocess inherits npm/package configuration aliases that the filter does not remove. The installed pinned dependency `@electron/get` 5.1.0 reads `npm_config_electron_mirror`, `NPM_CONFIG_ELECTRON_MIRROR`, and `npm_package_config_electron_mirror`, plus corresponding camel/snake aliases for `nightlyMirror`, `customDir`, `customFilename`, and `customVersion`. Even direct `ELECTRON_CUSTOM_VERSION` survives. A user with one of these settings can therefore start Lux and request a custom host or another version instead of the promised official pinned distribution. A custom version normally fails against the bundled pin's checksums, blocking startup even when the official pinned artifact is available. Hash verification is still present; this finding does not claim that arbitrary unverified binaries are accepted.

Remove all downloader-supported override aliases before invoking the installer, retaining intended cache/proxy settings. Add an inert fixture assertion for the actual child environment, covering at least an npm mirror alias and `ELECTRON_CUSTOM_VERSION`.

Evidence: read-only inspection of `C:/Users/zFlei/repos/lux/node_modules/.pnpm/@electron+get@5.1.0/node_modules/@electron/get/dist/artifact-utils.js:20-52` and `dist/index.js:109-112`. An inert Node invocation imported only artifact URL utilities, applied the new filter to synthetic values, and observed:

```json
{"surviving":{"npm_config_electron_mirror":"https://example.invalid/electron/","ELECTRON_CUSTOM_VERSION":"v45.0.0"},"version":"v45.0.0","url":"https://example.invalid/electron/44.3.0/electron-44.3.0-win32-x64.zip"}
```

The utility URL call above used the unchanged input version to isolate mirror selection. The downloader itself first assigns `details.version = getArtifactVersion(details)` before constructing that URL, so it also applies the surviving custom version.

## Validation and limits

Executed in the reviewed worktree:

```text
node --test tests/studio/electron-setup.test.mjs tests/studio/creative-checkout.test.mjs tests/studio/session-isolation.test.mjs tests/unit/install-visual-skill.test.mjs
```

Result: exit 0; 21 passed, 0 failed, 0 skipped. The tests execute inert fixture installers, not the real Electron installer. Reviewed normal startup, smoke/test routing, checkout containment, pinned package/version checks, setup lock/failure paths, first-use frozen dependency instructions, and existing creative reservation behavior. No other actionable findings were identified in this bounded review.

No real runtime install, network download, Studio/GPU launch, creative reservation mutation, tracked source edit, index edit, or HEAD change was performed. The worktree had no status entries and retained the reviewed HEAD after testing. This review does not establish a working installed runtime, real creative workflow, skill installation, or host/GPU acceptance.
