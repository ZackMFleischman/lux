#include <node_api.h>
#include <windows.h>
#include <d3d11_1.h>
#include <dxgi1_2.h>
#include <wrl/client.h>
#include <sstream>
#include <array>
using Microsoft::WRL::ComPtr;
struct Slot { ComPtr<ID3D11Texture2D> source, owned; ComPtr<ID3D11Query> done; uint64_t id=0; };
ComPtr<ID3D11Device1> device; ComPtr<ID3D11DeviceContext> context;
std::array<Slot,3> slots; uint64_t sequence=0; DXGI_ADAPTER_DESC adapterDesc{};
napi_value str(napi_env e,const std::string& s) { napi_value v; napi_create_string_utf8(e,s.c_str(),s.size(),&v); return v; }
void check(HRESULT hr) { if(FAILED(hr)) { std::ostringstream s; s<<"HRESULT 0x"<<std::hex<<uint32_t(hr); throw std::runtime_error(s.str()); } }
void init() {
 if(device) return;
 ComPtr<IDXGIFactory1> factory; check(CreateDXGIFactory1(IID_PPV_ARGS(&factory)));
 ComPtr<IDXGIAdapter1> adapter;
 for(UINT i=0;factory->EnumAdapters1(i,&adapter)!=DXGI_ERROR_NOT_FOUND;++i) { DXGI_ADAPTER_DESC1 d{}; adapter->GetDesc1(&d); if(d.VendorId==0x10de) break; adapter.Reset(); }
 if(!adapter) throw std::runtime_error("NVIDIA reference adapter unavailable");
 adapter->GetDesc(&adapterDesc); ComPtr<ID3D11Device> base;
 check(D3D11CreateDevice(adapter.Get(),D3D_DRIVER_TYPE_UNKNOWN,nullptr,D3D11_CREATE_DEVICE_BGRA_SUPPORT,nullptr,0,D3D11_SDK_VERSION,&base,nullptr,&context)); check(base.As(&device));
}
napi_value submit(napi_env e,napi_callback_info info) {
 try { init(); size_t argc=1; napi_value args[1]; napi_get_cb_info(e,info,&argc,args,nullptr,nullptr); void* bytes=nullptr; size_t n=0; check(napi_get_buffer_info(e,args[0],&bytes,&n)==napi_ok?S_OK:E_INVALIDARG); if(n!=sizeof(HANDLE)) throw std::runtime_error("NT handle must be 8-byte Buffer");
 Slot* s=nullptr; for(auto& slot:slots) if(!slot.id) {s=&slot;break;} if(!s) return str(e,"{\"drop\":\"no-free-slot\"}");
 HANDLE h; memcpy(&h,bytes,sizeof(h)); check(device->OpenSharedResource1(h,IID_PPV_ARGS(&s->source))); D3D11_TEXTURE2D_DESC d{}; s->source->GetDesc(&d);
 if(d.Format!=DXGI_FORMAT_B8G8R8A8_UNORM && d.Format!=DXGI_FORMAT_R8G8B8A8_UNORM) throw std::runtime_error("unsupported format");
 d.BindFlags=D3D11_BIND_SHADER_RESOURCE|D3D11_BIND_RENDER_TARGET; d.MiscFlags=0; d.CPUAccessFlags=0; d.Usage=D3D11_USAGE_DEFAULT;
 if(!s->owned) check(device->CreateTexture2D(&d,nullptr,&s->owned));
 D3D11_QUERY_DESC q{D3D11_QUERY_EVENT,0}; if(!s->done) check(device->CreateQuery(&q,&s->done));
 context->CopyResource(s->owned.Get(),s->source.Get()); context->End(s->done.Get()); context->Flush(); s->id=++sequence;
 std::ostringstream out; out<<"{\"id\":"<<s->id<<",\"width\":"<<d.Width<<",\"height\":"<<d.Height<<",\"format\":"<<d.Format<<",\"adapterLuidLow\":"<<adapterDesc.AdapterLuid.LowPart<<",\"adapterLuidHigh\":"<<adapterDesc.AdapterLuid.HighPart<<"}"; return str(e,out.str());
 } catch(const std::exception& ex) { napi_throw_error(e,nullptr,ex.what()); return nullptr; }
}
napi_value poll(napi_env e,napi_callback_info) {
 std::ostringstream out; out<<"["; bool comma=false;
 for(auto& s:slots) if(s.id) { BOOL complete=FALSE; HRESULT hr=context->GetData(s.done.Get(),&complete,sizeof(complete),D3D11_ASYNC_GETDATA_DONOTFLUSH); if(hr==S_OK && complete) {if(comma)out<<","; out<<s.id; comma=true; s.source.Reset(); s.id=0;} else if(FAILED(hr)) {napi_throw_error(e,nullptr,"GPU query failed; retain borrowed textures until process teardown");return nullptr;} }
 out<<"]";return str(e,out.str());
}
napi_value module(napi_env e,napi_value exports) { napi_property_descriptor p[]={{"submit",nullptr,submit,nullptr,nullptr,nullptr,napi_default,nullptr},{"poll",nullptr,poll,nullptr,nullptr,nullptr,napi_default,nullptr}}; napi_define_properties(e,exports,2,p); return exports; }
NAPI_MODULE(NODE_GYP_MODULE_NAME,module)
