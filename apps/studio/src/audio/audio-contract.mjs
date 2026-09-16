const freeze = Object.freeze;
const ownKeys = Reflect.ownKeys;
const descriptor = Object.getOwnPropertyDescriptor;
const prototype = Object.getPrototypeOf;
const objectPrototype = Object.prototype;
const finite = Number.isFinite;
const bands = new Set(['level', 'bass', 'mids', 'highs']);

function invalid(message) {
  throw new Error(message);
}

function plain(input, fields, message) {
  if (!input || typeof input !== 'object' || Array.isArray(input) ||
      (prototype(input) !== objectPrototype && prototype(input) !== null) ||
      ownKeys(input).length !== fields.length) invalid(message);
  const result = Object.create(null);
  for (const field of fields) {
    const value = descriptor(input, field);
    if (!value?.enumerable || !Object.hasOwn(value, 'value')) invalid(message);
    result[field] = value.value;
  }
  return result;
}

export function normalizeAudioAnalyzerConfig(input) {
  const raw = plain(input, ['version', 'fftSize', 'minDecibels', 'maxDecibels'], 'Invalid audio analyzer configuration');
  const { version, fftSize, minDecibels, maxDecibels } = raw;
  if (version !== 1 || fftSize !== 2048 || !finite(minDecibels) || !finite(maxDecibels) ||
      minDecibels < -120 || minDecibels > -40 || maxDecibels < -80 || maxDecibels > 0 ||
      maxDecibels - minDecibels < 10) invalid('Invalid audio analyzer configuration');
  return freeze({ version: 1, fftSize: 2048, minDecibels: minDecibels === 0 ? 0 : minDecibels,
    maxDecibels: maxDecibels === 0 ? 0 : maxDecibels });
}

export function normalizeAudioInputConfiguration(input) {
  const raw = plain(input, ['logicalInputId', 'analyzer'], 'Invalid audio input configuration');
  if (raw.logicalInputId !== 'primary-audio') invalid('Invalid logical audio input');
  return freeze({ logicalInputId: 'primary-audio', analyzer: normalizeAudioAnalyzerConfig(raw.analyzer) });
}

export function normalizeAudioBandSource(input) {
  const raw = plain(input, ['kind', 'logicalInputId', 'band', 'analyzer'], 'Invalid audio band source');
  if (raw.kind !== 'audio-band') invalid('Invalid audio band source');
  if (raw.logicalInputId !== 'primary-audio') invalid('Invalid logical audio input');
  if (!bands.has(raw.band)) invalid('Invalid audio band');
  const configuration = normalizeAudioInputConfiguration({ logicalInputId: raw.logicalInputId, analyzer: raw.analyzer });
  return freeze({ kind: 'audio-band', logicalInputId: configuration.logicalInputId, band: raw.band, analyzer: configuration.analyzer });
}

export function normalizeLocalAudioDeviceId(input) {
  if (input === undefined) return undefined;
  if (typeof input !== 'string' || input.length < 1 || input.length > 512) invalid('Invalid local audio device');
  return input;
}

