# Bounded image asset foundation

This module implements the approved BMP and asset-record policy in
`docs/implementation/required-assets.md`. It does not enable source v2, populate
production runtime contexts, or demonstrate scene/export playback. No dependency,
SDK, source-contract, compiler, runtime, UI or package-manifest changes are included.

Import `packages/assets/src/index.mjs`; TypeScript resolves `index.d.mts`.
The module has no imports or platform image codecs and can be bundled for a browser.

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

Source descriptors are exactly `{mediaType:"image/bmp",encoding:"base64",data}`.
An empty record is valid. Paths are logical IDs; these APIs confer no filesystem
or URL authority. Errors have `code` equal to `ASSET_BOUNDARY_VIOLATION` or
`QUOTA_EXCEEDED`; asset-specific errors also carry `path`. Outer source, scene,
request, artifact and transport JSON byte limits remain the integrating caller's
responsibility. The aggregate RGBA guard is retained even though the stricter
current BMP file-byte budget already bounds its maximum reachable allocation.

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

## Next integration stage

Keep legacy source/hash normalization unchanged. Add discriminated v2 contracts
only when workspace, compiler/linker, worker, and export paths can retain assets.
Include this helper in both dependency pinning allowlists and emitted runtime
inventory; importing it alone does not pin its bytes. Ensure shipped worker and
transport-reader bundles contain it without runtime checkout imports. Charge
base64 to every exact serialized outer budget, and verify metadata/set hashes at
each decoded trust boundary. None of that pipeline wiring is part of this module.

Run CPU coverage with `node --test --test-isolation=none tests/assets/assets.test.mjs`;
run declaration/SDK compatibility with `node node_modules/typescript/bin/tsc --noEmit`.
