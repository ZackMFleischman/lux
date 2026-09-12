#include "shared_ring.h"
#include <iostream>
// Reproduce the original check/use interleaving, without D3D or GL.
int main() {
  lux::SharedRing ring;
  ring.slots[0].state=lux::Ready;
  const bool producerMayRelease=lux::closeAdmission(ring);
  const bool acquired=lux::beginRead(ring);
  if(producerMayRelease&&acquired){std::cerr<<"FAIL: receiver acquired after producer approved release\n";return 1;}
  lux::SharedRing admitted;
  if(!lux::beginRead(admitted)||lux::closeAdmission(admitted))return 2;
  // The reader admitted just before close has not claimed a slot yet. The
  // producer must nevertheless retain it, including this exact check/use gap.
  if(!lux::transition(admitted.slots[0],lux::Free,lux::Reading))return 3;
  if(lux::beginRead(admitted)||lux::closeAdmission(admitted))return 4;
  lux::endRead(admitted);
  if(!lux::closeAdmission(admitted)||!lux::closeAdmission(admitted))return 5;
  if(lux::beginRead(admitted))return 6;
}
