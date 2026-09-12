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
void unsupportedUnload() noexcept {
 OutputDebugStringA("Lux TR02: bounded-unload-unsupported; retaining worker and GPU resources until completion.\n");
 try{
  wchar_t temp[MAX_PATH]{},configured[32768]{};GetTempPathW(MAX_PATH,temp);
  auto length=GetEnvironmentVariableW(L"LUX_HOST_LOG",configured,32768);
  std::ofstream log(length>0&&length<32768?std::wstring(configured):std::wstring(temp)+L"LuxTracer-tr02-host.jsonl",std::ios::app);
  log<<"{\"kind\":\"bounded-unload-unsupported\",\"reason\":\"retaining worker and GPU resources until completion\"}"<<std::endl;
 }catch(...){}
}
// Do not accept the sentinel values returned by some WGL implementations.
template<class T>T extension(const char* name){auto p=wglGetProcAddress(name);return p==nullptr||p==reinterpret_cast<PROC>(1)||p==reinterpret_cast<PROC>(2)||p==reinterpret_cast<PROC>(3)||p==reinterpret_cast<PROC>(-1)?nullptr:reinterpret_cast<T>(p);}
Completion glCompletion(GLsync fence){if(!fence)return Completion::Failed;const auto status=glClientWaitSync(fence,0,0);if(status==GL_WAIT_FAILED)return Completion::Failed;return status==GL_ALREADY_SIGNALED||status==GL_CONDITION_SATISFIED?Completion::Complete:Completion::Pending;}
}
FrameReceiver::~FrameReceiver(){stop();}
bool FrameReceiver::start(HDC target,HGLRC host) {
 if(lifecycle.phase()==WorkerPhase::Running)return true;
 if(lifecycle.phase()!=WorkerPhase::Stopped)return false;
 if(!target||!host||wglGetCurrentContext()!=host||wglGetCurrentDC()!=target)return false;
 createContext=extension<CreateContext>("wglCreateContextAttribsARB");
 pixelFormat=GetPixelFormat(target);
 if(!createContext||!pixelFormat||!DescribePixelFormat(target,pixelFormat,sizeof(pixelDescriptor),&pixelDescriptor))return false;
 hostContext=host;
 if(!lifecycle.beginStart())return false;
 try{worker=std::thread(&FrameReceiver::run,this);}catch(...){lifecycle.finished();lifecycle.reaped();return false;}
 if(lifecycle.waitStarted(std::chrono::seconds(2)))return true;
 stop();return false;
}
void FrameReceiver::run() {
 struct Finished {WorkerLifecycle& lifecycle;~Finished(){lifecycle.finished();}} finished{lifecycle};
 wchar_t temp[MAX_PATH]{};GetTempPathW(MAX_PATH,temp);
 wchar_t configured[32768]{};DWORD length=GetEnvironmentVariableW(L"LUX_HOST_LOG",configured,32768);
 std::ofstream log(length>0&&length<32768?std::wstring(configured):std::wstring(temp)+L"LuxTracer-tr02-host.jsonl",std::ios::app);
 HWND window=nullptr;HDC dc=nullptr;HGLRC shared=nullptr;bool currentContext=false;
 std::wstring windowClass;ATOM classAtom=0;
 HANDLE mapping=nullptr;SharedRing* ring=nullptr;
 ComPtr<ID3D11Device1> device;ComPtr<ID3D11DeviceContext> context;
 struct Import {ComPtr<ID3D11Texture2D> texture,local;ComPtr<ID3D11Query> query;GLuint gl=0;HANDLE object=nullptr;GLsync fence=nullptr;FrameKey key{};ImportOwnership ownership;};
 std::array<Import,3> imports;
 HANDLE interop=nullptr;GLuint readFbo=0,drawFbo=0;
 OpenDevice open=nullptr;CloseDevice close=nullptr;RegisterObject reg=nullptr;
 UnregisterObject unreg=nullptr;LockObjects lock=nullptr,unlock=nullptr;
 auto pollCopy=[&](Import& item){BOOL done=FALSE;auto result=context->GetData(item.query.Get(),&done,sizeof(done),D3D11_ASYNC_GETDATA_DONOTFLUSH);if(FAILED(result))return Completion::Failed;return result==S_OK&&done?Completion::Complete:Completion::Pending;};
 // This adapter is the only release path, including exceptions at partial init,
 // after CopyResource, after NV lock, and after GL submission.
 struct CleanupOps {
  Import& item;SharedRing* ring;ID3D11DeviceContext* context;HANDLE interop;LockObjects unlockFn;UnregisterObject unregisterFn;
  Completion pollCopy(){BOOL done=FALSE;auto result=context->GetData(item.query.Get(),&done,sizeof(done),D3D11_ASYNC_GETDATA_DONOTFLUSH);if(FAILED(result))return Completion::Failed;return result==S_OK&&done?Completion::Complete:Completion::Pending;}
  Completion pollGl(){return glCompletion(item.fence);}
  bool retire(){return ring&&lux::retire(*ring,item.key);}
  void endAdmission(){endRead(*ring);}
  bool unlock(){return unlockFn&&unlockFn(interop,1,&item.object)!=FALSE;}
  bool unregister(){if(!unregisterFn||!unregisterFn(interop,item.object))return false;item.object=nullptr;return true;}
  void release(){if(item.fence){glDeleteSync(item.fence);item.fence=nullptr;}if(item.gl){glDeleteTextures(1,&item.gl);item.gl=0;}item.query.Reset();item.local.Reset();item.texture.Reset();}
 };
 auto cleanImport=[&](Import& item){CleanupOps ops{item,ring,context.Get(),interop,unlock,unreg};return item.ownership.cleanup(ops);};
 auto drainImports=[&]{
  const auto deadline=std::chrono::steady_clock::now()+std::chrono::seconds(2);bool reported=false;
  for(auto& item:imports){
   for(;;){
    const auto result=cleanImport(item);if(result==Completion::Complete)break;
    if(!reported&&(result==Completion::Failed||std::chrono::steady_clock::now()>=deadline)){log<<"{\"kind\":\"bounded-unload-unsupported\",\"reason\":\"GPU ownership completion unavailable; resources retained\"}"<<std::endl;unsupportedUnload();reported=true;}
    // A failed fence/query/unlock does not prove completion. Quarantine in the
    // owning worker instead of destructing COM resources or unloading its code.
    if(result==Completion::Failed){for(;;)std::this_thread::sleep_for(std::chrono::seconds(1));}
    std::this_thread::sleep_for(std::chrono::milliseconds(1));
   }
  }
 };
 auto detach=[&]{drainImports();if(ring){UnmapViewOfFile(ring);ring=nullptr;}if(mapping){CloseHandle(mapping);mapping=nullptr;}};
 try {
  // The worker creates, uses and destroys its own drawable/DC. The host's DC is
  // consulted only in start for its pixel format; it is never made current here.
  windowClass=L"LuxTR02Drawable-"+std::to_wstring(GetCurrentThreadId())+L"-"+std::to_wstring(reinterpret_cast<uintptr_t>(this));
  WNDCLASSW wc{};wc.style=CS_OWNDC;wc.lpfnWndProc=DefWindowProcW;wc.hInstance=GetModuleHandleW(nullptr);wc.lpszClassName=windowClass.c_str();
  classAtom=RegisterClassW(&wc);require(classAtom!=0,"worker drawable class failed");
  window=CreateWindowExW(0,windowClass.c_str(),L"Lux TR02 receiver drawable",WS_POPUP,0,0,1,1,nullptr,nullptr,wc.hInstance,nullptr);
  require(window!=nullptr,"worker drawable creation failed");dc=GetDC(window);require(dc!=nullptr,"worker DC failed");
  require(SetPixelFormat(dc,pixelFormat,&pixelDescriptor)!=FALSE,"worker matching pixel format failed");
  const int attributes[]={0x2091,4,0x2092,1,0};shared=createContext(dc,hostContext,attributes);
  require(shared&&wglMakeCurrent(dc,shared),"worker shared GL context failed");currentContext=true;
  open=extension<OpenDevice>("wglDXOpenDeviceNV");close=extension<CloseDevice>("wglDXCloseDeviceNV");
  reg=extension<RegisterObject>("wglDXRegisterObjectNV");unreg=extension<UnregisterObject>("wglDXUnregisterObjectNV");
  lock=extension<LockObjects>("wglDXLockObjectsNV");unlock=extension<LockObjects>("wglDXUnlockObjectsNV");
  require(open&&close&&reg&&unreg&&lock&&unlock,"NV interop extension unavailable");
  log<<"{\"kind\":\"context\",\"ownedDrawable\":true,\"sharedContext\":true,\"nvInterop\":true,\"pid\":"<<GetCurrentProcessId()<<",\"renderer\":\""<<glGetString(GL_RENDERER)<<"\"}"<<std::endl;
  ComPtr<IDXGIFactory1> factory;require(SUCCEEDED(CreateDXGIFactory1(IID_PPV_ARGS(&factory))),"DXGI factory");
  ComPtr<IDXGIAdapter1> adapter;DXGI_ADAPTER_DESC1 description{};
  for(UINT i=0;factory->EnumAdapters1(i,&adapter)!=DXGI_ERROR_NOT_FOUND;++i){adapter->GetDesc1(&description);if(description.VendorId==0x10de)break;adapter.Reset();}
  require(bool(adapter),"NVIDIA adapter missing");ComPtr<ID3D11Device> base;
  require(SUCCEEDED(D3D11CreateDevice(adapter.Get(),D3D_DRIVER_TYPE_UNKNOWN,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,&base,nullptr,&context)),"D3D device");
  require(SUCCEEDED(base.As(&device)),"D3D11.1");interop=open(device.Get());require(interop!=nullptr,"wglDXOpenDeviceNV failed: adapter/context compatibility unproved");
  log<<"{\"kind\":\"adapter\",\"luidLow\":"<<description.AdapterLuid.LowPart<<",\"luidHigh\":"<<description.AdapterLuid.HighPart<<"}"<<std::endl;
  glGenFramebuffers(1,&readFbo);glGenFramebuffers(1,&drawFbo);require(readFbo&&drawFbo,"worker framebuffer allocation failed");
  std::wstring connected;uint64_t ticks=0;int pending=-1,sourceSlot=-1;
  lifecycle.started();
  while(!lifecycle.stopRequested()) {
   if(pending>=0){
    auto& imported=imports[sourceSlot];const auto status=glCompletion(imported.fence);require(status!=Completion::Failed,"worker fence failed");
    if(status==Completion::Complete){imported.ownership.glPending=false;glDeleteSync(imported.fence);imported.fence=nullptr;require(unlock(interop,1,&imported.object)!=FALSE,"NV unlock failed");imported.ownership.locked=false;outputs[pending].state.store(Ready);pending=-1;sourceSlot=-1;}
   }
   if(ticks%500==0&&pending<0){
    std::wifstream file(rendezvousPath());std::wstring name;std::getline(file,name);
    if(!name.empty()&&name!=connected&&name.rfind(L"Local\\LuxTracerTR02-",0)==0){
     detach();mapping=OpenFileMappingW(FILE_MAP_ALL_ACCESS,FALSE,name.c_str());
     if(mapping)ring=static_cast<SharedRing*>(MapViewOfFile(mapping,FILE_MAP_ALL_ACCESS,0,0,sizeof(SharedRing)));
     if(ring){require(ring->version==RingVersion,"ring version mismatch");require(ring->adapter.LowPart==description.AdapterLuid.LowPart&&ring->adapter.HighPart==description.AdapterLuid.HighPart,"adapter LUID mismatch");connected=name;log<<"{\"kind\":\"attached\",\"producerPid\":"<<ring->pid<<",\"generation\":"<<ring->generation<<"}"<<std::endl;}
    }
    log<<"{\"kind\":\"counters\",\"callbacks\":"<<callbacks.load()<<",\"consumed\":"<<consumed.load()<<"}"<<std::endl;
   }
   if(ring){float value=intensity.load();LONG bits;memcpy(&bits,&value,sizeof(bits));InterlockedExchange(&ring->controlBits,bits);}
   if(ring&&pending<0){
    int outputIndex=-1;for(int i=0;i<3;++i){int expected=Free;if(outputs[i].state.compare_exchange_strong(expected,Writing)){outputIndex=i;break;}}
    if(outputIndex>=0){
     if(!beginRead(*ring)){outputs[outputIndex].state.store(Free);++ticks;std::this_thread::sleep_for(std::chrono::milliseconds(1));continue;}
     int newest=-1;uint64_t frame=0;
     for(int i=0;i<3;++i)if(InterlockedCompareExchange(&ring->slots[i].state,Ready,Ready)==Ready&&ring->slots[i].frame>frame){newest=i;frame=ring->slots[i].frame;}
     if(newest<0||!transition(ring->slots[newest],Ready,Reading)){endRead(*ring);outputs[outputIndex].state.store(Free);}
     else {
      auto& source=ring->slots[newest];auto& imported=imports[newest];auto& output=outputs[outputIndex];
      imported.ownership.admission=true;imported.ownership.lease=true;imported.key={ring->generation,ring->outputGeneration,source.frame,uint32_t(newest)};
      const auto width=source.width,height=source.height;
      if(!imported.object){
       require(SUCCEEDED(device->OpenSharedResourceByName(source.textureName,DXGI_SHARED_RESOURCE_READ|DXGI_SHARED_RESOURCE_WRITE,IID_PPV_ARGS(&imported.texture))),"open owned named NT texture");
       D3D11_TEXTURE2D_DESC desc;imported.texture->GetDesc(&desc);require(desc.Width==width&&desc.Height==height&&desc.Format==source.format,"descriptor mismatch");
       desc.MiscFlags=0;desc.BindFlags=D3D11_BIND_SHADER_RESOURCE|D3D11_BIND_RENDER_TARGET;
       require(SUCCEEDED(device->CreateTexture2D(&desc,nullptr,&imported.local)),"local interop texture creation");
       D3D11_QUERY_DESC queryDesc{D3D11_QUERY_EVENT,0};require(SUCCEEDED(device->CreateQuery(&queryDesc,&imported.query)),"local copy query");
       glGenTextures(1,&imported.gl);require(imported.gl!=0,"interop GL texture allocation");glBindTexture(GL_TEXTURE_2D,imported.gl);
       imported.object=reg(interop,imported.local.Get(),imported.gl,GL_TEXTURE_2D,0x0000);require(imported.object!=nullptr,"NV registration failed");imported.ownership.registered=true;
      }
      if(!output.texture){glGenTextures(1,&output.texture);require(output.texture!=0,"output texture allocation");}
      if(output.width!=width||output.height!=height){glBindTexture(GL_TEXTURE_2D,output.texture);glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,width,height,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MIN_FILTER,GL_NEAREST);glTexParameteri(GL_TEXTURE_2D,GL_TEXTURE_MAG_FILTER,GL_NEAREST);output.width=width;output.height=height;}
      imported.ownership.copyPending=true;
      context->CopyResource(imported.local.Get(),imported.texture.Get());context->End(imported.query.Get());context->Flush();
      const auto deadline=std::chrono::steady_clock::now()+std::chrono::seconds(2);
      for(;;){auto result=pollCopy(imported);require(result!=Completion::Failed,"local D3D copy query failure");if(result==Completion::Complete)break;require(!lifecycle.stopRequested()&&std::chrono::steady_clock::now()<deadline,"local D3D copy deadline");std::this_thread::sleep_for(std::chrono::milliseconds(1));}
      imported.ownership.copyPending=false;require(retire(*ring,imported.key),"source retirement key mismatch");imported.ownership.lease=false;endRead(*ring);imported.ownership.admission=false;
      // Driver synchronization stays on the worker; it is not assumed bounded.
      require(lock(interop,1,&imported.object)!=FALSE,"NV lock failed");imported.ownership.locked=true;
      glBindFramebuffer(GL_READ_FRAMEBUFFER,readFbo);glFramebufferTexture2D(GL_READ_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,imported.gl,0);
      glBindFramebuffer(GL_DRAW_FRAMEBUFFER,drawFbo);glFramebufferTexture2D(GL_DRAW_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,output.texture,0);
      require(glCheckFramebufferStatus(GL_READ_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE&&glCheckFramebufferStatus(GL_DRAW_FRAMEBUFFER)==GL_FRAMEBUFFER_COMPLETE,"copy FBO incomplete");
      imported.ownership.glPending=true;glBlitFramebuffer(0,0,width,height,0,0,width,height,GL_COLOR_BUFFER_BIT,GL_NEAREST);
      output.frame=imported.key.frame;output.generation=imported.key.generation;imported.fence=glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE,0);require(imported.fence!=nullptr,"worker fence allocation failed");glFlush();pending=outputIndex;sourceSlot=newest;
     }
    }
   }
   ++ticks;std::this_thread::sleep_for(std::chrono::milliseconds(1));
  }
 }catch(const std::exception& error){log<<"{\"kind\":\"failure\",\"reason\":\""<<error.what()<<"\"}"<<std::endl;}
 catch(...){log<<"{\"kind\":\"failure\",\"reason\":\"unknown worker exception\"}"<<std::endl;}
 detach(); // always before closing interop or releasing its D3D device
 if(interop&&!close(interop)){unsupportedUnload();for(;;)std::this_thread::sleep_for(std::chrono::seconds(1));}
 if(readFbo)glDeleteFramebuffers(1,&readFbo);if(drawFbo)glDeleteFramebuffers(1,&drawFbo);
 context.Reset();device.Reset();
 if(currentContext&&!wglMakeCurrent(nullptr,nullptr)){unsupportedUnload();for(;;)std::this_thread::sleep_for(std::chrono::seconds(1));}
 if(shared&&!wglDeleteContext(shared)){unsupportedUnload();for(;;)std::this_thread::sleep_for(std::chrono::seconds(1));}
 if(dc)ReleaseDC(window,dc);if(window)DestroyWindow(window);
 if(classAtom)UnregisterClassW(windowClass.c_str(),GetModuleHandleW(nullptr));
}
GLuint FrameReceiver::acquireLatest() {
 ++callbacks;
 for(int i=0;i<3;++i)if(i!=current&&outputs[i].state.load()==Reading&&outputs[i].fence){if(glCompletion(outputs[i].fence)==Completion::Complete){glDeleteSync(outputs[i].fence);outputs[i].fence=nullptr;outputs[i].state.store(Free);}}
 int newest=-1;uint64_t frame=lastFrame,generation=lastGeneration;
 for(int i=0;i<3;++i)if(outputs[i].state.load()==Ready&&(outputs[i].generation>generation||(outputs[i].generation==generation&&outputs[i].frame>frame))){newest=i;frame=outputs[i].frame;generation=outputs[i].generation;}
 if(newest>=0){int expected=Ready;if(outputs[newest].state.compare_exchange_strong(expected,Reading)){current=newest;lastFrame=frame;lastGeneration=generation;++consumed;}}
 for(int i=0;i<3;++i)if(i!=current&&outputs[i].state.load()==Ready&&(outputs[i].generation<lastGeneration||(outputs[i].generation==lastGeneration&&outputs[i].frame<lastFrame))){int expected=Ready;outputs[i].state.compare_exchange_strong(expected,Free);}
 return current>=0?outputs[current].texture:0;
}
void FrameReceiver::afterDraw(){if(current>=0){auto& output=outputs[current];if(output.fence)glDeleteSync(output.fence);output.fence=glFenceSync(GL_SYNC_GPU_COMMANDS_COMPLETE,0);output.unfenced=!output.fence;glFlush();}}
void FrameReceiver::stop(){
 lifecycle.requestStop();
 if(worker.joinable()){
  if(!lifecycle.waitFinished(std::chrono::seconds(2)))unsupportedUnload();
  // Do not detach/terminate or return to the SDK's unconditional delete while
  // this thread owns code/resources. The assessment is bounded; unload is not.
  worker.join();lifecycle.reaped();
 }
 const auto deadline=std::chrono::steady_clock::now()+std::chrono::seconds(2);bool reported=false;
 for(auto& output:outputs){
  while(output.unfenced||(output.fence&&glCompletion(output.fence)!=Completion::Complete)){
   if(!reported&&std::chrono::steady_clock::now()>=deadline){unsupportedUnload();reported=true;}
   std::this_thread::sleep_for(std::chrono::milliseconds(1));
  }
  if(output.fence)glDeleteSync(output.fence);if(output.texture)glDeleteTextures(1,&output.texture);
  output.fence=nullptr;output.texture=0;output.unfenced=false;output.width=output.height=0;output.frame=output.generation=0;output.state.store(Free);
 }
 hostContext=nullptr;current=-1;lastFrame=lastGeneration=0;callbacks=0;consumed=0;
}
}

