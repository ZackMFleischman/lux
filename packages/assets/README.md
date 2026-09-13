# Bounded image assets

This module admits BMP plus the bounded PNG/JPEG subsets documented in `PNG.md`
and `JPEG.md`. Source envelopes preserve original bytes. Studio workers expose
both original assets and predecoded images; actual GPU/installed-host acceptance
is recorded separately from these CPU guarantees.

Import `packages/assets/src/index.mjs`; TypeScript resolves `index.d.mts`.
The module uses pinned pure JavaScript codecs and can be bundled for a browser.

## Admission and decoding

- `validateAssetPath(path)` returns the admitted logical ID or throws.
- `decodeCanonicalBase64(data)` bounds encoded and decoded size before allocation,
  accepts only standard canonical base64, and returns caller-owned bytes.
- `validateBmp(bytes)` validates the complete bounded file without allocating RGBA;
  returns `{width,height,stride,byteLength,rgbaByteLength}`.
- `decodeBmp(bytes)` revalidates and returns `{width,height,data}` with top-down RGBA
  pixels. RGB has sRGB interpretation and alpha is always 255.
- `validateSourceAssets(unknown)` synchronously validates every declared image,
  applies path/count/file-byte/RGBA-budget checks, and returns a canonical frozen
  descriptor record. Each descriptor is also frozen. Input records and descriptors
  must contain enumerable own data properties and have ordinary or null prototypes.
  Accessors, symbols, hidden fields, inherited fields and extra fields are rejected.
  Both record levels are snapshotted from their checked own descriptor values;
  later property reads or Proxy `get` substitutions cannot change admitted bytes
  or metadata.

Source descriptors are exactly `{mediaType,encoding:"base64",data}`, where
mediaType is `image/bmp`, `image/png`, or `image/jpeg`. Logical paths use matching
lowercase `.bmp`, `.png`, `.jpg` or `.jpeg` extensions.
An empty record is valid. Paths are logical IDs; these APIs confer no filesystem
or URL authority. Errors have `code` equal to `ASSET_BOUNDARY_VIOLATION` or
`QUOTA_EXCEEDED`; asset-specific errors also carry `path`. Outer source, scene,
request, artifact and transport JSON byte limits remain the integrating caller's
responsibility. Original and decoded aggregate budgets apply across all formats.

## Derived metadata and identity

`deriveAssets(sourceAssets, hashBytes)` returns a promise for `{assets,assetSetHash}`.
Derived descriptors have exactly these ordered fields:
`{mediaType,encoding,data,byteLength,sha256,width,height}`. Metadata is computed from
the original image bytes. `hashBytes` is a **trusted** caller-supplied SHA-256
implementation taking `Uint8Array` and returning lowercase hex, synchronously or
as a promise. For Node, use `bytes => createHash('sha256').update(bytes).digest('hex')`;
workers may wrap WebCrypto. Never supply a callback from submitted visual code.

`verifyDerivedAssets(assets, expectedAssetSetHash, hashBytes)` revalidates all
descriptors, recomputes every image hash and the set hash, rejects any mismatch,
and returns `{assets,assetSetHash,sourceAssets}`. The frozen source projection is
ready for `createReadonlyAssetMap`. All data is snapshotted before asynchronous
hashing, so subsequent mutation of the input record does not alter the result.

`canonicalAssetSet(derivedAssets)` validates record shape, bytes and dimensions,
then serializes the sorted identity array. It does **not** cryptographically verify
hash claims: use `verifyDerivedAssets` at a trust boundary. Keys use ASCII code-unit
ordering; object property order is explicit. Set identity excludes base64 because
each entry already includes its original-byte SHA-256.

Fixed vector: one 1x1 red BMP, canonical base64:

```text
Qk06AAAAAAAAADYAAAAoAAAAAQAAAAEAAAABABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/AA==
```

Its exact canonical asset-set JSON (UTF-8, no newline) is:

```json
[{"path":"assets/red.bmp","mediaType":"image/bmp","byteLength":58,"sha256":"364d075814e300bdfe607a2f4e52dc4117373cc5d02793f18e4a0cb16b9b10a7","width":1,"height":1}]
```

The SHA-256 of that JSON is
`ba26d9a92423b9e3ba6cbc73c0548a730196f68d40f4096556bff8e1e8ccda90`.

## Worker ownership boundary

Before importing any submitted module, verify the complete versioned envelope and
its identities, call `verifyDerivedAssets`, then construct
`createReadonlyAssetMap(verified.sourceAssets)`. Legacy candidates can construct
`createReadonlyAssetMap({})`. This module does not verify artifact/linked identities.

Construct `createReadonlyImageMap(verified.sourceAssets)` in that same pristine
phase for `context.images`. Values contain `{width,height,colorSpace:'srgb',
alphaMode:'straight',data}` with top-down RGBA8 and fresh caller-owned pixel copies.
JPEG orientation changes derived dimensions/pixels without changing originals;
PNG retains hidden RGB under zero alpha. A private weak cache reuses decoded data
only for immutable asset records minted by this module; received hashes/JSON cannot
mint cache authority. Studio PNG/JPEG previews and imports decode in dedicated,
deadline-bounded workers rather than during ordinary editor renders.

The frozen null-prototype facade implements `size`, `has`, `get`, `keys`, `values`,
`entries`, `[Symbol.iterator]`, and `forEach`. It has no mutators or native Map
brand. `get` and every value-producing iteration return fresh caller-owned byte
arrays. `forEach` receives the facade as its third argument. SDK types mark bytes
readonly, but runtime mutation of a returned array cannot alter private storage.

Private storage consists of dense entries, never a publicly reachable Map or
buffer. Construction captures the native byte constructor and the object/callback
operations subsequently needed by the facade. Copying uses direct indexing with
stored lengths and a captured constructor given only an allocation length; it never
uses species, slice, subarray, set, buffer getters, or a callback/constructor given
private bytes. Custom iterators use captured operations too. This confines asset
storage under later intrinsic replacement; it is not a general JavaScript sandbox.
Admission and hashing run in the trusted phase, not after submitted code executes.

## Integration boundaries

Legacy source/hash normalization remains unchanged. The compiler and linker
inventory the asset helpers and actual installed codec package implementations.
Ensure shipped worker and
transport-reader bundles contain it without runtime checkout imports. Charge
base64 to every exact serialized outer budget, and verify metadata/set hashes at
each decoded trust boundary. Installed-host integration and GPU alpha evidence
remain required release checks.

Run CPU coverage with `node --test --test-isolation=none tests/assets/assets.test.mjs`;
run declaration/SDK compatibility with `node node_modules/typescript/bin/tsc --noEmit`.
