#pragma once
#include <node_api.h>
#include <windows.h>
#include <map>
#include <vector>
#include <string>
#include <stdexcept>
namespace lux {
struct InstalledProcess{HANDLE job=nullptr,process=nullptr;};
inline std::map<uint32_t,InstalledProcess> installedProcesses;
inline uint32_t installedProcessSequence=0;
inline std::wstring napiWide(napi_env env,napi_value value){size_t size=0;if(napi_get_value_string_utf16(env,value,nullptr,0,&size)!=napi_ok||!size||size>32760)throw std::runtime_error("Invalid installed process argument");std::vector<char16_t> bytes(size+1);napi_get_value_string_utf16(env,value,bytes.data(),bytes.size(),&size);return std::wstring(reinterpret_cast<wchar_t*>(bytes.data()),size);}
inline std::wstring quoteInstalled(const std::wstring& value){if(value.find(L'"')!=std::wstring::npos||value.back()==L'\\')throw std::runtime_error("Invalid installed launch path");return L"\""+value+L"\"";}
inline napi_value installedStart(napi_env env,napi_callback_info info){
 HANDLE job=nullptr;PROCESS_INFORMATION process{};
 try{
  size_t argc=3;napi_value args[3];napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);if(argc!=3)throw std::runtime_error("Installed launch requires executable, entrypoint, request");
  const auto executable=napiWide(env,args[0]),entry=napiWide(env,args[1]),request=napiWide(env,args[2]);
  auto command=quoteInstalled(executable)+L" "+quoteInstalled(entry)+L" "+quoteInstalled(request);
  job=CreateJobObjectW(nullptr,nullptr);if(!job)throw std::runtime_error("Installed producer job creation failed");
  JOBOBJECT_EXTENDED_LIMIT_INFORMATION limits{};limits.BasicLimitInformation.LimitFlags=JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
  if(!SetInformationJobObject(job,JobObjectExtendedLimitInformation,&limits,sizeof(limits)))throw std::runtime_error("Installed producer job limit failed");
  std::vector<wchar_t> environment;auto inherited=GetEnvironmentStringsW();if(!inherited)throw std::runtime_error("Installed producer environment failed");
  for(auto p=inherited;*p;p+=wcslen(p)+1)if(_wcsnicmp(p,L"ELECTRON_RUN_AS_NODE=",21)!=0)environment.insert(environment.end(),p,p+wcslen(p)+1);
  FreeEnvironmentStringsW(inherited);environment.push_back(0);
  STARTUPINFOW startup{};startup.cb=sizeof(startup);startup.dwFlags=STARTF_USESHOWWINDOW;startup.wShowWindow=0;
  if(!CreateProcessW(executable.c_str(),command.data(),nullptr,nullptr,FALSE,CREATE_SUSPENDED|CREATE_NO_WINDOW|CREATE_UNICODE_ENVIRONMENT,environment.data(),nullptr,&startup,&process))throw std::runtime_error("Installed producer launch failed");
  if(!AssignProcessToJobObject(job,process.hProcess))throw std::runtime_error("Installed producer job assignment failed");
  if(ResumeThread(process.hThread)==DWORD(-1))throw std::runtime_error("Installed producer resume failed");
  CloseHandle(process.hThread);process.hThread=nullptr;
  const auto key=++installedProcessSequence;installedProcesses.emplace(key,InstalledProcess{job,process.hProcess});
  napi_value result;napi_create_uint32(env,key,&result);return result;
 }catch(const std::exception& error){if(process.hProcess){TerminateProcess(process.hProcess,2);CloseHandle(process.hProcess);}if(process.hThread)CloseHandle(process.hThread);if(job)CloseHandle(job);napi_throw_error(env,nullptr,error.what());return nullptr;}
}
inline uint32_t installedKey(napi_env env,napi_callback_info info){size_t argc=1;napi_value value;uint32_t key=0;napi_get_cb_info(env,info,&argc,&value,nullptr,nullptr);if(argc!=1||napi_get_value_uint32(env,value,&key)!=napi_ok||!installedProcesses.count(key))throw std::runtime_error("Unknown installed producer");return key;}
inline napi_value installedRunning(napi_env env,napi_callback_info info){try{const auto key=installedKey(env,info);napi_value result;napi_get_boolean(env,WaitForSingleObject(installedProcesses.at(key).process,0)==WAIT_TIMEOUT,&result);return result;}catch(const std::exception& error){napi_throw_error(env,nullptr,error.what());return nullptr;}}
inline napi_value installedStop(napi_env env,napi_callback_info info){try{const auto key=installedKey(env,info);auto value=installedProcesses.at(key);TerminateJobObject(value.job,0);CloseHandle(value.process);CloseHandle(value.job);installedProcesses.erase(key);napi_value result;napi_get_undefined(env,&result);return result;}catch(const std::exception& error){napi_throw_error(env,nullptr,error.what());return nullptr;}}
}
