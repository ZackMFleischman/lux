#pragma once
#include <windows.h>
#include <array>
#include <cmath>
#include <cstddef>
#include <cstdint>
#include <limits>
#include <span>
#include <type_traits>

namespace lux {
// Active ring v4 readers validate the OUTER mapping version/size before
// locating this block; never reinterpret a v3 ring as HostControlsV4. Pair the
// sequence with its mapping generation: a replacement starts again at one.
// Windows x64, little-endian IEEE-754 float, MSVC interlocked full barriers.
constexpr uint32_t HostControlsVersionV4 = 4;
constexpr uint32_t HostControlsBytesV4 = 256;
constexpr uint32_t HostControlsLimitV4 = 32;
using ControlSchemaHashV4 = std::array<char, 64>; // lowercase SHA-256 hex, no NUL

struct HostControlSnapshotV4 {
  uint32_t initialized = 0, count = 0;
  uint64_t sequence = 0;
  ControlSchemaHashV4 schemaHash{};
  std::array<float, HostControlsLimitV4> values{};
};

// Construct once in a new mapping before publishing its rendezvous. Never reset,
// memcpy or reconstruct a live block. All ordinary fields, including version,
// are protected by lock; readers also acquire it. Only lock uses atomic access.
struct alignas(64) HostControlsV4 {
  uint32_t version = HostControlsVersionV4, byteSize = HostControlsBytesV4;
  volatile LONG lock = 0; // 0 free, 1 held. No stealing, timeout or recovery.
  uint32_t reserved = 0;
  HostControlSnapshotV4 snapshot{};
  std::array<uint8_t, 32> reservedTail{};
};
static_assert(sizeof(void*) == 8 && sizeof(LONG) == 4 && sizeof(float) == 4);
static_assert(std::numeric_limits<float>::is_iec559);
static_assert(std::is_standard_layout_v<HostControlsV4> && std::is_trivially_copyable_v<HostControlsV4>);
static_assert(sizeof(HostControlsV4) == HostControlsBytesV4 && alignof(HostControlsV4) == 64);
static_assert(offsetof(HostControlsV4, lock) == 8 && offsetof(HostControlsV4, snapshot) == 16);
static_assert(sizeof(HostControlSnapshotV4) == 208 && offsetof(HostControlSnapshotV4, sequence) == 8);
static_assert(offsetof(HostControlSnapshotV4, schemaHash) == 16 && offsetof(HostControlSnapshotV4, values) == 80);

enum class HostControlStatusV4 {
  Ok, Busy, Uninitialized, UnsupportedVersion, InvalidLayout, InvalidSchema,
  SchemaMismatch, InvalidCount, CountMismatch, InvalidValue, InvalidIndex,
  InvalidSequence, SequenceExhausted,
};

namespace host_controls_v4_detail {
using Status = HostControlStatusV4;
inline bool validSchema(const ControlSchemaHashV4& schema) noexcept {
  for (const char c : schema) if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) return false;
  return true;
}
inline bool validValue(float value) noexcept {
  return std::isfinite(value) && value >= 0 && value <= 1;
}
// One attempt, with an acquire/release full memory barrier on Windows. An
// abandoned reader OR writer leaves lock held forever. Treat Busy as retry/drop,
// never as defaults or empty controls. Supervisor replaces the mapping/generation;
// absence of progress is not permission to unlock another process's block.
class TryLock {
  HostControlsV4& wire;
  LONG observed;
public:
  explicit TryLock(HostControlsV4& value) noexcept : wire(value), observed(InterlockedCompareExchange(&value.lock, 1, 0)) {}
  ~TryLock() { if (observed == 0) InterlockedExchange(&wire.lock, 0); }
  TryLock(const TryLock&) = delete;
  TryLock& operator=(const TryLock&) = delete;
  Status status() const noexcept { return observed == 0 ? Status::Ok : observed == 1 ? Status::Busy : Status::InvalidLayout; }
};

// Call only while holding TryLock. Even invalid payload is never inspected when
// acquisition fails. Hash syntax/identity are checked here, not authenticity:
// the parent must supply the verified release's schema hash and control count.
inline Status validate(const HostControlsV4& wire) noexcept {
  if (wire.version != HostControlsVersionV4) return Status::UnsupportedVersion;
  if (wire.byteSize != HostControlsBytesV4 || wire.reserved != 0) return Status::InvalidLayout;
  for (const auto byte : wire.reservedTail) if (byte != 0) return Status::InvalidLayout;
  const auto& snapshot = wire.snapshot;
  if (snapshot.initialized > 1) return Status::InvalidLayout;
  if (snapshot.count > HostControlsLimitV4) return Status::InvalidCount;
  if (snapshot.initialized == 0) {
    if (snapshot.count != 0 || snapshot.sequence != 0) return Status::InvalidLayout;
    for (char c : snapshot.schemaHash) if (c != 0) return Status::InvalidLayout;
    for (float value : snapshot.values) if (value != 0 || std::signbit(value)) return Status::InvalidLayout;
    return Status::Uninitialized;
  }
  if (!validSchema(snapshot.schemaHash)) return Status::InvalidSchema;
  if (snapshot.sequence == 0) return Status::InvalidSequence;
  for (size_t i = 0; i < snapshot.values.size(); ++i) {
    const float value = snapshot.values[i];
    if (!validValue(value) || (value == 0 && std::signbit(value)) || (i >= snapshot.count && value != 0)) return Status::InvalidValue;
  }
  return Status::Ok;
}
} // namespace host_controls_v4_detail

