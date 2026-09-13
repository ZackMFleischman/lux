# Image assets

Use the current running Studio's capabilities. After `discover`, check `runningStudio.compatible`, `runningStudio.capabilities.imageFormats` and `assetExport`; `read`/`status` also report app capabilities. The expected formats are `image/bmp`, `image/png` and `image/jpeg`. Adapter checkout metadata alone does not upgrade an older app. Keep unsupported assets intact and report a version mismatch instead of silently dropping them.

## Source representation and limits

Images belong in a source-v2 bundle. `sourceVersion` is the source envelope version, independent of `sdkVersion` and the saved scene's version. For SDK 0.2 use this shape:

```js
const next = structuredClone(current.source);
next.sourceVersion = 2;
next.assets = { ...next.assets,
  'assets/logo.png': {
    mediaType: 'image/png', encoding: 'base64', data: originalPngBase64,
  },
};
// Keep sdkVersion, entry, every file and every other asset from the read.
// Submit next with current.draftVersion as expectedDraftVersion.
```

`originalPngBase64` must be actual canonical base64 of the complete original file: no data-URL prefix, whitespace, external URL, file path, placeholder, or invented hash. A source asset has exactly `mediaType`, `encoding`, and `data`; do not add dimensions, checksums or derived metadata. Preserve original bytes when changing code. Asset replacement changes source identity even when TypeScript is unchanged.

Logical paths start with `assets/`. Each segment uses ASCII letters, digits, `_` or `-`; the last segment ends in lowercase `.bmp`, `.png`, `.jpg` or `.jpeg`. Use forward slashes, at most 240 characters, no case-only collisions, Windows device names or segments beginning `__lux`. Extension and MIME must match: `.bmp` → `image/bmp`, `.png` → `image/png`, `.jpg`/`.jpeg` → `image/jpeg`.

| Admission limit | Maximum |
| --- | ---: |
| Images per source | 4 |
| Width and height | 512 each |
| Original bytes per image | 786,486 |
| Original bytes across all images | 1,048,576 (1 MiB) |
| Decoded RGBA bytes across all images | 2,097,152 (2 MiB), counting `width × height × 4` |
| Complete compact source-v2 JSON | 6 MiB |
| Build request / complete escaped read tool result | 8 MiB / 16 MiB |

All limits apply together; four 512×512 images exceed the decoded-memory limit. Code separately allows 32 TypeScript files and 1 MiB aggregate UTF-8. Resize or explicitly convert an image before import when the task permits it; do not disguise an unsupported file by renaming its extension.

Supported profiles are deliberately bounded:

- PNG: noninterlaced 8-bit grayscale, RGB, grayscale-alpha or RGBA, and 1/2/4/8-bit indexed images with supported `tRNS` transparency. No 16-bit PNG, APNG or embedded ICC profile; conflicting/non-sRGB color metadata is rejected. Export ordinary sRGB PNG without an ICC profile if admission rejects the source profile.
- JPEG: 8-bit baseline or progressive grayscale/three-component images; EXIF orientations 1–8 are applied by the decoder. Output is opaque. CMYK/YCCK, embedded ICC profiles and unsupported/ambiguous encodings are rejected. Do not rotate the already-oriented decoded pixels a second time.
- BMP: positive-height, opaque 24-bit BI_RGB with the supported 40-byte DIB header, no palette. The decoder normalizes its bottom-up storage to top-down pixels.

## Decoded pixels and textures

`context.images` is a read-only map. `get(path)` returns `undefined` when absent, otherwise `{ width, height, colorSpace: 'srgb', alphaMode: 'straight', data: Uint8Array }`. Pixels are top-down RGBA8. Hidden RGB at alpha zero is preserved in admitted image data. Each retrieval copies pixels, so retrieve once in `create`, retain the texture, and dispose it in `dispose`; do not fetch a fresh array every frame. `context.assets.get(path)` remains available for a protected copy of the original encoded file bytes.

Use the [complete image plane example](../assets/image-plane.ts) with an admitted `assets/image.png`. It creates a Three `DataTexture`, sets sRGB interpretation and explicit `flipY`, uses normal blending of straight-alpha input, and releases its resources. Keep these texture rules when adapting it to a sprite or material. Submitted code cannot use a loader, URL, DOM image, filesystem or network to obtain assets.

The example uses nearest filtering deliberately. Linear filtering of straight-alpha textures can reveal hidden RGB around transparent edges; do not claim filtered-edge fidelity from a nearest-sampled capture. Inspect the actual edge against light and dark backgrounds before delivering a filtered treatment. Do not byte-premultiply sRGB input or multiply alpha again in both the shader and material blend state.

Lux accumulates scene color in linear premultiplied form. Its capture boundary converts to sRGB straight-alpha PNG; alpha-zero output RGB is canonical black. Canvas presentation has its own premultiplied sRGB conversion. Judge both a captured transparent image and its appearance over known backgrounds when transparency matters. An offline package's existence alone does not verify the host compositor's alpha interpretation.

## Editing and offline export

The Source UI imports and validates originals asynchronously. Import, Replace and Remove edit the draft; Build applies it. Select an asset to reach Replace/Remove. Replacing preserves its logical path, so preserve a matching format/MIME. Removing a required image can fail the next build; retain the last good preview and repair the draft rather than deleting unrelated data. A failed or timed-out operation needs a fresh `read` before retrying.

MCP image edits use the same guarded complete-source `build` as code edits. Clone the latest source, modify only the intended asset record, retain all other files/assets, and use that read's draft version. Scene Save/Open and restart preserve original bytes and controls. File Export includes image originals plus the pinned runtime for offline playback without project files or network texture loads. Use it when export is requested and the running capability allows it; installation/registration and live Resolume checks are separate actions.
