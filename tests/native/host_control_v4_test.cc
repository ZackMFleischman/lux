#include "host_control_snapshot_v4.h"
#include <atomic>
#include <chrono>
#include <iostream>
#include <limits>
#include <new>
#include <stdexcept>
#include <string>
#include <string_view>
#include <thread>

#define CHECK(x) do { if (!(x)) throw std::runtime_error("line " + std::to_string(__LINE__) + ": " #x); } while (0)
using namespace lux;
using Status = HostControlStatusV4;

ControlSchemaHashV4 schema(char digit = 'a') {
  ControlSchemaHashV4 result; result.fill(digit); return result;
}

void emptyAndRoundtrip() {
  HostControlsV4 wire;
  HostControlSnapshotV4 result; result.sequence = 91;
  CHECK(tryReadHostControlsV4(wire, schema(), 0, result) == Status::Uninitialized);
  CHECK(result.sequence == 91);
  uint64_t sequence = 91;
  CHECK(tryUpdateHostControlV4(wire, schema(), 0, 0, .5f, sequence) == Status::Uninitialized);
  CHECK(sequence == 91);
  CHECK(tryPublishHostControlsV4(wire, schema(), {}, sequence) == Status::Ok);
  CHECK(sequence == 1);
  CHECK(tryReadHostControlsV4(wire, schema(), 0, result) == Status::Ok);
  CHECK(result.initialized == 1 && result.count == 0 && result.sequence == 1 && result.schemaHash == schema());
  CHECK(tryUpdateHostControlV4(wire, schema(), 0, 0, .5f, sequence) == Status::InvalidIndex);
  CHECK(tryPublishHostControlsV4(wire, schema(), {}, sequence) == Status::Ok && sequence == 2);

  HostControlsV4 full;
  std::array<float, 32> values{}; values[0] = -0.0f; values[1] = 1; values[31] = .375f;
  CHECK(tryPublishHostControlsV4(full, schema(), values, sequence) == Status::Ok && sequence == 1);
  CHECK(tryReadHostControlsV4(full, schema(), 32, result) == Status::Ok);
  CHECK(result.count == 32 && result.values[1] == 1 && result.values[31] == .375f && !std::signbit(result.values[0]));
  CHECK(tryUpdateHostControlV4(full, schema(), 32, 7, .625f, sequence) == Status::Ok && sequence == 2);
  CHECK(tryReadHostControlsV4(full, schema(), 32, result) == Status::Ok);
  CHECK(result.values[7] == .625f && result.values[31] == .375f && result.values[1] == 1);
  CHECK(tryReadHostControlsV4(wire, schema(), 0, result) == Status::Ok && result.sequence == 2 && result.count == 0);
}

