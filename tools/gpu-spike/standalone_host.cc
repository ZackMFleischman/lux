#include <windows.h>
#include "ffgl/FFGL.h"
#include "glsdk_0_5_2/glload/include/gl_load.h"
#include <iostream>
#include <fstream>
#include <vector>
#include <chrono>
#include <thread>
#include <cstdlib>
#include <cstring>
#include <string>
#include <filesystem>
#include "standalone_alpha.h"
#include "pixel-marker.h"
extern "C" __declspec(dllexport) DWORD NvOptimusEnablement=1;
int main(int argc,char** argv) {
  // Refuse unsupervised launches before creating a window or touching the driver.
  const char* runId=std::getenv("LUX_EXPERIMENT_RUN_ID");
  const char* mode=std::getenv("LUX_EXPERIMENT_MODE");
  if(!runId||!*runId||!mode||std::strcmp(mode,"hardware")!=0){std::cerr<<"Reviewed experiment supervisor required\n";return 2;}
  const char* durationText=std::getenv("LUX_STANDALONE_DURATION_MS");
  char* end=nullptr;
  const long duration=durationText?std::strtol(durationText,&end,10):10000;
  if(duration<1000||duration>30000||(durationText&&(!end||*end))){std::cerr<<"Invalid standalone duration\n";return 2;}
  const char* alphaText=std::getenv("LUX_STANDALONE_ALPHA_CONTROL");
  const bool alpha=alphaText&&std::strcmp(alphaText,"1")==0;
  if(alphaText&&!alpha){std::cerr<<"Invalid alpha probe option\n";return 2;}
  const char* hangText=std::getenv("LUX_STANDALONE_HANG_CONTROL");
  const bool hang=hangText&&std::strcmp(hangText,"1")==0;
  if((hangText&&!hang)||(hang&&alpha)){std::cerr<<"Invalid hang probe option\n";return 2;}
  const char* recoveryText=std::getenv("LUX_STANDALONE_RECOVERY_CONTROL");
  const bool recovery=recoveryText&&std::strcmp(recoveryText,"1")==0;
  if((recoveryText&&!recovery)||(recovery&&!hang)){std::cerr<<"Recovery probe requires hang mode\n";return 2;}
  const char* pixelText=std::getenv("LUX_STANDALONE_PIXEL_CONTROL");
  const bool pixelProbe=pixelText&&std::strcmp(pixelText,"1")==0;
  if((pixelText&&!pixelProbe)||(pixelProbe&&(alpha||hang||recovery))){std::cerr<<"Invalid pixel probe mode\n";return 2;}
  const long probeWorkLimit=(recovery||pixelProbe)?15000:10000;
  std::string hangMarker;
  LARGE_INTEGER frequency{};QueryPerformanceFrequency(&frequency);
  if(alpha||hang||pixelProbe){
    const char* outerText=std::getenv("LUX_EXPERIMENT_TIMEOUT_MS");char* outerEnd=nullptr;
    const long outer=outerText?std::strtol(outerText,&outerEnd,10):0;
    if(duration>probeWorkLimit||outer<1000||outer>30000||!outerEnd||*outerEnd||std::strlen(runId)>128||std::strspn(runId,"0123456789abcdefABCDEF-")!=std::strlen(runId)){
      std::cerr<<"Probe exceeds work limit (recovery 15 s; alpha/hang 10 s), 30 s supervised budget, or safe run identity\n";return 2;
    }
  }
  if(hang){
    const char* directory=std::getenv("LUX_EXPERIMENT_DIRECTORY");
    const std::filesystem::path folder=directory?directory:"";
    if(!folder.is_absolute()||folder.filename().string()!=runId||frequency.QuadPart<=0){std::cerr<<"Invalid hang experiment directory/clock\n";return 2;}
    for(auto cursor=folder;;cursor=cursor.parent_path()){
      const auto attributes=GetFileAttributesW(cursor.c_str());
      if(attributes==INVALID_FILE_ATTRIBUTES||!(attributes&FILE_ATTRIBUTE_DIRECTORY)||(attributes&FILE_ATTRIBUTE_REPARSE_POINT)){std::cerr<<"Redirected/missing hang experiment directory\n";return 2;}
      if(cursor==cursor.parent_path())break;
    }
    hangMarker=(folder/"installed-hang-entered.json").string();
    if(GetFileAttributesA(hangMarker.c_str())!=INVALID_FILE_ATTRIBUTES){std::cerr<<"Hang marker already exists\n";return 2;}
  }
  if(argc==2&&std::strcmp(argv[1],"--validate-options")==0){std::cout<<"options valid, no graphics initialized\n";return 0;}
  if(argc<2){std::cerr<<"DLL path required\n";return 2;}
  const std::string capturePath=argc>2?argv[2]:"standalone.rgba",probePath=capturePath+(pixelProbe?".pixels.json":hang?".hang.json":".alpha.json");
  if((alpha||hang||pixelProbe)&&(argc<3||GetFileAttributesA(capturePath.c_str())!=INVALID_FILE_ATTRIBUTES||GetFileAttributesA(probePath.c_str())!=INVALID_FILE_ATTRIBUTES)){
    std::cerr<<"Alpha probe requires fresh explicit capture/evidence paths\n";return 2;
  }
  WNDCLASSW wc{};wc.style=CS_OWNDC;wc.lpfnWndProc=DefWindowProcW;wc.hInstance=GetModuleHandle(nullptr);wc.lpszClassName=L"LuxStandaloneGL";RegisterClassW(&wc);
  HWND window=CreateWindowW(wc.lpszClassName,L"Lux standalone diagnostic",WS_OVERLAPPEDWINDOW,0,0,1920,1080,nullptr,nullptr,wc.hInstance,nullptr);
  HDC dc=GetDC(window);PIXELFORMATDESCRIPTOR pfd{sizeof(pfd),1,PFD_DRAW_TO_WINDOW|PFD_SUPPORT_OPENGL|PFD_DOUBLEBUFFER,PFD_TYPE_RGBA,32};int format=ChoosePixelFormat(dc,&pfd);SetPixelFormat(dc,format,&pfd);
  HGLRC bootstrap=wglCreateContext(dc);wglMakeCurrent(dc,bootstrap);
  using Create=HGLRC(WINAPI*)(HDC,HGLRC,const int*);auto create=reinterpret_cast<Create>(wglGetProcAddress("wglCreateContextAttribsARB"));int attributes[]={0x2091,4,0x2092,1,0};HGLRC context=create(dc,nullptr,attributes);wglMakeCurrent(nullptr,nullptr);wglDeleteContext(bootstrap);wglMakeCurrent(dc,context);ogl_LoadFunctions();
  std::cout<<"GL "<<glGetString(GL_RENDERER)<<"\n";
  HMODULE dll=LoadLibraryA(argv[1]);if(!dll){std::cerr<<"LoadLibrary "<<GetLastError();return 3;}
  auto main=reinterpret_cast<FFMixed(__stdcall*)(FFUInt32,FFMixed,FFInstanceID)>(GetProcAddress(dll,"plugMain"));
  if(!main){std::cerr<<"plugMain missing\n";return 3;}
  FFMixed value{};if(main(FF_INITIALISE_V2,value,nullptr).UIntValue!=FF_SUCCESS)return 4;
  FFGLViewportStruct viewport{0,0,1920,1080};value.PointerValue=&viewport;void* instance=main(FF_INSTANTIATE_GL,value,nullptr).PointerValue;if(!instance||instance==reinterpret_cast<void*>(FF_FAIL))return 5;
  GLuint texture,fbo;glGenTextures(1,&texture);glBindTexture(GL_TEXTURE_2D,texture);glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,1920,1080,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);glGenFramebuffers(1,&fbo);glBindFramebuffer(GL_FRAMEBUFFER,fbo);glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,texture,0);glViewport(0,0,1920,1080);
  ProcessOpenGLStruct process{0,nullptr,fbo};uint64_t count=0;auto start=std::chrono::steady_clock::now();
  auto elapsed=[&](){return std::chrono::duration_cast<std::chrono::milliseconds>(std::chrono::steady_clock::now()-start).count();};
  int result=0;bool whiteSeen=false,setAccepted=false,transparentSeen=false;
  bool hangReady=false,armAccepted=false,disarmSubmitted=false;
  uint64_t readyAt=0,triggerAt=0,disarmAt=0,callbacksAfterMarker=0;
  bool recovered=false;uint64_t recoveredAt=0;float currentNormalizedValue=-1;
  unsigned char initialRGBA[4]{},recoveredRGBA[4]{};
  struct PixelSample{uint64_t sequence,before,after,readStart,readEnd;lux::probe::MarkerPixels rgba;};
  struct PixelControl{unsigned step;uint64_t due,before,after;bool accepted;};
  std::vector<PixelSample> pixelSamples;std::vector<PixelControl> pixelControls;
  if(pixelProbe){pixelSamples.reserve(1024);pixelControls.reserve(8);}
  bool pixelReady=false,pixelComplete=false;uint64_t pixelSchedule=0,pixelLost=0;
  auto qpc=[](){LARGE_INTEGER at{};QueryPerformanceCounter(&at);return uint64_t(at.QuadPart);};
  auto setArm=[&](float normalized){SetParameterStruct parameter{};parameter.ParameterNumber=0;
    std::memcpy(&parameter.NewParameterValue.UIntValue,&normalized,sizeof(normalized));FFMixed input{};input.PointerValue=&parameter;
    return main(FF_SET_PARAMETER,input,instance).UIntValue==FF_SUCCESS;};
  lux::probe::Quartet whitePixels{};
  auto bindRead=[&](){glBindFramebuffer(GL_FRAMEBUFFER,fbo);glReadBuffer(GL_COLOR_ATTACHMENT0);};
  auto quarters=[&](){lux::probe::Quartet samples{};bindRead();unsigned row=0;for(int y:{270,810})for(int x:{480,1440})glReadPixels(x,1079-y,1,1,GL_RGBA,GL_UNSIGNED_BYTE,samples[row++].data());return samples;};
  if(alpha||hang||pixelProbe){glDisable(GL_BLEND);glDisable(GL_FRAMEBUFFER_SRGB);bindRead();if(glCheckFramebufferStatus(GL_FRAMEBUFFER)!=GL_FRAMEBUFFER_COMPLETE||glGetError()!=GL_NO_ERROR)result=9;}
  while(!result&&elapsed()<((hang||pixelProbe)?duration-25:duration)) {
    if(alpha||hang||pixelProbe){glDisable(GL_BLEND);glDisable(GL_FRAMEBUFFER_SRGB);glBindFramebuffer(GL_FRAMEBUFFER,fbo);}
    const auto callbackBefore=pixelProbe?qpc():0;
    value.PointerValue=&process;if(main(FF_PROCESS_OPENGL,value,instance).UIntValue!=FF_SUCCESS){result=6;break;}++count;
    if(pixelProbe){
      PixelSample sample{};sample.sequence=count;sample.before=callbackBefore;sample.after=qpc();
      if(pixelSamples.size()==1024){++pixelLost;result=13;break;}
      std::array<unsigned char,1920*4> strip{};bindRead();sample.readStart=qpc();glReadPixels(0,540,1920,1,GL_RGBA,GL_UNSIGNED_BYTE,strip.data());sample.readEnd=qpc();
      if(glGetError()!=GL_NO_ERROR){result=9;break;}
      for(unsigned i=0;i<32;++i)std::memcpy(sample.rgba[i].data(),strip.data()+(i*60+30)*4,4);
      pixelSamples.push_back(sample);lux::probe::PixelMarker marker;
      const bool decoded=lux::probe::decodeMarker(sample.rgba,marker);
      if(!pixelReady&&decoded){if(marker.step!=0){result=13;break;}pixelReady=true;pixelSchedule=qpc();}
      if(pixelReady&&pixelControls.size()<8){const auto due=pixelSchedule+pixelControls.size()*uint64_t(frequency.QuadPart)/2;
        if(qpc()>=due){PixelControl control{};control.step=unsigned(pixelControls.size()+1);control.due=due;control.before=qpc();control.accepted=setArm(float(control.step)/8.0f);control.after=qpc();pixelControls.push_back(control);if(!control.accepted){result=13;break;}}
      }
      if(decoded&&marker.step==8&&pixelControls.size()==8){pixelComplete=true;break;}
    }
    if(hang){
      if(disarmSubmitted)++callbacksAfterMarker;
      if(!hangReady){
        unsigned char pixel[4]{};bindRead();glReadPixels(960,540,1,1,GL_RGBA,GL_UNSIGNED_BYTE,pixel);
        if(glGetError()!=GL_NO_ERROR){result=9;break;}
        if(pixel[0]>=250&&pixel[1]<=5&&pixel[2]>=250&&pixel[3]>=250){
          std::memcpy(initialRGBA,pixel,4);
          hangReady=true;readyAt=qpc();
          if(elapsed()>6500){result=12;break;}
          triggerAt=qpc();armAccepted=setArm(1.0f);if(!armAccepted){result=12;break;}
        }
      }else if(armAccepted&&!disarmSubmitted&&GetFileAttributesA(hangMarker.c_str())!=INVALID_FILE_ATTRIBUTES){
        // This is only a host control submission. The blocked worker cannot acknowledge it.
        disarmAt=qpc();disarmSubmitted=setArm(0.0f);if(!disarmSubmitted){result=12;break;}
      }
      if(recovery&&disarmSubmitted&&callbacksAfterMarker){
        unsigned char pixel[4]{};bindRead();glReadPixels(960,540,1,1,GL_RGBA,GL_UNSIGNED_BYTE,pixel);
        if(glGetError()!=GL_NO_ERROR){result=9;break;}
        if(pixel[0]<=5&&pixel[1]>=250&&pixel[2]>=250&&pixel[3]>=250){
          recoveredAt=qpc();std::memcpy(recoveredRGBA,pixel,4);
          FFMixed index{};index.UIntValue=0;const auto hostValue=main(FF_GET_PARAMETER,index,instance);
          std::memcpy(&currentNormalizedValue,&hostValue.UIntValue,sizeof(currentNormalizedValue));
          // This getter confirms the host value, not a worker acknowledgement.
          if(currentNormalizedValue!=0.0f){result=12;break;}
          recovered=true;break;
        }
      }
    }
    if(alpha){
      const auto samples=quarters();if(glGetError()!=GL_NO_ERROR){result=9;break;}
      if(!whiteSeen&&lux::probe::matches(samples,lux::probe::white)){whiteSeen=true;whitePixels=samples;std::cout<<"alpha white observed\n";}
      if(whiteSeen&&!setAccepted){
        SetParameterStruct parameter{};parameter.ParameterNumber=0;const float normalized=0.0f;
        static_assert(sizeof(normalized)==sizeof(parameter.NewParameterValue.UIntValue));
        std::memcpy(&parameter.NewParameterValue.UIntValue,&normalized,sizeof(normalized));
        FFMixed input{};input.PointerValue=&parameter;
        setAccepted=main(FF_SET_PARAMETER,input,instance).UIntValue==FF_SUCCESS;
        if(setAccepted)std::cout<<"alpha control accepted\n";
      }else if(setAccepted&&lux::probe::matches(samples,lux::probe::transparent)){transparentSeen=true;break;}
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(16));
  }
  if(alpha&&(!whiteSeen||!setAccepted||!transparentSeen)&&!result){std::cerr<<"Alpha control/pixel deadline exceeded\n";result=10;}
  if(hang&&(!hangReady||!armAccepted||!disarmSubmitted||!callbacksAfterMarker)&&!result){std::cerr<<"Hang readiness/marker/disarm deadline exceeded\n";result=12;}
  if(recovery&&!recovered&&!result){std::cerr<<"Recovered cyan image deadline exceeded\n";result=12;}
  if(pixelProbe&&(!pixelReady||!pixelComplete||pixelControls.size()!=8)&&!result){std::cerr<<"Pixel correlation deadline exceeded\n";result=13;}
  // One diagnostic capture only. Not transport or performance evidence.
  if(!result&&!hang&&!pixelProbe){
    std::vector<unsigned char> pixels(1920*1080*4);if(alpha)bindRead();glReadPixels(0,0,1920,1080,GL_RGBA,GL_UNSIGNED_BYTE,pixels.data());
    if(alpha&&glGetError()!=GL_NO_ERROR)result=9;
    if(alpha){lux::probe::Quartet samples{};unsigned row=0;for(int y:{270,810})for(int x:{480,1440})std::memcpy(samples[row++].data(),pixels.data()+((1079-y)*1920+x)*4,4);if(!lux::probe::matches(samples,lux::probe::transparent))result=10;}
    if(!result){std::ofstream file(capturePath,std::ios::binary);file.write(reinterpret_cast<char*>(pixels.data()),pixels.size());file.close();if(!file)result=11;}
    std::cout<<"callbacks "<<count<<" centerRGBA ";for(int i=0;i<4;++i)std::cout<<int(pixels[(540*1920+960)*4+i])<<" ";std::cout<<"\n";
  }
  const auto workElapsed=elapsed();if((alpha||hang||pixelProbe)&&workElapsed>probeWorkLimit&&!result)result=10;
  auto evidence=[&](bool deinstantiated,bool deinitialized){
    if(pixelProbe){
      std::ofstream file(probePath);file<<"{\"mode\":\"pixel-correlation-v1\",\"runId\":\""<<runId<<"\",\"hostPid\":"<<GetCurrentProcessId()<<",\"ok\":"<<(!result&&deinstantiated&&deinitialized?"true":"false")<<",\"deinstantiated\":"<<(deinstantiated?"true":"false")<<",\"deinitialized\":"<<(deinitialized?"true":"false")<<",\"elapsedMs\":"<<workElapsed<<",\"lostRecords\":"<<pixelLost<<",\"clock\":{\"domain\":\"qpc\",\"frequency\":\""<<frequency.QuadPart<<"\"},\"controls\":[";
      for(size_t i=0;i<pixelControls.size();++i){if(i)file<<',';const auto& c=pixelControls[i];file<<"{\"step\":"<<c.step<<",\"due\":\""<<c.due<<"\",\"before\":\""<<c.before<<"\",\"after\":\""<<c.after<<"\",\"accepted\":"<<(c.accepted?"true":"false")<<'}';}file<<"],\"samples\":[";
      for(size_t i=0;i<pixelSamples.size();++i){if(i)file<<',';const auto& s=pixelSamples[i];file<<"{\"sequence\":"<<s.sequence<<",\"before\":\""<<s.before<<"\",\"after\":\""<<s.after<<"\",\"readStart\":\""<<s.readStart<<"\",\"readEnd\":\""<<s.readEnd<<"\",\"rgba\":[";for(unsigned j=0;j<32;++j){if(j)file<<',';file<<'[';for(unsigned c=0;c<4;++c){if(c)file<<',';file<<unsigned(s.rgba[j][c]);}file<<']';}file<<"]}";}file<<"]}\n";file.close();if(!file&&!result)result=11;return;
    }
    if(hang){
      std::ofstream file(probePath);file<<"{\"runId\":\""<<runId<<"\",\"ok\":"<<(!result&&deinstantiated&&deinitialized?"true":"false")<<",\"hostPid\":"<<GetCurrentProcessId()<<",\"deinstantiated\":"<<(deinstantiated?"true":"false")<<",\"deinitialized\":"<<(deinitialized?"true":"false")<<",\"elapsedMs\":"<<workElapsed<<",\"ready\":"<<(hangReady?"true":"false")<<",\"armAccepted\":"<<(armAccepted?"true":"false")<<",\"disarmSubmitted\":"<<(disarmSubmitted?"true":"false")<<",\"callbacksAfterMarker\":"<<callbacksAfterMarker<<",\"clock\":{\"domain\":\"qpc\",\"frequency\":\""<<frequency.QuadPart<<"\"},\"readyAt\":\""<<readyAt<<"\",\"triggerAt\":\""<<triggerAt<<"\",\"disarmAt\":\""<<disarmAt<<"\",\"recoveryMode\":"<<(recovery?"true":"false")<<",\"recovered\":"<<(recovered?"true":"false")<<",\"recoveredAt\":\""<<recoveredAt<<"\",\"currentNormalizedValue\":"<<(recovered?0:-1)<<",\"initialRGBA\":[";
      for(unsigned c=0;c<4;++c){if(c)file<<',';file<<unsigned(initialRGBA[c]);}file<<"],\"recoveredRGBA\":[";
      for(unsigned c=0;c<4;++c){if(c)file<<',';file<<unsigned(recoveredRGBA[c]);}file<<"]}\n";
      file.close();if(!file&&!result)result=11;return;
    }
    if(!alpha)return;
    std::ofstream file(probePath);file<<"{\"runId\":\""<<runId<<"\",\"ok\":"<<(!result&&deinstantiated&&deinitialized?"true":"false")<<",\"deinstantiated\":"<<(deinstantiated?"true":"false")<<",\"deinitialized\":"<<(deinitialized?"true":"false")<<",\"parameterIndex\":0,\"normalizedValue\":0,\"elapsedMs\":"<<workElapsed<<",\"white\":[";
    for(unsigned row=0;row<4;++row){if(row)file<<',';file<<'[';for(unsigned c=0;c<4;++c){if(c)file<<',';file<<unsigned(whitePixels[row][c]);}file<<']';}file<<"]}\n";file.close();if(!file&&!result)result=11;
  };
  // Do not explicitly unload code/destroy its context after a failed teardown.
  // A blocked call remains subject to the outer process-job deadline.
  if(main(FF_DEINSTANTIATE_GL,{},instance).UIntValue!=FF_SUCCESS){std::cerr<<"FFGL deinstantiate failed\n";result=7;evidence(false,false);return result;}
  if(main(FF_DEINITIALISE,{},nullptr).UIntValue!=FF_SUCCESS){std::cerr<<"FFGL deinitialise failed\n";result=8;evidence(true,false);return result;}
  evidence(true,true);
  FreeLibrary(dll);glDeleteFramebuffers(1,&fbo);glDeleteTextures(1,&texture);wglMakeCurrent(nullptr,nullptr);wglDeleteContext(context);ReleaseDC(window,dc);DestroyWindow(window);return result;
}
