#include <windows.h>
#include <filesystem>
#include <fstream>
#include <cassert>
#include <cstring>
#include <cstdint>
union Mixed{uint32_t number;void* pointer;};
struct Info{uint32_t major,minor;char id[4],name[16];uint32_t type;};
using Main=Mixed(__stdcall*)(uint32_t,Mixed,void*);
int wmain(int argc,wchar_t** argv){
 assert(argc==2);wchar_t temp[MAX_PATH]{};GetTempPathW(MAX_PATH,temp);
 auto folder=std::filesystem::path(temp)/(L"lux-scan-cpu-"+std::to_wstring(GetCurrentProcessId()));std::filesystem::create_directory(folder);
 auto dll=folder/L"Lux_test.dll",sidecar=folder/L"Lux_test.dll.lux-source";std::filesystem::copy_file(argv[1],dll);
 std::ofstream file(sidecar,std::ios::binary);file<<"lux-installed-source-v1\n"<<std::string(64,'a')<<"\n"<<std::string(64,'b')<<"\nT123\nCPU Test Source\n";file.close();
 const auto module=LoadLibraryW(dll.c_str());assert(module);auto main=reinterpret_cast<Main>(GetProcAddress(module,"plugMain"));assert(main);
 const auto info=static_cast<Info*>(main(0,Mixed{},nullptr).pointer);assert(info&&memcmp(info->id,"T123",4)==0&&memcmp(info->name,"CPU Test Source",15)==0);
 auto bits=main(6,Mixed{},nullptr).number;float value;memcpy(&value,&bits,4);assert(value==0.5f);
 main(2,Mixed{},nullptr);FreeLibrary(module);
 std::ofstream parameters(sidecar,std::ios::binary|std::ios::trunc);parameters<<"lux-installed-source-v2\n"<<std::string(64,'a')<<"\n"<<std::string(64,'b')<<"\nT123\nCPU Parameters\n"<<std::string(64,'c')<<"\n2\nheight\tHeight\t0.75\nspeed\tSpeed\t0.25\n";parameters.close();
 const auto generic=LoadLibraryW(dll.c_str());assert(generic);auto genericMain=reinterpret_cast<Main>(GetProcAddress(generic,"plugMain"));assert(genericMain);
 assert(genericMain(4,Mixed{},nullptr).number==2); // FF_GETNUMPARAMETERS
 bits=genericMain(6,Mixed{0},nullptr).number;memcpy(&value,&bits,4);assert(value==0.75f);
 bits=genericMain(6,Mixed{1},nullptr).number;memcpy(&value,&bits,4);assert(value==0.25f);
 genericMain(2,Mixed{},nullptr);FreeLibrary(generic);
 std::filesystem::remove(dll);std::filesystem::remove(sidecar);std::filesystem::remove(folder);
 // No InitGL/ProcessOpenGL calls: this only verifies scan metadata and defaults.
}
