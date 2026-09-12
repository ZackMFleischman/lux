#include <windows.h>
#include "ffgl/FFGL.h"
#include "glsdk_0_5_2/glload/include/gl_load.h"
#include <iostream>
#include <fstream>
#include <vector>
#include <chrono>
#include <thread>
extern "C" __declspec(dllexport) DWORD NvOptimusEnablement=1;
int main(int argc,char** argv) {
  if(argc<2){std::cerr<<"DLL path required\n";return 2;}
  WNDCLASSW wc{};wc.style=CS_OWNDC;wc.lpfnWndProc=DefWindowProcW;wc.hInstance=GetModuleHandle(nullptr);wc.lpszClassName=L"LuxStandaloneGL";RegisterClassW(&wc);
  HWND window=CreateWindowW(wc.lpszClassName,L"Lux standalone diagnostic",WS_OVERLAPPEDWINDOW,0,0,1920,1080,nullptr,nullptr,wc.hInstance,nullptr);
  HDC dc=GetDC(window);PIXELFORMATDESCRIPTOR pfd{sizeof(pfd),1,PFD_DRAW_TO_WINDOW|PFD_SUPPORT_OPENGL|PFD_DOUBLEBUFFER,PFD_TYPE_RGBA,32};int format=ChoosePixelFormat(dc,&pfd);SetPixelFormat(dc,format,&pfd);
  HGLRC bootstrap=wglCreateContext(dc);wglMakeCurrent(dc,bootstrap);
  using Create=HGLRC(WINAPI*)(HDC,HGLRC,const int*);auto create=reinterpret_cast<Create>(wglGetProcAddress("wglCreateContextAttribsARB"));int attributes[]={0x2091,4,0x2092,1,0};HGLRC context=create(dc,nullptr,attributes);wglMakeCurrent(nullptr,nullptr);wglDeleteContext(bootstrap);wglMakeCurrent(dc,context);ogl_LoadFunctions();
  std::cout<<"GL "<<glGetString(GL_RENDERER)<<"\n";
  HMODULE dll=LoadLibraryA(argv[1]);if(!dll){std::cerr<<"LoadLibrary "<<GetLastError();return 3;}
  auto main=reinterpret_cast<FFMixed(__stdcall*)(FFUInt32,FFMixed,FFInstanceID)>(GetProcAddress(dll,"plugMain"));
  FFMixed value{};if(main(FF_INITIALISE_V2,value,nullptr).UIntValue!=FF_SUCCESS)return 4;
  FFGLViewportStruct viewport{0,0,1920,1080};value.PointerValue=&viewport;void* instance=main(FF_INSTANTIATE_GL,value,nullptr).PointerValue;if(!instance||instance==reinterpret_cast<void*>(FF_FAIL))return 5;
  GLuint texture,fbo;glGenTextures(1,&texture);glBindTexture(GL_TEXTURE_2D,texture);glTexImage2D(GL_TEXTURE_2D,0,GL_RGBA8,1920,1080,0,GL_RGBA,GL_UNSIGNED_BYTE,nullptr);glGenFramebuffers(1,&fbo);glBindFramebuffer(GL_FRAMEBUFFER,fbo);glFramebufferTexture2D(GL_FRAMEBUFFER,GL_COLOR_ATTACHMENT0,GL_TEXTURE_2D,texture,0);glViewport(0,0,1920,1080);
  ProcessOpenGLStruct process{0,nullptr,fbo};value.PointerValue=&process;uint64_t count=0;auto start=std::chrono::steady_clock::now();
  while(std::chrono::steady_clock::now()-start<std::chrono::seconds(25)) {if(main(FF_PROCESS_OPENGL,value,instance).UIntValue!=FF_SUCCESS)return 6;++count;std::this_thread::sleep_for(std::chrono::milliseconds(16));}
  // One diagnostic capture only. Not transport or performance evidence.
  std::vector<unsigned char> pixels(1920*1080*4);glReadPixels(0,0,1920,1080,GL_RGBA,GL_UNSIGNED_BYTE,pixels.data());std::ofstream file(argc>2?argv[2]:"standalone.rgba",std::ios::binary);file.write(reinterpret_cast<char*>(pixels.data()),pixels.size());file.close();
  std::cout<<"callbacks "<<count<<" centerRGBA ";for(int i=0;i<4;++i)std::cout<<int(pixels[(540*1920+960)*4+i])<<" ";std::cout<<"\n";
  main(FF_DEINSTANTIATE_GL,{},instance);main(FF_DEINITIALISE,{},nullptr);FreeLibrary(dll);glDeleteFramebuffers(1,&fbo);glDeleteTextures(1,&texture);wglMakeCurrent(nullptr,nullptr);wglDeleteContext(context);ReleaseDC(window,dc);DestroyWindow(window);return 0;
}
