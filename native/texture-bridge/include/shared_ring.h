#pragma once
#include <windows.h>
#include <sddl.h>
#include <string>
#include <stdexcept>
#include <cstdint>
namespace lux {
constexpr LONG Free=0, Writing=1, Ready=2, Reading=3;
struct FrameKey { uint64_t generation, outputGeneration, frame; uint32_t slot; };
struct alignas(64) SharedSlot { volatile LONG state=Free; uint32_t width=0,height=0,format=0; uint64_t frame=0,completeQpc=0; wchar_t textureName[160]{}; };
constexpr uint32_t RingVersion=2;
// Admission and closing must share one atomic word. A separate alive check cannot
// exclude a receiver that observed alive immediately before producer shutdown.
constexpr LONG RingClosing=0x40000000;
struct SharedRing { uint32_t version=RingVersion,pid=0; uint64_t generation=0,outputGeneration=1; LUID adapter{}; volatile LONG admissions=0; volatile LONG controlBits=0; SharedSlot slots[3]; };
inline bool beginRead(SharedRing& r) {
 LONG observed=InterlockedCompareExchange(&r.admissions,0,0);
 for(;;) {
  if(observed&RingClosing || observed==RingClosing-1)return false;
  const LONG actual=InterlockedCompareExchange(&r.admissions,observed+1,observed);
  if(actual==observed)return true;
  observed=actual;
 }
}
inline void endRead(SharedRing& r) {InterlockedDecrement(&r.admissions);}
inline bool closeAdmission(SharedRing& r) {
 const LONG previous=InterlockedOr(&r.admissions,RingClosing);
 return (previous&~RingClosing)==0;
}
inline bool isClosing(SharedRing& r) {return (InterlockedCompareExchange(&r.admissions,0,0)&RingClosing)!=0;}
inline bool transition(SharedSlot& slot,LONG from,LONG to) {return InterlockedCompareExchange(&slot.state,to,from)==from;}
inline bool retire(SharedRing& r,FrameKey k) {if(k.slot>=3||r.generation!=k.generation||r.outputGeneration!=k.outputGeneration||r.slots[k.slot].frame!=k.frame)return false;return transition(r.slots[k.slot],Reading,Free);}
inline std::wstring userSid() {
 HANDLE token=nullptr;if(!OpenProcessToken(GetCurrentProcess(),TOKEN_QUERY,&token))throw std::runtime_error("OpenProcessToken");DWORD count=0;GetTokenInformation(token,TokenUser,nullptr,0,&count);std::string bytes(count,'\0');if(!GetTokenInformation(token,TokenUser,bytes.data(),count,&count)){CloseHandle(token);throw std::runtime_error("TokenUser");}CloseHandle(token);LPWSTR sid=nullptr;if(!ConvertSidToStringSidW(reinterpret_cast<TOKEN_USER*>(bytes.data())->User.Sid,&sid))throw std::runtime_error("SID conversion");std::wstring result(sid);LocalFree(sid);return result;
}
struct UserSecurity { PSECURITY_DESCRIPTOR descriptor=nullptr;SECURITY_ATTRIBUTES attributes{sizeof(SECURITY_ATTRIBUTES),nullptr,FALSE};UserSecurity(){auto sddl=L"D:P(A;;GA;;;"+userSid()+L")";if(!ConvertStringSecurityDescriptorToSecurityDescriptorW(sddl.c_str(),SDDL_REVISION_1,&descriptor,nullptr))throw std::runtime_error("user DACL");attributes.lpSecurityDescriptor=descriptor;}~UserSecurity(){if(descriptor)LocalFree(descriptor);} };
inline std::wstring rendezvousPath(){wchar_t tmp[MAX_PATH];GetTempPathW(MAX_PATH,tmp);return std::wstring(tmp)+L"LuxTracerTR02-"+userSid()+L".rendezvous";}
}