void invalidInputIsAtomic() {
  HostControlsV4 wire;
  uint64_t sequence = 0;
  const std::array<float, 2> good{.25f, .75f};
  CHECK(tryPublishHostControlsV4(wire, schema(), good, sequence) == Status::Ok);
  HostControlSnapshotV4 before; CHECK(tryReadHostControlsV4(wire, schema(), 2, before) == Status::Ok);
  auto invalidSchema = schema(); invalidSchema[63] = 'G';
  CHECK(tryPublishHostControlsV4(wire, invalidSchema, good, sequence) == Status::InvalidSchema);
  CHECK(tryPublishHostControlsV4(wire, schema('b'), good, sequence) == Status::SchemaMismatch);
  CHECK(tryPublishHostControlsV4(wire, schema(), {}, sequence) == Status::CountMismatch);
  const std::array<float, 33> tooMany{};
  CHECK(tryPublishHostControlsV4(wire, schema(), tooMany, sequence) == Status::InvalidCount);
  for (float bad : {-.01f, 1.01f, std::numeric_limits<float>::infinity(), std::numeric_limits<float>::quiet_NaN()}) {
    const std::array<float, 2> candidate{.5f, bad};
    CHECK(tryPublishHostControlsV4(wire, schema(), candidate, sequence) == Status::InvalidValue);
    CHECK(tryUpdateHostControlV4(wire, schema(), 2, 1, bad, sequence) == Status::InvalidValue);
  }
  CHECK(tryUpdateHostControlV4(wire, schema(), 2, 2, .5f, sequence) == Status::InvalidIndex);
  CHECK(tryUpdateHostControlV4(wire, schema('b'), 2, 0, .5f, sequence) == Status::SchemaMismatch);
  CHECK(sequence == 1);
  HostControlSnapshotV4 after; CHECK(tryReadHostControlsV4(wire, schema(), 2, after) == Status::Ok);
  CHECK(after.sequence == before.sequence && after.values == before.values && after.schemaHash == before.schemaHash);
  after.sequence = 91;
  CHECK(tryReadHostControlsV4(wire, schema('b'), 2, after) == Status::SchemaMismatch);
  CHECK(tryReadHostControlsV4(wire, schema(), 1, after) == Status::CountMismatch);
  CHECK(tryReadHostControlsV4(wire, schema(), 33, after) == Status::InvalidCount);
  CHECK(tryReadHostControlsV4(wire, invalidSchema, 2, after) == Status::InvalidSchema);
  CHECK(after.sequence == 91);
  wire.snapshot.count = 3; // A corrupt but bounded count must not authorize an undeclared index.
  CHECK(tryUpdateHostControlV4(wire, schema(), 2, 2, .5f, sequence) == Status::CountMismatch);
  CHECK(sequence == 1 && wire.snapshot.values[2] == 0);
  CHECK(tryUpdateHostControlV4(wire, schema(), 33, 0, .5f, sequence) == Status::InvalidCount);
}

void corruptAndExhaustedState() {
  auto checkCorrupt = [](auto corrupt, Status expected) {
    HostControlsV4 wire; uint64_t sequence = 0; const std::array<float, 1> values{.5f};
    CHECK(tryPublishHostControlsV4(wire, schema(), values, sequence) == Status::Ok);
    corrupt(wire); HostControlSnapshotV4 result; result.sequence = 91; sequence = 91;
    CHECK(tryReadHostControlsV4(wire, schema(), 1, result) == expected);
    CHECK(tryPublishHostControlsV4(wire, schema(), values, sequence) == expected);
    CHECK(tryUpdateHostControlV4(wire, schema(), 1, 0, .7f, sequence) == expected);
    CHECK(result.sequence == 91 && sequence == 91);
  };
  checkCorrupt([](auto& w) { w.version = 3; }, Status::UnsupportedVersion);
  checkCorrupt([](auto& w) { w.byteSize = 0; }, Status::InvalidLayout);
  checkCorrupt([](auto& w) { w.reserved = 1; }, Status::InvalidLayout);
  checkCorrupt([](auto& w) { w.reservedTail[0] = 1; }, Status::InvalidLayout);
  checkCorrupt([](auto& w) { w.snapshot.initialized = 2; }, Status::InvalidLayout);
  checkCorrupt([](auto& w) { w.snapshot.count = 33; }, Status::InvalidCount);
  checkCorrupt([](auto& w) { w.snapshot.schemaHash[0] = '\0'; }, Status::InvalidSchema);
  checkCorrupt([](auto& w) { w.snapshot.values[0] = std::numeric_limits<float>::quiet_NaN(); }, Status::InvalidValue);
  checkCorrupt([](auto& w) { w.snapshot.values[31] = .25f; }, Status::InvalidValue);
  checkCorrupt([](auto& w) { w.snapshot.sequence = 0; }, Status::InvalidSequence);
  HostControlsV4 wire; uint64_t sequence = 0;
  CHECK(tryPublishHostControlsV4(wire, schema(), {}, sequence) == Status::Ok);
  wire.snapshot.sequence = UINT64_MAX;
  CHECK(tryPublishHostControlsV4(wire, schema(), {}, sequence) == Status::SequenceExhausted);
  CHECK(sequence == 1 && wire.snapshot.sequence == UINT64_MAX);
}

