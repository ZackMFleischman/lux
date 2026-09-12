
#include <d3d11_1.h>
#include "FrameReceiver.h"
#include <dxgi1_2.h>
#include <wrl/client.h>
#include <fstream>
#include <sstream>
using Microsoft::WRL::ComPtr;
namespace lux {
namespace {
using OpenDevice=HANDLE(WINAPI*)(void*);
using CloseDevice=BOOL(WINAPI*)(HANDLE);
using RegisterObject=HANDLE(WINAPI*)(HANDLE,void*,GLuint,GLenum,GLenum);
using UnregisterObject=BOOL(WINAPI*)(HANDLE,HANDLE);
using LockObjects=BOOL(WINAPI*)(HANDLE,GLint,HANDLE*);
void require(bool result,const char* message){if(!result)throw std::runtime_error(message);}
}
bool FrameReceiver::start(HDC target,HGLRC host) {
  dc=target;
  using Create=HGLRC(WINAPI*)(HDC,HGLRC,const int*);
  const auto create=reinterpret_cast<Create>(wglGetProcAddress("wglCreateContextAttribsARB"));
  const int attributes[]={0x2091,4,0x2092,1,0};
  if(create)shared=create(dc,host,attributes);
  worker=std::thread(&FrameReceiver::run,this);
  return shared!=nullptr;
}
void FrameReceiver::run() {
  wchar_t temp[MAX_PATH];GetTempPathW(MAX_PATH,temp);
  wchar_t configured[32768];DWORD length=GetEnvironmentVariableW(L"LUX_HOST_LOG",configured,32768);
  std::ofstream log(length?std::wstring(configured):std::wstring(temp)+L"LuxTracer-tr02-host.jsonl",std::ios::app);
  HANDLE mapping=nullptr;SharedRing* ring=nullptr;
  ComPtr<ID3D11Device1> device;ComPtr<ID3D11DeviceContext> context;
  struct Import {ComPtr<ID3D11Texture2D> texture,local;ComPtr<ID3D11Query> query;GLuint gl=0;HANDLE object=nullptr;};
  std::array<Import,3> imports;
  HANDLE interop=nullptr;GLuint readFbo=0,drawFbo=0;
  auto open=reinterpret_cast<OpenDevice>(wglGetProcAddress("wglDXOpenDeviceNV"));
  auto close=reinterpret_cast<CloseDevice>(wglGetProcAddress("wglDXCloseDeviceNV"));
  auto reg=reinterpret_cast<RegisterObject>(wglGetProcAddress("wglDXRegisterObjectNV"));
  auto unreg=reinterpret_cast<UnregisterObject>(wglGetProcAddress("wglDXUnregisterObjectNV"));
  auto lock=reinterpret_cast<LockObjects>(wglGetProcAddress("wglDXLockObjectsNV"));
  auto unlock=reinterpret_cast<LockObjects>(wglGetProcAddress("wglDXUnlockObjectsNV"));
  // Resolve extensions after making our shared context current, never in FFGL ProcessOpenGL.
  try {
    require(shared&&wglMakeCurrent(dc,shared),"worker shared GL context failed");
    open=reinterpret_cast<OpenDevice>(wglGetProcAddress("wglDXOpenDeviceNV"));
    close=reinterpret_cast<CloseDevice>(wglGetProcAddress("wglDXCloseDeviceNV"));
    reg=reinterpret_cast<RegisterObject>(wglGetProcAddress("wglDXRegisterObjectNV"));
    unreg=reinterpret_cast<UnregisterObject>(wglGetProcAddress("wglDXUnregisterObjectNV"));
    lock=reinterpret_cast<LockObjects>(wglGetProcAddress("wglDXLockObjectsNV"));
    unlock=reinterpret_cast<LockObjects>(wglGetProcAddress("wglDXUnlockObjectsNV"));
    require(open&&close&&reg&&unreg&&lock&&unlock,"NV interop extension unavailable");
    log<<"{\"kind\":\"context\",\"sharedContext\":true,\"nvInterop\":true,\"pid\":"<<GetCurrentProcessId()<<",\"renderer\":\""<<glGetString(GL_RENDERER)<<"\"}"<<std::endl;
    ComPtr<IDXGIFactory1> factory;require(SUCCEEDED(CreateDXGIFactory1(IID_PPV_ARGS(&factory))),"DXGI factory");
    ComPtr<IDXGIAdapter1> adapter;DXGI_ADAPTER_DESC1 description{};
    for(UINT i=0;factory->EnumAdapters1(i,&adapter)!=DXGI_ERROR_NOT_FOUND;++i){adapter->GetDesc1(&description);if(description.VendorId==0x10de)break;adapter.Reset();}
    require(bool(adapter),"NVIDIA adapter missing");
    ComPtr<ID3D11Device> base;
    require(SUCCEEDED(D3D11CreateDevice(adapter.Get(),D3D_DRIVER_TYPE_UNKNOWN,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,&base,nullptr,&context)),"D3D device");
    require(SUCCEEDED(base.As(&device)),"D3D11.1");
    interop=open(device.Get());require(interop!=nullptr,"wglDXOpenDeviceNV failed: adapter/context compatibility unproved");
    log<<"{\"kind\":\"adapter\",\"luidLow\":"<<description.AdapterLuid.LowPart<<",\"luidHigh\":"<<description.AdapterLuid.HighPart<<"}"<<std::endl;
    glGenFramebuffers(1,&readFbo);glGenFramebuffers(1,&drawFbo);
    std::wstring connected;uint64_t ticks=0;
    int pending=-1,sourceSlot=-1;
    auto detach=[&]{for(auto& item:imports){if(item.object)unreg(interop,item.object);if(item.gl)glDeleteTextures(1,&item.gl);item={};}if(ring)UnmapViewOfFile(ring);ring=nullptr;if(mapping)CloseHandle(mapping);mapping=nullptr;};
    while(!stopping) {
      if(pending>=0) {
        auto& output=outputs[pending];const GLenum status=glClientWaitSync(output.fence,0,0);
        require(status!=GL_WAIT_FAILED,"worker fence failed");
        if(status==GL_ALREADY_SIGNALED||status==GL_CONDITION_SATISFIED) {
          glDeleteSync(output.fence);output.fence=nullptr;
          auto& imported=imports[sourceSlot];require(unlock(interop,1,&imported.object),"NV unlock failed");
          
          output.state.store(Ready);pending=-1;sourceSlot=-1;
        }
      }
      if(ticks%500==0 && pending<0) {
        std::wifstream file(rendezvousPath());std::wstring name;std::getline(file,name);
        if(!name.empty()&&name!=connected&&name.rfind(L"Local\\LuxTracerTR02-",0)==0) {
          detach();mapping=OpenFileMappingW(FILE_MAP_ALL_ACCESS,FALSE,name.c_str());
          if(mapping)ring=static_cast<SharedRing*>(MapViewOfFile(mapping,FILE_MAP_ALL_ACCESS,0,0,sizeof(SharedRing)));
          if(ring) {
            require(ring->version==1,"ring version mismatch");
            require(ring->adapter.LowPart==description.AdapterLuid.LowPart&&ring->adapter.HighPart==description.AdapterLuid.HighPart,"adapter LUID mismatch");
            connected=name;log<<"{\"kind\":\"attached\",\"producerPid\":"<<ring->pid<<",\"generation\":"<<ring->generation<<"}"<<std::endl;
          }
        }
        log<<"{\"kind\":\"counters\",\"callbacks\":"<<callbacks.load()<<",\"consumed\":"<<consumed.load()<<"}"<<std::endl;
      }
      if(ring) {float value=intensity.load();LONG bits;memcpy(&bits,&value,sizeof(bits));InterlockedExchange(&ring->controlBits,bits);}
      if(ring&&pending<0&&InterlockedCompareExchange(&ring->alive,1,1)==1) {
        int outputIndex=-1;
        for(int i=0;i<3;++i){int expected=Free;if(outputs[i].state.compare_exchange_strong(expected,Writing)){outputIndex=i;break;}}
        if(outputIndex>=0) {
          int newest=-1;uint64_t frame=0;
          for(int i=0;i<3;++i)if(InterlockedCompareExchange(&ring->slots[i].state,Ready,Ready)==Ready&&ring->slots[i].frame>frame){newest=i;frame=ring->slots[i].frame;}
          if(newest>=0&&transition(ring->slots[newest],Ready,Reading)) {
            auto& source=ring->slots[newest];auto& imported=imports[newest];auto& output=outputs[outputIndex];
            if(!imported.object) {
              require(SUCCEEDED(device->OpenSharedResourceByName(source.textureName,DXGI_SHARED_RESOURCE_READ|DXGI_SHARED_RESOURCE_WRITE,IID_PPV_ARGS(&imported.texture))),"open owned named NT texture");
              D3D11_TEXTURE2D_DESC desc;imported.texture->GetDesc(&desc);
              require(desc.Width==source.width&&desc.Height==source.height&&desc.Format==source.format,"descriptor mismatch");
              desc.MiscFlags=0;desc.BindFlags=D3D11_BIND_SHADER_RESOURCE|D3D11_BIND_RENDER_TARGET;
              require(SUCCEEDED(device->CreateTexture2D(&desc,nullptr,&imported.local)),"local interop texture creation");
              D3D11_QUERY_DESC queryDesc{D3D11_QUERY_EVENT,0};require(SUCCEEDED(device->CreateQuery(&queryDesc,&imported.query)),"local copy query");
              glGenTextures(1,&imported.gl);glBindTexture(GL_TEXTURE_2D,imported.gl);SetLastError(0);imported.object=reg(interop,imported.local.Get(),imported.gl,GL_TEXTURE_2D,0x0000);if(!imported.object){log<<"{\"kind\":\"nv-register-error\",\"win32\":"<<GetLastError()<<",\"glError\":"<<glGetError()<<",\"misc\":"<<desc.MiscFlags<<",\"format\":"<<desc.Format<<"}"<<std::endl;}require(imported.object!=nullptr,"NV registration failed");
            }
            if(!output.texture) {glGenTextures(1,&output.texture);glBindTexture(GL_TEXTURE_2D,output.texture);glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,source.width,source.height,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);}
            context->CopyResource(imported.local.Get(),imported.texture.Get());context->End(imported.query.Get());context->Flush();
            const auto deadline=std::chrono::steady_clock::now()+std::chrono::seconds(2);
            for(;;){BOOL complete=FALSE;HRESULT result=context->GetData(imported.query.Get(),&complete,sizeof(complete),D3D11_ASYNC_GETDATA_DONOTFLUSH);require(SUCCEEDED(result),"local D3D copy query failure");if(result==S_OK&&complete)break;require(!stopping&&std::chrono::steady_clock::now()<deadline,"local D3D copy deadline");std::this_thread::sleep_for(std::chrono::milliseconds(1));}
            const uint64_t copiedFrame=source.frame;FrameKey copiedKey{ring->generation,ring->outputGeneration,source.frame,uint32_t(newest)};require(retire(*ring,copiedKey),"source retirement key mismatch");
            // This driver synchronization can wait. It is deliberately confined to this worker.
            require(lock(interop,1,&imported.object),"NV lock failed");
            glBindFramebuffer(GL_READ_FRAMEBUFFER,readFbo);glFramebufferTexture2D(GL_READ_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,imported.gl,0);
            glBindFramebuffer(GL_DRAW_FRAMEBUFFER,drawFbo);glFramebufferTexture2D(GL_DRAW_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,output.texture,0);
            require(glCheckFramebufferStatus(GL_READ_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE&&glCheckFramebufferStatus(GL_DRAW_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE,"copy FBO incomplete");
            glBlitFramebuffer(0,0,source.width,source.height,0,0,source.width,source.height,GL_COLOR_BUFFER_BIT,GL_NEAREST);
            output.frame=copiedFrame;output.generation=ring->generation;output.fence=glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE,0);glFlush();pending=outputIndex;sourceSlot=newest;
          } else outputs[outputIndex].state.store(Free);
        }
      }
      ++ticks;std::this_thread::sleep_for(std::chrono::milliseconds(1));
    }
    // Lifecycle teardown may drain the worker GPU; never reached from ProcessOpenGL.
    glFinish();if(pending>=0){unlock(interop,1,&imports[sourceSlot].object);}
    detach();
  }catch(const std::exception& error){log<<"{\"kind\":\"failure\",\"reason\":\""<<error.what()<<"\"}"<<std::endl;}
  if(interop&&close)close(interop);
  if(readFbo)glDeleteFramebuffers(1,&readFbo);if(drawFbo)glDeleteFramebuffers(1,&drawFbo);
  wglMakeCurrent(nullptr,nullptr);
}
GLuint FrameReceiver::acquireLatest() {
  ++callbacks;
  for(int i=0;i<3;++i)if(i!=current&&outputs[i].state.load()==Reading&&outputs[i].fence){const GLenum status=glClientWaitSync(outputs[i].fence,0,0);if(status==GL_ALREADY_SIGNALED||status==GL_CONDITION_SATISFIED){glDeleteSync(outputs[i].fence);outputs[i].fence=nullptr;outputs[i].state.store(Free);}}
  int newest=-1;uint64_t frame=lastFrame,generation=lastGeneration;
  for(int i=0;i<3;++i)if(outputs[i].state.load()==Ready&&(outputs[i].generation>generation||(outputs[i].generation==generation&&outputs[i].frame>frame))){newest=i;frame=outputs[i].frame;generation=outputs[i].generation;}
  if(newest>=0){int expected=Ready;if(outputs[newest].state.compare_exchange_strong(expected,Reading)){current=newest;lastFrame=frame;lastGeneration=generation;++consumed;}}
  // Drop completed older outputs atomically; never touch held output storage.
  for(int i=0;i<3;++i)if(i!=current&&outputs[i].state.load()==Ready&&(outputs[i].generation<lastGeneration||(outputs[i].generation==lastGeneration&&outputs[i].frame<lastFrame))){int expected=Ready;outputs[i].state.compare_exchange_strong(expected,Free);}
  return current>=0?outputs[current].texture:0;
}
void FrameReceiver::afterDraw(){if(current>=0){auto& output=outputs[current];if(output.fence)glDeleteSync(output.fence);output.fence=glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE,0);glFlush();}}
void FrameReceiver::stop(){stopping=true;if(worker.joinable())worker.join();if(shared){wglDeleteContext(shared);shared=nullptr;}for(auto& output:outputs){if(output.fence)glDeleteSync(output.fence);if(output.texture)glDeleteTextures(1,&output.texture);}}
}






