#pragma once
#include "InstalledSource.h"
#include "shared_ring.h"
#include <filesystem>
#include <fstream>
#include <optional>
#include <vector>
namespace lux {
// Descriptor reads are bounded and do not load Electron, GPU resources or visual code.
inline std::optional<InstalledSource> readInstalledSource(const void* address){
 HMODULE module=nullptr;
 if(!GetModuleHandleExW(GET_MODULE_HANDLE_EX_FLAG_FROM_ADDRESS|GET_MODULE_HANDLE_EX_FLAG_UNCHANGED_REFCOUNT,reinterpret_cast<LPCWSTR>(address),&module))throw std::runtime_error("Lux DLL location unavailable");
 wchar_t filename[32768]{};const auto length=GetModuleFileNameW(module,filename,32768);
 if(!length||length>=32768)throw std::runtime_error("Lux DLL path exceeds limit");
 std::filesystem::path dll(filename),descriptor(std::wstring(filename)+L".lux-source");
 if(!std::filesystem::exists(descriptor)){
  if(dll.filename()==L"LuxTracerTR02.dll")return {};
  throw std::runtime_error("Lux source descriptor is missing; reinstall this release");
 }
 if(std::filesystem::file_size(descriptor)>512)throw std::runtime_error("Lux descriptor exceeds limit");
 std::ifstream file(descriptor,std::ios::binary);return parseInstalledSource(std::string(std::istreambuf_iterator<char>(file),{}));
}
inline std::filesystem::path installedRoot(){wchar_t path[32768]{};auto length=GetEnvironmentVariableW(L"LOCALAPPDATA",path,32768);if(!length||length>=32768)throw std::runtime_error("LOCALAPPDATA is unavailable");return std::filesystem::path(path)/L"Lux"/L"Installed";}
class InstalledActivation {
 std::optional<InstalledSource> source;
 std::filesystem::path directory,request,ready;
 std::string instance;
 HANDLE launchMutex=nullptr;bool ownsMutex=false;ULONGLONG launchedAt=0;
 void unlock(){if(ownsMutex)ReleaseMutex(launchMutex);if(launchMutex)CloseHandle(launchMutex);launchMutex=nullptr;ownsMutex=false;}
 bool supervisorAlive()const{
  WIN32_FILE_ATTRIBUTE_DATA attributes{};if(!GetFileAttributesExW(ready.c_str(),GetFileExInfoStandard,&attributes))return false;
  FILETIME now;GetSystemTimeAsFileTime(&now);ULARGE_INTEGER a{},b{};a.LowPart=now.dwLowDateTime;a.HighPart=now.dwHighDateTime;b.LowPart=attributes.ftLastWriteTime.dwLowDateTime;b.HighPart=attributes.ftLastWriteTime.dwHighDateTime;
  return a.QuadPart>=b.QuadPart&&a.QuadPart-b.QuadPart<50000000ULL;
 }
 void launch(){
  if(supervisorAlive()){unlock();return;}
  if(ownsMutex&&GetTickCount64()-launchedAt<10000)return;
  unlock();UserSecurity security;
  auto mutex=L"Local\\LuxInstalledLaunch-"+userSid()+L"-"+std::wstring(source->runtimeId.begin(),source->runtimeId.end());
  launchMutex=CreateMutexW(&security.attributes,FALSE,mutex.c_str());if(!launchMutex)throw std::runtime_error("Lux runtime startup mutex failed");
  auto wait=WaitForSingleObject(launchMutex,0);if(wait!=WAIT_OBJECT_0&&wait!=WAIT_ABANDONED){unlock();return;}ownsMutex=true;
  if(supervisorAlive()){unlock();return;}
  const auto runtime=installedRoot()/L"runtimes"/source->runtimeId;
  auto executable=runtime/L"electron"/L"electron.exe",script=runtime/L"apps"/L"installed-runtime"/L"src"/L"supervisor.cjs";
  if(!std::filesystem::exists(executable)||!std::filesystem::exists(script))throw std::runtime_error("Pinned Lux runtime is missing; reinstall the exported package");
  std::wstring command=L"\""+executable.wstring()+L"\" \""+script.wstring()+L"\" --lux-runtime-id "+std::wstring(source->runtimeId.begin(),source->runtimeId.end());
  // Node mode uses the bundled Electron executable; the playback PC needs no Node install.
  std::vector<wchar_t> environment;auto inherited=GetEnvironmentStringsW();if(!inherited)throw std::runtime_error("Lux startup environment unavailable");
  for(auto p=inherited;*p;p+=wcslen(p)+1)if(_wcsnicmp(p,L"ELECTRON_RUN_AS_NODE=",21)!=0)environment.insert(environment.end(),p,p+wcslen(p)+1);
  FreeEnvironmentStringsW(inherited);const wchar_t mode[]=L"ELECTRON_RUN_AS_NODE=1";environment.insert(environment.end(),mode,mode+sizeof(mode)/sizeof(wchar_t));environment.push_back(0);
  STARTUPINFOW startup{};startup.cb=sizeof(startup);startup.dwFlags=STARTF_USESHOWWINDOW;startup.wShowWindow=0;PROCESS_INFORMATION process{};
  if(!CreateProcessW(executable.c_str(),command.data(),nullptr,nullptr,FALSE,CREATE_NO_WINDOW|CREATE_UNICODE_ENVIRONMENT,environment.data(),runtime.c_str(),&startup,&process))throw std::runtime_error("Cannot start pinned Lux runtime; reinstall the exported package");
  CloseHandle(process.hThread);CloseHandle(process.hProcess);launchedAt=GetTickCount64();
 }
public:
 void configure(std::optional<InstalledSource> value){source=std::move(value);}
 bool installed()const{return source.has_value();}
 std::wstring rendezvous()const{return source?(directory/(instance+".rendezvous")).wstring():rendezvousPath();}
 void begin(){
  if(!source)return;
  LARGE_INTEGER counter;QueryPerformanceCounter(&counter);instance=installedInstanceName(GetCurrentProcessId(),counter.QuadPart);
  directory=installedRoot()/L"instances"/source->runtimeId;std::filesystem::create_directories(directory);
  request=directory/(instance+".json");ready=directory/L"supervisor.ready";
  std::ofstream file(request,std::ios::binary|std::ios::trunc);file<<"{\"version\":1,\"runtimeId\":\""<<source->runtimeId<<"\",\"releaseId\":\""<<source->releaseId<<"\",\"instanceId\":\""<<instance<<"\",\"hostPid\":"<<GetCurrentProcessId()<<"}";file.close();if(!file)throw std::runtime_error("Cannot request installed Lux source");
  heartbeat();
 }
 void heartbeat(){
  if(!source)return;
  auto handle=CreateFileW(request.c_str(),FILE_WRITE_ATTRIBUTES,FILE_SHARE_READ|FILE_SHARE_WRITE|FILE_SHARE_DELETE,nullptr,OPEN_EXISTING,FILE_ATTRIBUTE_NORMAL,nullptr);
  if(handle==INVALID_HANDLE_VALUE)throw std::runtime_error("Lux instance lease disappeared");FILETIME now;GetSystemTimeAsFileTime(&now);SetFileTime(handle,nullptr,nullptr,&now);CloseHandle(handle);launch();
 }
 void end(){unlock();if(!request.empty())DeleteFileW(request.c_str());request.clear();}
 ~InstalledActivation(){end();}
};
}