void contentionDoesNotReadPayload() {
  HostControlsV4 wire; HostControlSnapshotV4 result; result.sequence = 91; uint64_t sequence = 91;
  CHECK(InterlockedCompareExchange(&wire.lock, 1, 0) == 0);
  // Invalid ordinary payload must not be read while a different owner holds it.
  wire.version = 3; wire.snapshot.count = 99;
  const auto start = std::chrono::steady_clock::now();
  for (int i = 0; i < 10000; ++i) {
    CHECK(tryReadHostControlsV4(wire, schema(), 0, result) == Status::Busy);
    CHECK(tryPublishHostControlsV4(wire, schema(), {}, sequence) == Status::Busy);
    CHECK(tryUpdateHostControlV4(wire, schema(), 0, 0, .5f, sequence) == Status::Busy);
  }
  CHECK(std::chrono::steady_clock::now() - start < std::chrono::seconds(5));
  CHECK(result.sequence == 91 && sequence == 91 && wire.lock == 1);
  InterlockedExchange(&wire.lock, 0);
  CHECK(tryReadHostControlsV4(wire, schema(), 0, result) == Status::UnsupportedVersion);
}

void concurrentSnapshotsAreCoherent() {
  HostControlsV4 wire; uint64_t sequence = 0;
  std::array<float, 32> values{};
  for (size_t i = 0; i < values.size(); ++i) values[i] = i % 2 ? 1.0f : 0.0f;
  CHECK(tryPublishHostControlsV4(wire, schema(), values, sequence) == Status::Ok);
  std::atomic<int> done{0}; std::atomic<bool> failed{false};
  const auto deadline = std::chrono::steady_clock::now() + std::chrono::seconds(10);
  auto writer = [&] {
    for (int n = 0; n < 10000 && !failed.load();) {
      std::array<float, 32> next{};
      for (size_t i = 0; i < next.size(); ++i) next[i] = static_cast<float>((i + n) % 2);
      uint64_t published = 0;
      const auto status = tryPublishHostControlsV4(wire, schema(), next, published);
      if (status == Status::Ok) ++n;
      else if (status != Status::Busy || std::chrono::steady_clock::now() > deadline) failed = true;
      else std::this_thread::yield();
    }
    ++done;
  };
  std::thread one(writer), two(writer); uint64_t previous = 0; unsigned reads = 0;
  while (done.load() != 2) {
    HostControlSnapshotV4 snapshot;
    const auto status = tryReadHostControlsV4(wire, schema(), 32, snapshot);
    if (status == Status::Ok) {
      ++reads;
      if (snapshot.sequence < previous) failed = true;
      previous = snapshot.sequence;
      for (size_t i = 0; i < snapshot.values.size(); ++i)
        if (snapshot.values[i] != (i % 2 ? 1.0f - snapshot.values[0] : snapshot.values[0])) failed = true;
    } else if (status != Status::Busy) failed = true;
  }
  one.join(); two.join();
  HostControlSnapshotV4 last;
  CHECK(!failed && tryReadHostControlsV4(wire, schema(), 32, last) == Status::Ok);
  CHECK(last.sequence == 20001 && reads > 0);
}

int childOperation(const wchar_t* mode, const wchar_t* name) {
  const HANDLE mapping = OpenFileMappingW(FILE_MAP_ALL_ACCESS, FALSE, name);
  if (!mapping) return 10;
  auto* wire = static_cast<HostControlsV4*>(MapViewOfFile(mapping, FILE_MAP_ALL_ACCESS, 0, 0, sizeof(HostControlsV4)));
  if (!wire) { CloseHandle(mapping); return 11; }
  int result = 0;
  if (std::wstring_view(mode) == L"--publish") {
    uint64_t sequence = 0; const std::array<float, 2> values{.25f, .75f};
    if (tryPublishHostControlsV4(*wire, schema(), values, sequence) != Status::Ok || sequence != 1) result = 12;
  } else if (std::wstring_view(mode) == L"--abandon") {
    HostControlSnapshotV4 observed;
    if (tryReadHostControlsV4(*wire, schema(), 2, observed) != Status::Ok || observed.sequence != 2 || observed.values[0] != .5f) result = 13;
    else if (InterlockedCompareExchange(&wire->lock, 1, 0) != 0) result = 14;
    else wire->snapshot.count = 99; // Simulate a writer dying halfway through a tuple.
  } else result = 15;
  UnmapViewOfFile(wire); CloseHandle(mapping);
  return result; // An abandoned lock remains held even after this process exits.
}

