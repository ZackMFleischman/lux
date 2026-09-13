#pragma once
#include <array>
#include <cstdint>
namespace lux::probe {
using MarkerPixels=std::array<std::array<unsigned char,4>,32>;
struct PixelMarker {uint32_t step=0,frame=0;};
inline bool decodeMarker(const MarkerPixels& pixels,PixelMarker& result){
 uint32_t bits=0;
 for(unsigned i=0;i<32;++i){const auto& p=pixels[i];if(p[3]<250)return false;
  const bool zero=p[0]<=5&&p[1]<=5&&p[2]<=5,one=p[0]>=250&&p[1]>=250&&p[2]>=250;
  if(!zero&&!one)return false;if(one)bits|=uint32_t(1)<<i;
 }
 const uint32_t step=bits&15,frame=(bits>>4)&65535;
 if(step>8||!frame||((bits>>20)&255)!=0xa5||((bits>>28)&7)!=((step+frame)&7)||(bits>>31)!=(step&1))return false;
 result={step,frame};return true;
}
}
