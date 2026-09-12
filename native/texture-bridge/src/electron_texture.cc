#include <node_api.h>
#include <d3d11_1.h>
#include <dxgi1_2.h>
#include <wrl/client.h>
#include <sstream>
#include <fstream>
#include <array>
#include "shared_ring.h"
using Microsoft::WRL::ComPtr;
namespace {
struct Slot {
  ComPtr<ID3D11Texture2D> source, owned;
  ComPtr<ID3D11Query> done;
  HANDLE exportHandle=nullptr;
  uint64_t borrowedId=0;
};
ComPtr<ID3D11Device1> device;
ComPtr<ID3D11DeviceContext> context;
std::array<Slot,3> slots;
uint64_t sequence=0;
HANDLE mapping=nullptr;
lux::SharedRing* ring=nullptr;
std::wstring mappingName;
DXGI_ADAPTER_DESC adapterDesc{};
void check(HRESULT hr) {
  if(FAILED(hr)) { std::ostringstream s;s<<"HRESULT 0x"<<std::hex<<uint32_t(hr);throw std::runtime_error(s.str()); }
}
napi_value text(napi_env env,const std::string& value) {
  napi_value result;napi_create_string_utf8(env,value.c_str(),value.size(),&result);return result;
}
void initialize() {
  if(device&&ring)return;
  // A previous partial initialization has submitted no GPU commands. Roll back
  // its mapping/device before retry rather than treating a bare device as ready.
  if(ring){UnmapViewOfFile(ring);ring=nullptr;}if(mapping){CloseHandle(mapping);mapping=nullptr;}
  context.Reset();device.Reset();
  ComPtr<IDXGIFactory1> factory;
  check(CreateDXGIFactory1(IID_PPV_ARGS(&factory)));
  ComPtr<IDXGIAdapter1> adapter;
  for(UINT i=0;factory->EnumAdapters1(i,&adapter)!=DXGI_ERROR_NOT_FOUND;++i) {
    DXGI_ADAPTER_DESC1 description{};adapter->GetDesc1(&description);
    if(description.VendorId==0x10de)break;
    adapter.Reset();
  }
  if(!adapter)throw std::runtime_error("NVIDIA reference adapter unavailable");
  adapter->GetDesc(&adapterDesc);
  ComPtr<ID3D11Device> base;
  check(D3D11CreateDevice(adapter.Get(),D3D_DRIVER_TYPE_UNKNOWN,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,&base,nullptr,&context));
  check(base.As(&device));
  LARGE_INTEGER counter;QueryPerformanceCounter(&counter);
  mappingName=L"Local\\LuxTracerTR02-"+std::to_wstring(GetCurrentProcessId())+L"-"+std::to_wstring(counter.QuadPart);
  lux::UserSecurity security;
  mapping=CreateFileMappingW(INVALID_HANDLE_VALUE,&security.attributes,PAGE_READWRITE,0,sizeof(lux::SharedRing),mappingName.c_str());
  if(!mapping||GetLastError()==ERROR_ALREADY_EXISTS)throw std::runtime_error("unique ring mapping failed");
  ring=static_cast<lux::SharedRing*>(MapViewOfFile(mapping,FILE_MAP_ALL_ACCESS,0,0,sizeof(lux::SharedRing)));
  if(!ring)throw std::runtime_error("ring view failed");
  new(ring) lux::SharedRing();ring->pid=GetCurrentProcessId();ring->generation=counter.QuadPart;ring->adapter=adapterDesc.AdapterLuid;float initial=0.65f;memcpy(const_cast<LONG*>(&ring->controlBits),&initial,sizeof(initial));
}
void allocateSlot(unsigned index,const D3D11_TEXTURE2D_DESC& sourceDesc) {
  auto& local=slots[index];auto& shared=ring->slots[index];
  if(local.owned) {
    if(sourceDesc.Width!=shared.width||sourceDesc.Height!=shared.height||sourceDesc.Format!=shared.format)throw std::runtime_error("size/format change requires new ring; fixed spike rejects resize");
    return;
  }
  D3D11_TEXTURE2D_DESC desc=sourceDesc;
  desc.BindFlags=D3D11_BIND_SHADER_RESOURCE|D3D11_BIND_RENDER_TARGET;
  desc.MiscFlags=D3D11_RESOURCE_MISC_SHARED_NTHANDLE|D3D11_RESOURCE_MISC_SHARED;
  desc.CPUAccessFlags=0;desc.Usage=D3D11_USAGE_DEFAULT;
  check(device->CreateTexture2D(&desc,nullptr,&local.owned));
  ComPtr<IDXGIResource1> resource;check(local.owned.As(&resource));
  const auto name=mappingName+L"-texture-"+std::to_wstring(index);
  lux::UserSecurity security;
  check(resource->CreateSharedHandle(&security.attributes,DXGI_SHARED_RESOURCE_READ|DXGI_SHARED_RESOURCE_WRITE,name.c_str(),&local.exportHandle));
  wcscpy_s(shared.textureName,name.c_str());shared.width=desc.Width;shared.height=desc.Height;shared.format=desc.Format;
  D3D11_QUERY_DESC query{D3D11_QUERY_EVENT,0};check(device->CreateQuery(&query,&local.done));
}
napi_value submit(napi_env env,napi_callback_info info) {
  unsigned index=3;
  try {
    initialize();
    if(lux::isClosing(*ring))throw std::runtime_error("producer is closing; submissions rejected");
    size_t argc=1; napi_value args[1];napi_get_cb_info(env,info,&argc,args,nullptr,nullptr);
    void* bytes=nullptr;size_t length=0;
    if(argc!=1||napi_get_buffer_info(env,args[0],&bytes,&length)!=napi_ok||length!=sizeof(HANDLE))throw std::runtime_error("NT handle must be 8-byte Buffer");
    unsigned pending=0;for(const auto& slot:slots)if(slot.borrowedId)++pending;
    if(pending>=2)return text(env,"{\"drop\":\"producer-inflight-limit\"}");
    for(unsigned i=0;i<3;++i) {
      if(lux::transition(ring->slots[i],lux::Free,lux::Writing)){index=i;break;}
    }
    if(index==3)return text(env,"{\"drop\":\"no-free-slot\"}");
    auto& local=slots[index];auto& shared=ring->slots[index];
    HANDLE borrowed;memcpy(&borrowed,bytes,sizeof(borrowed));
    check(device->OpenSharedResource1(borrowed,IID_PPV_ARGS(&local.source)));
    D3D11_TEXTURE2D_DESC desc{};local.source->GetDesc(&desc);
    if(desc.Format!=DXGI_FORMAT_B8G8R8A8_UNORM&&desc.Format!=DXGI_FORMAT_R8G8B8A8_UNORM)throw std::runtime_error("unsupported format");
    allocateSlot(index,desc);
    const auto nextSequence=sequence+1;
    if(!nextSequence)throw std::runtime_error("frame sequence exhausted");
    // Complete all fallible acceptance serialization before accepting the
    // borrowed texture. No C++ allocation/throw is allowed after CopyResource.
    std::ostringstream out;out<<"{\"id\":"<<nextSequence<<",\"slot\":"<<index<<",\"width\":"<<desc.Width<<",\"height\":"<<desc.Height<<",\"format\":"<<desc.Format<<",\"adapterLuidLow\":"<<adapterDesc.AdapterLuid.LowPart<<",\"adapterLuidHigh\":"<<adapterDesc.AdapterLuid.HighPart<<"}";
    const auto json=out.str();napi_value accepted;
    if(napi_create_string_utf8(env,json.c_str(),json.size(),&accepted)!=napi_ok)throw std::runtime_error("acceptance allocation failed");
    local.borrowedId=nextSequence;sequence=nextSequence;shared.frame=sequence;
    context->CopyResource(local.owned.Get(),local.source.Get());
    context->End(local.done.Get());context->Flush();
    return accepted;
  }catch(const std::exception& error){if(index<3&&!slots[index].borrowedId){slots[index].source.Reset();InterlockedExchange(&ring->slots[index].state,lux::Free);}napi_throw_error(env,nullptr,error.what());return nullptr;}
}
napi_value poll(napi_env env,napi_callback_info) {
  try{
  std::ostringstream out;out<<"[";bool comma=false;std::array<unsigned,3> completed{};unsigned count=0;
  for(unsigned index=0;index<3;++index) {
    auto& local=slots[index];if(!local.borrowedId)continue;
    BOOL complete=FALSE;
    const HRESULT result=context->GetData(local.done.Get(),&complete,sizeof(complete),D3D11_ASYNC_GETDATA_DONOTFLUSH);
    if(FAILED(result)){napi_throw_error(env,nullptr,"GPU query failed; borrowed leases retained until process teardown");return nullptr;}
    if(result!=S_OK||!complete)continue;
    if(comma)out<<",";out<<local.borrowedId;comma=true;
    completed[count++]=index;
  }
  out<<"]";const auto json=out.str();napi_value response;
  if(napi_create_string_utf8(env,json.c_str(),json.size(),&response)!=napi_ok)throw std::runtime_error("completion response allocation failed; leases retained");
  // No completion ID can be lost to allocation failure after its lease reset.
  for(unsigned n=0;n<count;++n){auto index=completed[n];auto& local=slots[index];local.source.Reset();local.borrowedId=0;
    LARGE_INTEGER counter;QueryPerformanceCounter(&counter);ring->slots[index].completeQpc=counter.QuadPart;
    InterlockedExchange(&ring->slots[index].state,lux::Ready);}
  return response;
  }catch(const std::exception& error){napi_throw_error(env,nullptr,error.what());return nullptr;}
}
napi_value advertise(napi_env env,napi_callback_info) {
  try{initialize();if(lux::isClosing(*ring))throw std::runtime_error("producer is closing");std::wofstream file(lux::rendezvousPath(),std::ios::trunc);file<<mappingName;file.close();if(!file)throw std::runtime_error("rendezvous write failed");return text(env,"{\"advertised\":true}");}
  catch(const std::exception& error){napi_throw_error(env,nullptr,error.what());return nullptr;}
}
napi_value control(napi_env env,napi_callback_info){float value=0.65f;if(ring){LONG bits=InterlockedCompareExchange(&ring->controlBits,0,0);memcpy(&value,&bits,sizeof(value));}napi_value result;napi_create_double(env,value,&result);return result;}
napi_value shutdown(napi_env env,napi_callback_info) {
  if(!ring)return text(env,"{\"closed\":true}");
  // Atomically close admission before examining borrowers. An admitted reader
  // may not have reached Ready -> Reading yet, so slot state alone is unsafe.
  if(!lux::closeAdmission(*ring))return text(env,"{\"closed\":false}");
  for(unsigned i=0;i<3;++i)if(slots[i].borrowedId||InterlockedCompareExchange(&ring->slots[i].state,lux::Reading,lux::Reading)==lux::Reading)return text(env,"{\"closed\":false}");
  for(auto& slot:slots){slot.source.Reset();slot.done.Reset();slot.owned.Reset();if(slot.exportHandle)CloseHandle(slot.exportHandle);slot.exportHandle=nullptr;}
  context->ClearState();context->Flush();context.Reset();device.Reset();
  UnmapViewOfFile(ring);ring=nullptr;CloseHandle(mapping);mapping=nullptr;
  return text(env,"{\"closed\":true}");
}
napi_value module(napi_env env,napi_value exports) {
  napi_property_descriptor properties[]={{"shutdown",nullptr,shutdown,nullptr,nullptr,nullptr,napi_default,nullptr},{"submit",nullptr,submit,nullptr,nullptr,nullptr,napi_default,nullptr},{"poll",nullptr,poll,nullptr,nullptr,nullptr,napi_default,nullptr},{"advertise",nullptr,advertise,nullptr,nullptr,nullptr,napi_default,nullptr},{"control",nullptr,control,nullptr,nullptr,nullptr,napi_default,nullptr}};
  napi_define_properties(env,exports,5,properties);return exports;
}
}
NAPI_MODULE(NODE_GYP_MODULE_NAME,module)



