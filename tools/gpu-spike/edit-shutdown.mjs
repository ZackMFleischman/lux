import fs from 'node:fs';
const filename='native/texture-bridge/src/electron_texture.cc';let source=fs.readFileSync(filename,'utf8');
source=source.replace('napi_value module(napi_env env,napi_value exports) {',`napi_value shutdown(napi_env env,napi_callback_info) {
  if(!ring)return text(env,"{\\\"closed\\\":true}");
  InterlockedExchange(&ring->alive,0);
  for(unsigned i=0;i<3;++i)if(slots[i].borrowedId||InterlockedCompareExchange(&ring->slots[i].state,Reading,Reading)==Reading)return text(env,"{\\\"closed\\\":false}");
  for(auto& slot:slots){slot.source.Reset();slot.done.Reset();slot.owned.Reset();if(slot.exportHandle)CloseHandle(slot.exportHandle);slot.exportHandle=nullptr;}
  context->ClearState();context->Flush();context.Reset();device.Reset();
  UnmapViewOfFile(ring);ring=nullptr;CloseHandle(mapping);mapping=nullptr;
  return text(env,"{\\\"closed\\\":true}");
}
napi_value module(napi_env env,napi_value exports) {`);
source=source.replace('state,Reading,Reading','state,lux::Reading,lux::Reading');
source=source.replace('{"submit",nullptr,submit','{"shutdown",nullptr,shutdown,nullptr,nullptr,nullptr,napi_default,nullptr},{"submit",nullptr,submit');source=source.replace('exports,4,properties','exports,5,properties');fs.writeFileSync(filename,source);
