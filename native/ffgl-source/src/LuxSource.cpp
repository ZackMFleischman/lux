#include "FFGLSDK.h"
#include "FrameReceiver.h"
#include <atomic>
#include <algorithm>
#include <cmath>
using namespace ffglex;
extern "C" __declspec(dllexport) const char LuxInstalledSourceProtocol[]="lux-installed-source-protocol-v1";
namespace {
struct Descriptor {
 std::optional<lux::InstalledSource> source;std::string error;
 Descriptor(){try{source=lux::readInstalledSource(reinterpret_cast<const void*>(&descriptorAnchor));}catch(const std::exception& value){error=value.what();}}
 static void descriptorAnchor(){}
};
const Descriptor descriptor;
}
class LuxSource : public CFFGLPlugin {
  FFGLShader shader;
  FFGLScreenQuad quad;
  lux::FrameReceiver receiver;
  std::atomic<float> intensity{0.65f};
  GLint imageLocation=-1,availableLocation=-1;
  bool initialized=false;
 public:
  LuxSource(){SetMinInputs(0);SetMaxInputs(0);receiver.configureInstalled(descriptor.source);if(descriptor.source){intensity=0.5f;receiver.setIntensity(0.5f);}SetParamInfof(0,"Intensity",FF_TYPE_STANDARD);}
  FFResult InitGL(const FFGLViewportStruct* viewport) override {
    if(!descriptor.error.empty()){OutputDebugStringA(descriptor.error.c_str());return FF_FAIL;}
    if(initialized)return FF_SUCCESS;
    const char* vertex=R"(#version 410 core
layout(location=0) in vec4 position;
layout(location=1) in vec2 texcoord;
out vec2 uv;
void main(){gl_Position=position;uv=texcoord;}
)";
    const char* fragment=R"(#version 410 core
in vec2 uv;
out vec4 color;
uniform sampler2D image;
uniform int available;
void main(){color=available!=0?texture(image,vec2(uv.x,1.0-uv.y)):vec4(0);}
)";
    if(!shader.Compile(vertex,fragment)||!quad.Initialise()){shader.FreeGLResources();quad.Release();return FF_FAIL;}
    imageLocation=shader.FindUniform("image");availableLocation=shader.FindUniform("available");
    if(!receiver.start(wglGetCurrentDC(),wglGetCurrentContext())){shader.FreeGLResources();quad.Release();return FF_FAIL;}
    const auto result=CFFGLPlugin::InitGL(viewport);
    if(result!=FF_SUCCESS){receiver.stop();shader.FreeGLResources();quad.Release();return result;}
    initialized=true;return FF_SUCCESS;
  }
  FFResult ProcessOpenGL(ProcessOpenGLStruct*) override {
    if(!initialized)return FF_FAIL;
    const GLuint texture=receiver.acquireLatest();
    GLint program=0,vao=0,active=0,bound=0;
    glGetIntegerv(GL_CURRENT_PROGRAM,&program);glGetIntegerv(GL_VERTEX_ARRAY_BINDING,&vao);glGetIntegerv(GL_ACTIVE_TEXTURE,&active);
    glActiveTexture(GL_TEXTURE0);glGetIntegerv(GL_TEXTURE_BINDING_2D,&bound);
    glBindTexture(GL_TEXTURE_2D,texture);glUseProgram(shader.GetGLID());
    glUniform1i(imageLocation,0);glUniform1i(availableLocation,texture?1:0);
    quad.Draw();receiver.afterDraw();
    glBindVertexArray(vao);glUseProgram(program);glBindTexture(GL_TEXTURE_2D,bound);glActiveTexture(active);
    return FF_SUCCESS;
  }
  FFResult DeInitGL() override {receiver.stop();shader.FreeGLResources();quad.Release();initialized=false;return FF_SUCCESS;}
  FFResult SetFloatParameter(unsigned int index,float value) override {
    if(index||!std::isfinite(value))return FF_FAIL;
    intensity=std::clamp(value,0.0f,1.0f);receiver.setIntensity(intensity);return FF_SUCCESS;
  }
  float GetFloatParameter(unsigned int) override{return intensity;}
};
static CFFGLPluginInfo info(PluginFactory<LuxSource>,descriptor.source?descriptor.source->pluginId.c_str():"LX02",descriptor.source?descriptor.source->name.c_str():"Lux TR02 Probe",2,1,0,2,FF_SOURCE,"Lux source runtime","Lux");
