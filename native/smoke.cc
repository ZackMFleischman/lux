#include <windows.h>
#include <iostream>
int main() {
  LARGE_INTEGER frequency{}, first{}, second{};
  if (!QueryPerformanceFrequency(&frequency) || frequency.QuadPart <= 0 ||
      !QueryPerformanceCounter(&first) || !QueryPerformanceCounter(&second) || second.QuadPart < first.QuadPart) return 1;
  std::cout << "{\"target\":\"lux_native_smoke\",\"architecture\":\"x64\",\"qpcFrequency\":" << frequency.QuadPart
            << ",\"compiler\":" << _MSC_FULL_VER << ",\"gpuTested\":false,\"hostTested\":false}\n";
  return 0;
}
