#include "../../tools/gpu-spike/pixel-marker.h"
#include <cassert>
using namespace lux::probe;
MarkerPixels encode(uint32_t step,uint32_t frame){uint32_t bits=step|(frame<<4)|(0xa5u<<20)|(((step+frame)&7)<<28)|((step&1)<<31);MarkerPixels p{};for(unsigned i=0;i<32;++i)p[i]={static_cast<unsigned char>((bits>>i&1)*255),static_cast<unsigned char>((bits>>i&1)*255),static_cast<unsigned char>((bits>>i&1)*255),255};return p;}
int main(){PixelMarker marker;for(unsigned i=0;i<=8;++i){auto p=encode(i,1234+i);assert(decodeMarker(p,marker)&&marker.step==i&&marker.frame==1234+i);}
 for(auto p:{encode(9,1),encode(1,0)})assert(!decodeMarker(p,marker));
 auto p=encode(1,42);p[20][0]=128;assert(!decodeMarker(p,marker));p=encode(1,42);p[0][3]=0;assert(!decodeMarker(p,marker));p=encode(1,42);std::swap(p[20],p[21]);assert(!decodeMarker(p,marker));
 p=encode(1,42);for(auto& x:p)for(unsigned c=0;c<3;++c)x[c]=x[c]?250:5;assert(decodeMarker(p,marker));p[0][0]=249;assert(!decodeMarker(p,marker));
}
