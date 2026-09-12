#include <windows.h>
#include <delayimp.h>
#include <cstring>
static FARPROC WINAPI hook(unsigned event, PDelayLoadInfo info) {
 if(event==dliNotePreLoadLibrary && (_stricmp(info->szDll,"node.exe")==0 || _stricmp(info->szDll,"node.dll")==0)) return reinterpret_cast<FARPROC>(GetModuleHandle(nullptr));
 return nullptr;
}
extern "C" const PfnDliHook __pfnDliNotifyHook2=hook;
