#pragma once
#include "FFGLSDK.h"
#include "shared_ring.h"
#include "ReceiverLifecycle.h"
#include <atomic>
#include <thread>
#include <array>
namespace lux {
class FrameReceiver {
 public:
  ~FrameReceiver();
  // Host lifecycle calls are serialized with ProcessOpenGL by the FFGL host.
  bool start(HDC dc,HGLRC host);
  // May retain/wait indefinitely if a driver never completes. No safe bounded
  // in-process unload exists; FFGL SDK deletes this object after DeInitGL.
  void stop();
  GLuint acquireLatest();
  void afterDraw();
  void setIntensity(float value){intensity=value;}
  uint64_t frame()const{return lastFrame;}
  std::atomic<uint64_t> callbacks{0},consumed{0};
 private:
  struct Output {std::atomic<int> state{Free};GLuint texture=0;GLsync fence=nullptr;bool unfenced=false;uint32_t width=0,height=0;uint64_t frame=0,generation=0;};
  std::array<Output,3> outputs;
  std::atomic<float> intensity{0.65f};
  WorkerLifecycle lifecycle;
  using CreateContext=HGLRC(WINAPI*)(HDC,HGLRC,const int*);
  CreateContext createContext=nullptr;HGLRC hostContext=nullptr;
  PIXELFORMATDESCRIPTOR pixelDescriptor{};int pixelFormat=0;
  std::string hostDiagnostic;
  std::thread worker;int current=-1;uint64_t lastFrame=0,lastGeneration=0;
  void run();
};
}
