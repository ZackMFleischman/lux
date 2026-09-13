#pragma once
#include "FFGLSDK.h"
#include "shared_ring.h"
#include "ReceiverLifecycle.h"
#include "InstalledActivation.h"
#include <atomic>
#include <thread>
#include <array>
namespace lux {
class FrameReceiver {
 public:
  ~FrameReceiver();
  // Host lifecycle calls are serialized with ProcessOpenGL by the FFGL host.
  bool start(HDC dc,HGLRC host);
  void configureInstalled(std::optional<InstalledSource> source){
   controlSchema=LegacyControlSchema;controlCount=1;std::array<float,32> values{};values[0]=source?0.5f:0.65f;
   if(source&&source->version==2){std::copy_n(source->schemaHash.data(),64,controlSchema.begin());controlCount=static_cast<uint32_t>(source->controls.size());for(size_t i=0;i<source->controls.size();++i)values[i]=source->controls[i].initial;}
   uint64_t seq;tryPublishHostControlsV4(desired,controlSchema,std::span<const float>(values.data(),controlCount),seq);
   for(size_t i=0;i<controlCount;++i)parameterValues[i]=values[i];
   activation.configure(std::move(source));
  }
  // May retain/wait indefinitely if a driver never completes. No safe bounded
  // in-process unload exists; FFGL SDK deletes this object after DeInitGL.
  void stop();
  GLuint acquireLatest();
  void afterDraw();
  bool setParameter(uint32_t index,float value){uint64_t seq;auto status=tryUpdateHostControlV4(desired,controlSchema,controlCount,index,value,seq);if(status!=HostControlStatusV4::Ok)return false;parameterValues[index]=value;return true;}
  float parameter(uint32_t index)const{return index<controlCount?parameterValues[index].load():0.0f;}
  uint64_t frame()const{return lastFrame;}
  std::atomic<uint64_t> callbacks{0},consumed{0};
 private:
  struct Output {std::atomic<int> state{Free};GLuint texture=0;GLsync fence=nullptr;bool unfenced=false;uint32_t width=0,height=0;uint64_t frame=0,generation=0;};
  std::array<Output,3> outputs;
  HostControlsV4 desired;ControlSchemaHashV4 controlSchema=LegacyControlSchema;uint32_t controlCount=1;
  std::array<std::atomic<float>,32> parameterValues{};
  WorkerLifecycle lifecycle;
  InstalledActivation activation;
  using CreateContext=HGLRC(WINAPI*)(HDC,HGLRC,const int*);
  CreateContext createContext=nullptr;HGLRC hostContext=nullptr;
  PIXELFORMATDESCRIPTOR pixelDescriptor{};int pixelFormat=0;
  std::string hostDiagnostic;
  std::thread worker;int current=-1;uint64_t lastFrame=0,lastGeneration=0;
  void run(HGLRC shared);
};
}