void crossProcessAndAbandonment() {
  const std::wstring name = L"Local\\LuxControlsV4Cpu-" + std::to_wstring(GetCurrentProcessId());
  const HANDLE mapping = CreateFileMappingW(INVALID_HANDLE_VALUE, nullptr, PAGE_READWRITE, 0, sizeof(HostControlsV4), name.c_str());
  CHECK(mapping && GetLastError() != ERROR_ALREADY_EXISTS);
  auto* wire = static_cast<HostControlsV4*>(MapViewOfFile(mapping, FILE_MAP_ALL_ACCESS, 0, 0, sizeof(HostControlsV4)));
  CHECK(wire); new (wire) HostControlsV4;
  try {
    wchar_t executable[MAX_PATH]; const auto length = GetModuleFileNameW(nullptr, executable, MAX_PATH);
    CHECK(length > 0 && length < MAX_PATH);
    auto child = [&](const wchar_t* mode) {
      std::wstring command = L"\"" + std::wstring(executable) + L"\" " + mode + L" \"" + name + L"\"";
      STARTUPINFOW startup{}; startup.cb = sizeof(startup); PROCESS_INFORMATION process{};
      CHECK(CreateProcessW(executable, command.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, nullptr, &startup, &process));
      const auto waited = WaitForSingleObject(process.hProcess, 5000);
      if (waited != WAIT_OBJECT_0) { TerminateProcess(process.hProcess, 16); WaitForSingleObject(process.hProcess, 1000); }
      DWORD code = 99; const BOOL gotCode = GetExitCodeProcess(process.hProcess, &code);
      CloseHandle(process.hThread); CloseHandle(process.hProcess);
      CHECK(waited == WAIT_OBJECT_0 && gotCode && code == 0);
    };
    child(L"--publish");
    HostControlSnapshotV4 observed;
    CHECK(tryReadHostControlsV4(*wire, schema(), 2, observed) == Status::Ok);
    CHECK(observed.sequence == 1 && observed.values[0] == .25f && observed.values[1] == .75f);
    uint64_t sequence = 0;
    CHECK(tryUpdateHostControlV4(*wire, schema(), 2, 0, .5f, sequence) == Status::Ok && sequence == 2);
    child(L"--abandon");
    observed.sequence = 91;
    CHECK(tryReadHostControlsV4(*wire, schema(), 2, observed) == Status::Busy && observed.sequence == 91);
    CHECK(tryPublishHostControlsV4(*wire, schema(), {}, sequence) == Status::Busy && sequence == 2);
    HostControlsV4 replacement;
    CHECK(tryReadHostControlsV4(replacement, schema(), 2, observed) == Status::Uninitialized);
    CHECK(InterlockedCompareExchange(&wire->lock, 0, 0) == 1);
  } catch (...) { UnmapViewOfFile(wire); CloseHandle(mapping); throw; }
  UnmapViewOfFile(wire); CloseHandle(mapping);
}

int wmain(int argc, wchar_t* argv[]) {
  try {
    if (argc == 3) return childOperation(argv[1], argv[2]);
    emptyAndRoundtrip(); invalidInputIsAtomic(); corruptAndExhaustedState();
    contentionDoesNotReadPayload(); concurrentSnapshotsAreCoherent(); crossProcessAndAbandonment();
    std::cout << "Host control v4: empty, full, validation, sequence, contention, coherence, cross-process publication and abandonment passed\n";
    return 0;
  } catch (const std::exception& error) { std::cerr << error.what() << '\n'; return 1; }
}
