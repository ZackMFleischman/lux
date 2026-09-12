#include "shared_ring.h"
#include <iostream>
#include <limits>
#define CHECK(x) do {if(!(x)){std::cerr<<"FAIL: " #x "\n";return 1;}}while(0)
int main(){
 lux::SharedRing ring;float value=-1;
 CHECK(!lux::readHostControl(ring,value));
 lux::publishHostControl(ring,std::numeric_limits<float>::quiet_NaN());
 CHECK(!lux::readHostControl(ring,value));
 lux::publishHostControl(ring,.17f);
 CHECK(lux::readHostControl(ring,value)&&value==.17f);
 lux::publishHostControl(ring,0);CHECK(lux::readHostControl(ring,value)&&value==0);
 lux::publishHostControl(ring,1);CHECK(lux::readHostControl(ring,value)&&value==1);
 lux::closeAdmission(ring);CHECK(!lux::readHostControl(ring,value));
 lux::SharedRing restart;CHECK(!lux::readHostControl(restart,value));
}
