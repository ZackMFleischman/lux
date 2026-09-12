# PNG/JPEG assets and correct alpha

Design addendum, 12 September 2026, inspected at `2b81e5e` (including `969c2c7`).
The user's minimum is **PNG with transparency and JPG/JPEG**, not another BMP
variant. This document supplements `required-assets.md`, which remains unchanged.
It specifies implementation and acceptance gates; no codec dependencies were
installed, decoding benchmarks run, or graphics behavior verified in this task.

## Decision

Keep original bytes in source, scene, artifact, linked and transport asset records.
Extend the existing v2 media union with `image/png` and `image/jpeg`, and logical
paths with `.png`, `.jpg`, `.jpeg`. Preserve BMP24 and all legacy hash branches.
Use signature plus declared media type plus extension agreement, never extension
alone. Keep canonical base64, own-data records, case-fold uniqueness, four assets,
512-by-512 dimensions, 786,486 bytes per encoded image file, 1 MiB total original
file bytes and 2 MiB total RGBA. Existing JSON/process/output caps stay unchanged.
A poorly compressed image can exceed its file cap even below maximum dimensions.

Recommend pinned **fast-png 8.0.0**, **pako 2.1.0**, and **jpeg-js 0.4.4**, behind
Lux admission adapters. Pin fast-png's transitive fflate/iobuffer resolution too
(upstream requests `^0.8.2` and `^6.0.1` respectively; select exact audited versions
when installing). Import only decode paths in browser payloads. Preserve upstream
licenses: fast-png MIT; pako MIT/Zlib; jpeg-js decoder Apache-2.0, with the package's
other notices retained if distributed. These are candidate pins to validate, not
a claim that their default APIs safely admit hostile input.
[fast-png package](https://raw.githubusercontent.com/image-js/fast-png/v8.0.0/package.json),
[pako package](https://raw.githubusercontent.com/nodeca/pako/2.1.0/package.json),
[jpeg-js decoder](https://raw.githubusercontent.com/jpeg-js/jpeg-js/v0.4.4/lib/decoder.js).

## PNG: preflight before the general decoder

`fast-png` exposes CRC checking but no output/memory ceiling. Its decoder retains
inflated chunks and also inflates ICC data. An IHDR dimension check followed by
ordinary decode is insufficient. UPNG's broad APNG support and ordinary inflate
entry point do not improve this boundary. Keep fast-png unmodified, but admit its
input only after a bounded independent zlib check of the exact IDAT stream.
[Decoder source](https://raw.githubusercontent.com/image-js/fast-png/v8.0.0/src/png_decoder.ts),
[decoder options](https://raw.githubusercontent.com/image-js/fast-png/v8.0.0/src/types.ts),
[UPNG](https://github.com/photopea/UPNG.js).

The initial advertised subset is static, noninterlaced PNG: color types 0/2/4/6
at depth 8, and indexed color type 3 at depths 1/2/4/8. Include palette alpha and
grayscale/truecolor `tRNS`; do not silently discard transparency. Reject 16-bit,
Adam7, APNG, unknown critical chunks and unsupported color profiles explicitly.
PNG alpha is straight, with RGB independent of alpha.
[PNG specification](https://www.w3.org/TR/png-3/).

Before invoking fast-png:

1. Bound original bytes, then walk the complete chunk stream with checked offsets,
   maximum 256 chunks, strict lengths/order/duplicates and every chunk CRC. Require
   one first IHDR, valid PLTE/tRNS relationships, contiguous IDAT, final empty IEND,
   no trailing bytes and supported compression/filter methods. Reject acTL/fcTL/
   fdAT. Permit only IHDR, PLTE, tRNS, IDAT, IEND, sRGB, gAMA, cHRM, pHYs, tEXt and
   tIME, with their structural limits. Thus compressed metadata iCCP/zTXt/iTXt
   never reaches any decoder. Limit all ancillary data together to 64 KiB.
2. Treat untagged content as sRGB. Accept sRGB; accept gAMA=45455 and the standard
   sRGB cHRM values only. Reject conflicting/non-sRGB declarations rather than
   pretending to color-manage them. Explain the supported export settings in UI.
3. Compute channels, `rowBytes=ceil(width*channels*depth/8)` and
   `expectedInflated=height*(rowBytes+1)` before inflate. Maximum is 1,049,088
   bytes for RGBA8 at 512 square. Aggregate RGBA accounting happens before pixel
   allocation. Concatenate only the bounded IDAT payload into private storage.
4. Use pako's **low-level** zlib inflater with windowBits=15, fixed 16 KiB output
   scratch and at most 4 KiB input per call. Count produced bytes before retaining
   anything; reject at expectedInflated+1. Require Z_STREAM_END, valid Adler-32,
   exact expected output, all compressed bytes consumed, no dictionary, no second
   stream, no unused tail, no error, and progress on each iteration. Check row
   filter bytes 0..4 while streaming. Do not use high-level automatic concatenation
   or accumulate unbounded chunks. Always release inflater state. This bounds
   storage during validation, before the permissive decoder sees any input.
5. Decode the same immutable original bytes using fast-png with `checkCrc:true`.
   Because only the certified single IDAT stream and noncompressed metadata remain,
   the allowed decode has a bounded expansion. Independently check returned
   dimensions/depth/channels/length, palette indices and transparency, then convert
   to exactly width*height*4 RGBA8. Do not infer all output is already RGBA.

Pako exposes the low-level modules in its package; its bounded output buffer and
return codes are suitable for this adapter. It supplies no Lux deadline guarantee.
The dual-decoder strategy requires differential malformed-stream tests: if fflate
and pako disagree on an accepted stream, fail the gate and use a reviewed bounded
inflater adapter in fast-png rather than weakening preflight. Do not claim this
cross-decoder safety property has already been demonstrated.
[Pako low-level implementation](https://raw.githubusercontent.com/nodeca/pako/2.1.0/lib/zlib/inflate.js).

## JPEG: explicit limits and common photographic input

Use jpeg-js decode with `{useTArray:true, formatAsRGBA:true,
tolerantDecoding:false, maxResolutionInMP:0.262144, maxMemoryUsageInMB:32}`.
The library documents the memory limit as approximate and decoding as synchronous;
neither setting is a CPU deadline. Require returned dimensions and RGBA length to
match preflight and alpha to be 255.
[Options and limitations](https://github.com/jpeg-js/jpeg-js#decode-options).

Before decode, perform a bounded JPEG marker/entropy walk: SOI through one final
EOI, no trailing stream, valid segment lengths, at most 1024 markers, one 8-bit
SOF0 baseline or SOF2 progressive frame, one or three components, width/height
1..512, sampling factors 1..2 with at most ten blocks per MCU, and at most 16 SOS
scans. Validate Huffman/quantization table bounds and selectors, scan ranges and
restart markers. Reject arithmetic, lossless, hierarchical, CMYK/YCCK and malformed
sampling modes before coefficient allocation. The scan cap admits common
progressive JPEGs but is an explicit supported-subset limit.

Bound APP/COM metadata together to 64 KiB. Support ordinary JFIF/YCbCr, grayscale
and recognized three-component Adobe transform declarations; reject unsupported
ICC/non-sRGB profiles and ambiguous transforms. Parse only EXIF orientation from
a checked TIFF header/IFD0 (maximum 128 entries; no recursive pointer traversal),
then apply orientations 1..8 to decoded pixels. Absent orientation means 1; invalid
or contradictory orientation fails. Derived width/height describe the oriented
image; swaps retain the same RGBA budget. Original JPEG bytes, including metadata,
remain unchanged in source and identity hashes.

## Synchronous admission, package identity and SDK access

Implement pure adapters under `packages/assets`; source admission, compile/link,
transport validation and worker preparation must select the same codec policy.
Never use filesystem paths, platform image decoders, Blob image URLs or network
loading to reinterpret asset bytes. Decode every declared image, including unused
ones. Keep a small bounded cache keyed by immutable descriptor identity at repeated
local admission sites; never let cache entries replace trust-boundary verification.

Input/output/scan budgets bound work, but no same-thread synchronous JavaScript
decoder can be externally preempted by a timer. Measure worst-case valid and
adversarial inputs before putting full JPEG decode in renderer admission. Target
at most 100 ms per asset and 250 ms per complete source on the QA machine; these
are proposed responsiveness gates, not library guarantees or measured results.
If they fail, move full admission to a terminable worker and return an asynchronously
admitted immutable snapshot. That requires deliberate workspace/MCP API work;
do not hide a multi-second decode inside current synchronous text-edit validation.
Never weaken validation to header-only or normalize away original source bytes.

The current SDK exposes only original bytes; its restricted imports do not expose
an image decoder. Add an additive `context.images` read-only map of decoded images
`{width,height,colorSpace:'srgb',alphaMode:'straight',data:Uint8Array}`. Prepare it
before submitted module import, using verified originals. Each get/iteration
returns a fresh record and pixel copy, using captured intrinsics like the existing
protected asset map. Keep `context.assets` byte-for-byte unchanged. This explicitly
supersedes the previous checkpoint's no-image-helper restriction; it avoids copying
JPEG/PNG decoders into every submitted visual. Keep SDK 0.1.0 for this additive
capability, but require a new PNG/JPEG runtime capability marker and new immutable
runtime inventory. Older BMP-only validators must reject new media, never omit it.

Pin/bundle the full codec closure and adapter bytes in both compiler and linker
dependency inventories and installed validator/worker outputs. No production
runtime import may reach checkout node_modules. Change emitted-worker and validator
capability markers; test stale packaging rejection. Do not add derived pixel data
to scene/artifact/transport JSON or change the existing asset-set field order.

## Alpha representation through rendering and capture

Inspected gaps: BMP fixture forces alpha=255 and uses an opaque material. Worker
capture copies raw target readback to ImageData while reporting straight alpha.
The canvas uses WebGPU premultiplied mode; the presentation material samples the
sRGB target with default flags. SDK OutputTarget promises linear-sRGB premultiplied
output. These facts do not establish the representation of intermediate bytes.

Define and test these contracts explicitly:

- Decoded images: top-down RGBA8, **straight sRGB RGB**, linear coverage alpha.
  DataTexture uses SRGBColorSpace, RGBAFormat/UnsignedByteType; do not byte-premultiply
  sRGB input. Set orientation explicitly and test it. Alpha material uses normal
  blending, transparent=true and the matching straight-input material setting;
  do not multiply again in both shader and blend state. Disable tone mapping for
  the conformance fixture. Clear output to transparent black.
- Render accumulation: linear-light premultiplied RGB and alpha, Porter-Duff over.
  Establish whether the existing sRGB target really uses an sRGB GPU attachment:
  hardware sRGB storage may encode premultiplied-linear RGB, and is not equivalent
  to premultiplying encoded sRGB. Retain that target only if pinned Three/WebGPU
  shader/attachment inspection and readback vectors prove the contract. Otherwise
  use an explicitly linear target and a trusted output conversion; do not choose
  a conversion merely from `texture.colorSpace` or the current metadata label.
- Presentation/capture conversion: from linear premultiplied `(P,a)`, calculate
  `C=P/a` for a>0, else C=0; encode straight RGB with sRGB transfer E(C). PNG stores
  `(E(C),a)`; the premultiplied sRGB canvas receives `(a*E(C),a)`. If readback is
  sRGB-encoded P, first apply E inverse, then divide in linear space. Dividing
  encoded bytes directly is incorrect for that representation. Avoid another
  automatic material premultiply after the trusted conversion.
- Capture the same completed frame, with no user rerender, preserving current queue,
  identity and 8 MiB PNG ceiling. Convert to straight sRGB before ImageData. At a=0
  canonicalize RGB to zero; bound/clamp and define rounding. OffscreenCanvas can
  quantize through an internal premultiplied store, so test low-alpha error; if it
  fails, use a pinned pure PNG encoder on straight RGBA rather than relabel pixels.
  Metadata must describe actual encoded pixels and record capture pipeline version,
  source/linked/asset-set identity, frame/time/control identity and conversion mode.

For filtering, transparent pixels may contain arbitrary RGB. Test nearest sampling
first, then linear-filtered/subpixel edges. Correct interpolation is in linear
premultiplied space; straight-alpha texture filtering can leak hidden RGB. If
filtered tests fail, generate a trusted premultiplied-linear sampling texture (and
use matching material handling); do not add a black/white matte or alpha-test away
antialiased pixels. Preserve the original decoder output and source bytes.

## Delivery and gates

1. Add codec adapters and browser bundles, exact pins/licenses/closure tests. CPU
   tests: PNG RGBA, palette+tRNS (odd row widths), grayscale/RGB+tRNS; JPEG baseline,
   progressive, grayscale and EXIF orientations. Use independently generated
   fixtures. Check base64/CRC/Adler, truncated/extra streams, a tiny IHDR with huge
   expansion, oversized metadata, repeated scans/tables, forged dimensions,
   malformed palettes and every cap before expensive allocations. Record memory
   and elapsed time, including repeated four-asset admission and malformed inputs.
2. Prove original bytes survive edit/save/MCP/build/link/restart/export/offline,
   byte-only edits change identities and helper-only edits reject pinned artifacts.
   Missing/corrupt images fail readiness without replacing the last good candidate.
3. Add a PNG conformance scene with colored transparent pixels, alpha 0/1/16/64/128/
   192/254/255, opaque references and antialiased colored edges. Add JPEG scene.
   Use context.images; disposing the visual releases texture/material/geometry.
4. Under separate graphics authorization, measure raw target pixels, captured PNG,
   preview and installed output. Render known black, white and midgray backgrounds
   inside the linear-light test scene, with reference
   `E(a*Clinear+(1-a)*Blinear)`: 50% white over black is near sRGB 188. Separately
   test the transparent PNG/canvas over external backgrounds using that compositor's
   actual mode. An encoded-sRGB compositor instead gives about 128 for that case;
   do not call this an alpha bug or require one oracle for both compositors.
   Straight captured white at half alpha must remain white RGB with half alpha.
   Compare interiors within two
   8-bit levels and edge/low-alpha composites within four initially; report actual
   errors instead of relaxing tolerances to conceal halos. Compare host blends in
   their configured color-management mode; identify a host mode mismatch explicitly.
5. Verify orientation, restart, two instances and offline releases. An alpha channel
   existing in a PNG, or an opaque screenshot looking right, is not sufficient.

BMP32 with explicit V4 masks could isolate alpha math without compression, but it
does not meet the requested PNG/JPEG workflow and is not the recommended delivery.
The concrete unresolved gates are decoder-wrapper differential/CPU measurements
and measured render-target alpha representation. No additional product decision
is needed to begin the bounded codec CPU implementation.
