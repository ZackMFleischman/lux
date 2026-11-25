// Test-only physical Windows semantics gate. No production helper/protocol.
#include <windows.h>
#include <winternl.h>
#include <winioctl.h>
#include <cassert>
#include <cstddef>
#include <cstring>
#include <filesystem>
#include <iostream>
#include <stdexcept>
#include <string>
#include <vector>

namespace fs = std::filesystem;
struct Handle {
  HANDLE h = INVALID_HANDLE_VALUE;
  explicit Handle(HANDLE value = INVALID_HANDLE_VALUE) : h(value) {}
  ~Handle() { if (h != INVALID_HANDLE_VALUE && h != nullptr) CloseHandle(h); }
  Handle(const Handle&) = delete;
  Handle& operator=(const Handle&) = delete;
  Handle(Handle&& other) noexcept : h(other.h) { other.h = INVALID_HANDLE_VALUE; }
  bool valid() const { return h != INVALID_HANDLE_VALUE && h != nullptr; }
};
void require(bool value, const char* message) { if (!value) throw std::runtime_error(message); }
void log(const std::string& key, unsigned long long value) {
  std::cout << key << '=' << value << '\n' << std::flush;
}
using NtOpen = NTSTATUS(NTAPI*)(PHANDLE, ACCESS_MASK, POBJECT_ATTRIBUTES,
  PIO_STATUS_BLOCK, PLARGE_INTEGER, ULONG, ULONG, ULONG, ULONG, PVOID, ULONG);
