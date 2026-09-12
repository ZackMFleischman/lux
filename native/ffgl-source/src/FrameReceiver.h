#pragma once
#include "FFGLSDK.h"
#include "shared_ring.h"
#include <atomic>
#include <thread>
#include <array>
namespace lux {
class FrameReceiver {
 public:
  bool start(HDC dc,HGLRC host);
  void stop();
  GLuint acquireLatest();
  void afterDraw();
  void setIntensity(float value){intensity=value;}
  uint64_t frame()const{return lastFrame;}
  std::atomic<uint64_t> callbacks{0},consumed{0};
 private:
  struct Output {std::atomic<int> state{Free};GLuint texture=0;GLsync fence=nullptr;uint64_t frame=0,generation=0;};
  std::array<Output,3> outputs;
  std::atomic<bool> stopping{false};std::atomic<float> intensity{0.65f};
  std::thread worker;HDC dc=nullptr;HGLRC shared=nullptr;int current=-1;uint64_t lastFrame=0,lastGeneration=0;
  void run();
};
}