// All arguments and output objects must be private, stable process-local memory,
// not aliases of this shared block. Caller owns mapping lifetime for the entire
// call. Every failure leaves outputs and the published tuple unchanged.
inline HostControlStatusV4 tryReadHostControlsV4(HostControlsV4& wire,
    const ControlSchemaHashV4& expectedSchema, uint32_t expectedCount, HostControlSnapshotV4& output) noexcept {
  using namespace host_controls_v4_detail;
  if (!validSchema(expectedSchema)) return Status::InvalidSchema;
  if (expectedCount > HostControlsLimitV4) return Status::InvalidCount;
  TryLock guard(wire);
  if (guard.status() != Status::Ok) return guard.status();
  const auto state = validate(wire);
  if (state != Status::Ok) return state;
  if (wire.snapshot.schemaHash != expectedSchema) return Status::SchemaMismatch;
  if (wire.snapshot.count != expectedCount) return Status::CountMismatch;
  output = wire.snapshot;
  return Status::Ok;
}

// Full publication establishes schema/count on a fresh block. Both are immutable
// thereafter, including count zero. Sequences start at one, increment on every
// accepted write (including unchanged values), and never wrap. On exhaustion the
// supervisor must replace the mapping; the last snapshot remains readable.
inline HostControlStatusV4 tryPublishHostControlsV4(HostControlsV4& wire,
    const ControlSchemaHashV4& schema, std::span<const float> values, uint64_t& sequence) noexcept {
  using namespace host_controls_v4_detail;
  if (!validSchema(schema)) return Status::InvalidSchema;
  if (values.size() > HostControlsLimitV4) return Status::InvalidCount;
  HostControlSnapshotV4 next;
  next.initialized = 1; next.count = static_cast<uint32_t>(values.size()); next.schemaHash = schema;
  for (size_t i = 0; i < values.size(); ++i) {
    if (!validValue(values[i])) return Status::InvalidValue;
    next.values[i] = values[i] == 0 ? 0.0f : values[i];
  }
  TryLock guard(wire);
  if (guard.status() != Status::Ok) return guard.status();
  const auto state = validate(wire);
  if (state != Status::Ok && state != Status::Uninitialized) return state;
  if (state == Status::Ok) {
    if (wire.snapshot.schemaHash != schema) return Status::SchemaMismatch;
    if (wire.snapshot.count != values.size()) return Status::CountMismatch;
    if (wire.snapshot.sequence == UINT64_MAX) return Status::SequenceExhausted;
  }
  next.sequence = wire.snapshot.sequence + 1;
  wire.snapshot = next;
  sequence = next.sequence;
  return Status::Ok;
}

// Per-index FFGL callback foundation: read/modify/write under the same lock so a
// callback for one parameter cannot overwrite concurrent edits to another.
// Requires prior full publication of verified host defaults/restored values and
// the immutable release's expected count, not a count read from shared memory.
inline HostControlStatusV4 tryUpdateHostControlV4(HostControlsV4& wire,
    const ControlSchemaHashV4& schema, uint32_t expectedCount, uint32_t index, float value, uint64_t& sequence) noexcept {
  using namespace host_controls_v4_detail;
  if (!validSchema(schema)) return Status::InvalidSchema;
  if (expectedCount > HostControlsLimitV4) return Status::InvalidCount;
  if (!validValue(value)) return Status::InvalidValue;
  TryLock guard(wire);
  if (guard.status() != Status::Ok) return guard.status();
  const auto state = validate(wire);
  if (state != Status::Ok) return state;
  if (wire.snapshot.schemaHash != schema) return Status::SchemaMismatch;
  if (wire.snapshot.count != expectedCount) return Status::CountMismatch;
  if (index >= wire.snapshot.count) return Status::InvalidIndex;
  if (wire.snapshot.sequence == UINT64_MAX) return Status::SequenceExhausted;
  wire.snapshot.values[index] = value == 0 ? 0.0f : value;
  sequence = ++wire.snapshot.sequence;
  return Status::Ok;
}
} // namespace lux