using NtSet = NTSTATUS(NTAPI*)(HANDLE, PIO_STATUS_BLOCK, PVOID, ULONG, FILE_INFORMATION_CLASS);
template<class Function> Function native(const char* name) {
  // Already-loaded Windows system ntdll; never a project/PATH DLL search.
  const auto module = GetModuleHandleW(L"ntdll.dll");
  require(module != nullptr, "ntdll unavailable");
  const auto address = GetProcAddress(module, name);
  require(address != nullptr, "native API unavailable");
  Function result;
  static_assert(sizeof(result) == sizeof(address));
  std::memcpy(&result, &address, sizeof(result));
  return result;
}
constexpr ACCESS_MASK directoryAccess = FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | SYNCHRONIZE;
constexpr ACCESS_MASK contentAccess = FILE_READ_DATA | FILE_READ_ATTRIBUTES | SYNCHRONIZE;
Handle child(HANDLE parent, const std::wstring& name, bool directory, NTSTATUS& status) {
  require(!name.empty() && name.find_first_of(L"/\\:") == std::wstring::npos && name != L"." && name != L"..", "single child required");
  require(name.size() < 32767, "child name too long");
  UNICODE_STRING text{};
  text.Buffer = const_cast<PWSTR>(name.data());
  text.Length = static_cast<USHORT>(name.size() * sizeof(wchar_t));
  text.MaximumLength = text.Length;
  OBJECT_ATTRIBUTES attributes{};
  attributes.Length = sizeof(attributes);
  attributes.RootDirectory = parent;
  attributes.ObjectName = &text;
  attributes.Attributes = OBJ_CASE_INSENSITIVE;
  IO_STATUS_BLOCK io{};
  HANDLE result = INVALID_HANDLE_VALUE;
  status = native<NtOpen>("NtCreateFile")(&result, directory ? directoryAccess : contentAccess,
    &attributes, &io, nullptr, 0, directory ? FILE_SHARE_READ | FILE_SHARE_WRITE : FILE_SHARE_READ,
    FILE_OPEN, FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT |
      (directory ? FILE_DIRECTORY_FILE : FILE_NON_DIRECTORY_FILE), nullptr, 0);
  if (status < 0) result = INVALID_HANDLE_VALUE;
  return Handle(result);
}
BY_HANDLE_FILE_INFORMATION info(HANDLE file) {
  BY_HANDLE_FILE_INFORMATION result{};
  require(GetFileInformationByHandle(file, &result) != 0, "query file information");
  return result;
}
std::wstring finalName(HANDLE file) {
  std::vector<wchar_t> result(32768);
  const DWORD length = GetFinalPathNameByHandleW(file, result.data(), static_cast<DWORD>(result.size()), VOLUME_NAME_GUID);
  require(length > 0 && length < result.size(), "query final path");
  return std::wstring(result.data(), length);
}
bool safe(HANDLE file, const std::wstring& expected, bool directory) {
  const auto attributes = info(file);
  const DWORD forbidden = FILE_ATTRIBUTE_REPARSE_POINT | FILE_ATTRIBUTE_OFFLINE |
    FILE_ATTRIBUTE_RECALL_ON_OPEN | FILE_ATTRIBUTE_RECALL_ON_DATA_ACCESS;
  return !(attributes.dwFileAttributes & forbidden) &&
    !!(attributes.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY) == directory &&
    (directory || attributes.nNumberOfLinks == 1) && finalName(file) == expected;
}
struct Root {
  std::vector<Handle> pinned;
  std::wstring name;
  explicit Root(const fs::path& absolute) {
    const auto dos = absolute.wstring();
    require(dos.size() > 3 && dos[1] == L':' && dos[2] == L'\\', "explicit local DOS root");
    wchar_t volume[100]{};
    require(GetDriveTypeW(dos.substr(0, 3).c_str()) == DRIVE_FIXED, "fixed local volume");
    require(GetVolumeNameForVolumeMountPointW(dos.substr(0, 3).c_str(), volume, 100) != 0, "resolve volume");
    pinned.emplace_back(CreateFileW(volume, directoryAccess, FILE_SHARE_READ | FILE_SHARE_WRITE,
      nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    require(pinned.back().valid(), "open volume root");
    wchar_t filesystem[32]{};
    require(GetVolumeInformationByHandleW(pinned.back().h, nullptr, 0, nullptr, nullptr, nullptr,
      filesystem, 32) != 0 && std::wstring(filesystem) == L"NTFS", "NTFS required");
    const auto volumeId = info(pinned.back().h).dwVolumeSerialNumber;
    name = finalName(pinned.back().h);
    require(safe(pinned.back().h, name, true), "safe volume root");
    for (const auto& component : absolute.relative_path()) {
      if (name.back() != L'\\') name += L'\\';
      name += component.wstring();
      NTSTATUS status{};
      auto next = child(pinned.back().h, component.wstring(), true, status);
      if (!next.valid()) {
        std::wcout << L"failed_prefix=" << name << L'\n';
        log("prefix_ntstatus", static_cast<DWORD>(status));
      }
      require(next.valid(), "open prefix directory");
      require(safe(next.h, name, true) && info(next.h).dwVolumeSerialNumber == volumeId, "validate prefix directory");
      pinned.push_back(std::move(next));
    }
    log("retained_prefix_handles", pinned.size());
  }
};
void writeFixture(const fs::path& path, const std::string& value) {
  Handle file(CreateFileW(path.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_NEW, 0, nullptr));
  require(file.valid(), "create test-owned fixture");
  DWORD written{};
  require(WriteFile(file.h, value.data(), static_cast<DWORD>(value.size()), &written, nullptr) != 0 && written == value.size(), "write fixture");
}
std::string observedRead(HANDLE file) {
  char bytes[128]{};
  DWORD count{};
  require(ReadFile(file, bytes, sizeof(bytes), &count, nullptr) != 0, "read admitted handle");
  std::cout << "ACTUAL_CONTENT_READ bytes=" << count << " value=" << std::string(bytes, count) << '\n' << std::flush;
  return std::string(bytes, count);
}
// Test-only layouts from Microsoft WDK documentation. SDK winternl.h exposes
// only FileDirectoryInformation; these are verified documented values/layouts,
// not production opcodes or caller-selectable native flags.
// https://learn.microsoft.com/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_file_link_information
// https://learn.microsoft.com/windows-hardware/drivers/ddi/wdm/ne-wdm-_file_information_class
struct LinkInformation { BOOLEAN replace; HANDLE root; ULONG length; WCHAR name[1]; };
static_assert(offsetof(LinkInformation, name) == 20);
constexpr auto linkInformationClass = static_cast<FILE_INFORMATION_CLASS>(11);
// https://learn.microsoft.com/windows-hardware/drivers/ddi/ntifs/ns-ntifs-_reparse_data_buffer
struct MountPoint { ULONG tag; USHORT length; USHORT reserved; USHORT substituteOffset;
  USHORT substituteLength; USHORT printOffset; USHORT printLength; WCHAR paths[1]; };
static_assert(offsetof(MountPoint, paths) == 16);
DWORD junction(HANDLE directory, const fs::path& destination) {
  const std::wstring substitute = L"\\??\\" + destination.wstring();
  const auto bytes = static_cast<USHORT>(substitute.size() * sizeof(wchar_t));
  std::vector<unsigned char> data(16 + bytes + 4);
  auto* point = reinterpret_cast<MountPoint*>(data.data());
  point->tag = IO_REPARSE_TAG_MOUNT_POINT;
  point->length = static_cast<USHORT>(data.size() - 8);
  point->substituteLength = bytes;
  point->printOffset = static_cast<USHORT>(bytes + 2);
  std::memcpy(point->paths, substitute.data(), bytes);
  DWORD returned{};
  return DeviceIoControl(directory, FSCTL_SET_REPARSE_POINT, data.data(), static_cast<DWORD>(data.size()),
    nullptr, 0, &returned, nullptr) ? ERROR_SUCCESS : GetLastError();
}
Handle event(const std::wstring& name, bool create) {
  Handle result(create ? CreateEventW(nullptr, TRUE, FALSE, name.c_str()) :
    OpenEventW(EVENT_MODIFY_STATE | SYNCHRONIZE, FALSE, name.c_str()));
  require(result.valid(), "event handle");
  return result;
}
void wait(HANDLE value) { require(WaitForSingleObject(value, 15000) == WAIT_OBJECT_0, "bounded barrier timeout"); }
Handle launch(const std::wstring& arguments) {
  wchar_t exe[32768]{};
  require(GetModuleFileNameW(nullptr, exe, 32768) > 0, "test executable path");
  std::wstring command = L"\"" + std::wstring(exe) + L"\" " + arguments;
  STARTUPINFOW startup{}; startup.cb = sizeof(startup);
  PROCESS_INFORMATION process{};
  require(CreateProcessW(exe, command.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW,
    nullptr, nullptr, &startup, &process) != 0, "hidden attacker process");
  CloseHandle(process.hThread);
  return Handle(process.hProcess);
}
struct Attacker {
  std::wstring stem;
  Handle ready, go, done, process;
  Attacker(const fs::path& base, const std::wstring& mode, const std::wstring& suffix)
    : stem(L"Local\\LuxFsGate-" + std::to_wstring(GetCurrentProcessId()) + L"-" + suffix),
      ready(event(stem + L"-ready", true)), go(event(stem + L"-go", true)), done(event(stem + L"-done", true)),
      process(launch(L"attacker \"" + base.wstring() + L"\" " + mode + L" \"" + stem + L"\"")) { wait(ready.h); }
  ~Attacker() {
    if (WaitForSingleObject(process.h, 0) == WAIT_TIMEOUT) {
      TerminateProcess(process.h, 91); WaitForSingleObject(process.h, 5000);
    }
  }
  DWORD run() { SetEvent(go.h); wait(done.h); wait(process.h); DWORD code{};
    require(GetExitCodeProcess(process.h, &code) != 0, "attacker exit code"); return code; }
};
int attack(const fs::path& base, const std::wstring& mode, const std::wstring& stem) {
  auto ready = event(stem + L"-ready", false), go = event(stem + L"-go", false), done = event(stem + L"-done", false);
  Handle before;
  if (mode == L"junction-before") before.h = CreateFileW((base / L"parent").c_str(), FILE_WRITE_ATTRIBUTES,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
    FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
  SetEvent(ready.h); wait(go.h);
  DWORD result{};
  if (mode.starts_with(L"junction")) {
    Handle after;
    if (mode != L"junction-before") after.h = CreateFileW((base / L"parent").c_str(), FILE_WRITE_ATTRIBUTES,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING,
      FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT, nullptr);
    const HANDLE target = mode == L"junction-before" ? before.h : after.h;
    result = target != INVALID_HANDLE_VALUE ? junction(target, base / L"outside") : GetLastError();
  } else if (mode.starts_with(L"link")) {
    Handle source(CreateFileW((base / L"root" / L"source.ts").c_str(), 0,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, FILE_FLAG_OPEN_REPARSE_POINT, nullptr));
    require(source.valid(), "minimal-access source open");
    Handle destination(CreateFileW((base / L"outside").c_str(), FILE_ADD_FILE | SYNCHRONIZE,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, FILE_FLAG_BACKUP_SEMANTICS, nullptr));
    require(destination.valid(), "link destination open");
    const std::wstring name = mode + L".ts";
    std::vector<unsigned char> bytes(sizeof(LinkInformation) + name.size() * sizeof(wchar_t));
    auto* link = reinterpret_cast<LinkInformation*>(bytes.data());
    link->root = destination.h; link->length = static_cast<ULONG>(name.size() * sizeof(wchar_t));
    std::memcpy(link->name, name.data(), link->length);
    IO_STATUS_BLOCK io{};
    result = static_cast<DWORD>(native<NtSet>("NtSetInformationFile")(source.h, &io, bytes.data(),
      static_cast<ULONG>(bytes.size()), linkInformationClass));
  } else if (mode == L"writer" || mode == L"mapping") {
    Handle source(CreateFileW((base / L"root" / L"source.ts").c_str(), GENERIC_READ | GENERIC_WRITE,
      FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr));
    require(source.valid(), "attacker writable open");
    Handle mapping;
    void* view = nullptr;
    if (mode == L"mapping") {
      mapping.h = CreateFileMappingW(source.h, nullptr, PAGE_READWRITE, 0, 0, nullptr);
      require(mapping.valid(), "writable mapping");
      view = MapViewOfFile(mapping.h, FILE_MAP_WRITE, 0, 0, 0);
      require(view != nullptr, "writable view");
      CloseHandle(source.h); source.h = INVALID_HANDLE_VALUE;
    }
    // A second barrier tells the defender the incompatible resource is live.
    ResetEvent(go.h); SetEvent(done.h); wait(go.h);
    if (view) UnmapViewOfFile(view);
    return 0;
  }
  SetEvent(done.h);
  return static_cast<int>(result);
}
void junctionCase(const fs::path& base, bool before) {
  fs::create_directories(base / L"parent"); fs::create_directories(base / L"outside");
  writeFixture(base / L"outside" / L"victim.ts", "OUTSIDE_SENTINEL");
  const auto mode = before ? L"junction-before" : L"junction-after";
  std::cout << "CASE " << (before ? "junction-before" : "junction-after") << '\n';
  Attacker attacker(base, mode, mode);
  Root root(base / L"parent");
  const auto identity = info(root.pinned.back().h);
  log("FSCTL_SET_REPARSE_POINT_win32", attacker.run());
  log("parent_attributes_after", info(root.pinned.back().h).dwFileAttributes);
  require(info(root.pinned.back().h).nFileIndexLow == identity.nFileIndexLow, "parent identity substitution");
  NTSTATUS status{};
  auto leaf = child(root.pinned.back().h, L"victim.ts", false, status);
  log("relative_child_open_ntstatus", static_cast<DWORD>(status));
  if (leaf.valid()) {
    std::wcout << L"opened_leaf_final_name=" << finalName(leaf.h) << L'\n';
    if (!safe(leaf.h, root.name + L"\\victim.ts", false)) {
      std::cout << "CONFLICT_BEFORE_CONTENT_READ outside_final_name_or_metadata\n";
    } else {
      const auto bytes = observedRead(leaf.h);
      require(bytes != "OUTSIDE_SENTINEL", "STOP: outside content read");
    }
  }
  std::cout << "PASS no_outside_content_read\n";
}
void hardlinkCase(const fs::path& base, const std::wstring& phase) {
  fs::create_directories(base / L"root"); fs::create_directories(base / L"outside");
  writeFixture(base / L"root" / L"source.ts", "ORIGINAL_BYTES");
  std::wcout << L"CASE " << phase << L'\n';
  Root root(base / L"root");
  Attacker attacker(base, phase, phase);
  NTSTATUS status{};
  if (phase == L"link-before") log("NtSetInformationFile_status", attacker.run());
  auto source = child(root.pinned.back().h, L"source.ts", false, status);
  require(source.valid(), "content open");
  const bool admitted = safe(source.h, root.name + L"\\source.ts", false);
  log("admitted", admitted);
  if (phase == L"link-before") { require(!admitted, "reject preexisting multiple links"); return; }
  require(admitted, "initial admitted source");
  if (phase == L"link-after-seal") require(observedRead(source.h) == "ORIGINAL_BYTES", "original bytes before seal");
  if (phase == L"link-after-release") { CloseHandle(source.h); source.h = INVALID_HANDLE_VALUE; }
  const auto result = attacker.run(); log("NtSetInformationFile_status", result);
  require(result == 0, "mandatory minimal-access hardlink race unavailable");
  if (source.valid()) {
    log("observed_links", info(source.h).nNumberOfLinks);
    require(info(source.h).nNumberOfLinks == 2, "observe alias at seal/precommit");
    LARGE_INTEGER zero{}; require(SetFilePointerEx(source.h, zero, nullptr, FILE_BEGIN) != 0, "reset test read");
    require(observedRead(source.h) == "ORIGINAL_BYTES", "stable bytes after alias");
    for (const auto& path : {base / L"root" / L"source.ts", base / L"outside" / (phase + L".ts")}) {
      Handle writer(CreateFileW(path.c_str(), GENERIC_WRITE, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
        nullptr, OPEN_EXISTING, 0, nullptr));
      log("alias_write_open_error", writer.valid() ? 0 : GetLastError());
      require(!writer.valid(), "alias writer escaped read lease");
    }
    CloseHandle(source.h); source.h = INVALID_HANDLE_VALUE;
  }
  Handle writer(CreateFileW((base / L"outside" / (phase + L".ts")).c_str(), GENERIC_WRITE,
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr));
  require(writer.valid(), "alias writable after release");
  std::cout << "PASS observed_link_policy_and_byte_stability\n";
}
void incompatibleCase(const fs::path& base, const std::wstring& mode) {
  fs::create_directories(base / L"root"); fs::create_directories(base / L"outside");
  writeFixture(base / L"root" / L"source.ts", "ORIGINAL_BYTES");
  std::wcout << L"CASE " << mode << L'\n';
  Root root(base / L"root"); Attacker attacker(base, mode, mode);
  SetEvent(attacker.go.h); wait(attacker.done.h);
  NTSTATUS status{}; auto source = child(root.pinned.back().h, L"source.ts", false, status);
  log("incompatible_admission_ntstatus", static_cast<DWORD>(status));
  const bool failed = !source.valid();
  SetEvent(attacker.go.h); wait(attacker.process.h);
  require(failed, "STOP: content admitted with incompatible live writer or writable mapping");
  auto after = child(root.pinned.back().h, L"source.ts", false, status);
  require(after.valid(), "admission after incompatible resource released");
  std::cout << "PASS incompatible_resource_blocks_admission\n";
}
int wmain(int argc, wchar_t** argv) {
  try {
    if (argc == 5 && std::wstring(argv[1]) == L"attacker") return attack(argv[2], argv[3], argv[4]);
    require(argc == 2, "usage: semantic_gate absolute-test-owned-fixture-root");
    const fs::path base(argv[1]); require(!fs::exists(base), "fixture root must be new");
    fs::create_directories(base);
    log("directory_access", directoryAccess); log("directory_share", FILE_SHARE_READ | FILE_SHARE_WRITE);
    log("content_access", contentAccess); log("content_share", FILE_SHARE_READ);
    junctionCase(base / L"junction-before", true);
    junctionCase(base / L"junction-after", false);
    for (const auto phase : {L"link-before", L"link-before-hash", L"link-after-seal", L"link-after-release"}) hardlinkCase(base / phase, phase);
    incompatibleCase(base / L"writer", L"writer");
    incompatibleCase(base / L"mapping", L"mapping");
    std::cout << "SEMANTIC_GATE_CASES_PASSED (additional ancestor/lifecycle cases remain)\n";
    return 0;
  } catch (const std::exception& error) { std::cerr << "FAIL " << error.what() << " win32=" << GetLastError() << '\n'; return 1; }
}
