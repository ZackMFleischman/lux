export type ResourceCounts = Readonly<{
  allocations: number; backend: number; inputs: number; frames: number; captures: number;
}>;
export const resourceCapacities: ResourceCounts = Object.freeze({
  allocations: 8192, backend: 8192, inputs: 4096, frames: 16, captures: 16,
});
declare const reservationBrand: unique symbol;
export type ResourceReservation = Readonly<{ readonly [reservationBrand]: true }>;
export type ResourceLedger = Readonly<{
  reserve(charges: ResourceCounts): ResourceReservation;
  release(reservation: ResourceReservation): void;
  snapshot(): ResourceCounts;
}>;

type MutableCounts = { -readonly [Field in keyof ResourceCounts]: number };
type ReservationRecord = { owner: object; charges: ResourceCounts; released: boolean };
const reservations = new WeakMap<object, ReservationRecord>();
const fields = ['allocations', 'backend', 'inputs', 'frames', 'captures'] as const;

function captureCharges(charges: ResourceCounts): ResourceCounts {
  const invalid = (): never => { throw new TypeError('Invalid resource charges'); };
  if (charges === null || typeof charges !== 'object' || Array.isArray(charges)) return invalid();
  const prototype = Object.getPrototypeOf(charges);
  if (prototype !== Object.prototype && prototype !== null) return invalid();
  const keys = Reflect.ownKeys(charges);
  if (keys.length !== fields.length || keys.some(key => typeof key !== 'string' || !fields.includes(key as keyof ResourceCounts))) return invalid();

  const captured: MutableCounts = { allocations: 0, backend: 0, inputs: 0, frames: 0, captures: 0 };
  let positive = false;
  for (const field of fields) {
    const descriptor = Object.getOwnPropertyDescriptor(charges, field);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) return invalid();
    const value: unknown = descriptor.value;
    if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) return invalid();
    captured[field] = value === 0 ? 0 : value;
    if (value > 0) positive = true;
  }
  if (!positive) return invalid();
  return Object.freeze(captured);
}

export function createResourceLedger(): ResourceLedger {
  const owner = Object.freeze(Object.create(null));
  const counts: MutableCounts = { allocations: 0, backend: 0, inputs: 0, frames: 0, captures: 0 };
  let admitting = false;
  const enter = (): void => {
    if (admitting) throw new TypeError('Resource ledger reentry');
    admitting = true;
  };

  const reserve = Object.freeze((charges: ResourceCounts): ResourceReservation => {
    // Enter before caller-controlled reflection; snapshots remain callout-free.
    enter();
    try {
      const captured = captureCharges(charges);
      for (const field of fields) {
        if (captured[field] > resourceCapacities[field] - counts[field]) {
          throw new RangeError(`Resource capacity exceeded: ${field}`);
        }
      }
      // No caller code runs between the complete capacity check and commit.
      const token: ResourceReservation = Object.freeze(Object.create(null));
      reservations.set(token, { owner, charges: captured, released: false });
      for (const field of fields) counts[field] += captured[field];
      return token;
    } finally {
      admitting = false;
    }
  });

  const release = Object.freeze((reservation: ResourceReservation): void => {
    enter();
    try {
      // WeakMap lookup authenticates exact identity without inspecting the token.
      const record = reservations.get(reservation);
      if (!record || record.owner !== owner) throw new TypeError('Invalid resource reservation');
      if (record.released) return;
      record.released = true;
      for (const field of fields) counts[field] -= record.charges[field];
    } finally {
      admitting = false;
    }
  });

  return Object.freeze({
    reserve,
    release,
    snapshot: Object.freeze((): ResourceCounts => Object.freeze({ ...counts })),
  });
}
