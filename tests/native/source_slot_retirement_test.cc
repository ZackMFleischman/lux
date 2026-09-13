#include "shared_ring.h"
#include <cassert>
#include <thread>
#include <chrono>
#include <iostream>
using namespace lux;
void publish(SharedRing& r,unsigned slot,uint64_t frame){
 assert(transition(r.slots[slot],Free,Writing));r.slots[slot].frame=frame;
 // Only the producer's confirmed GPU completion publishes Ready.
 assert(transition(r.slots[slot],Writing,Ready));
}
FrameKey claim(SharedRing& r,unsigned slot){assert(beginRead(r));assert(transition(r.slots[slot],Ready,Reading));return {r.generation,r.outputGeneration,r.slots[slot].frame,slot};}
void done(SharedRing& r,FrameKey key){assert(retire(r,key));endRead(r);}
int main(){
 SharedRing r;r.generation=17;r.outputGeneration=2;uint64_t next=0;
 // Each pass uses the actual shared-ring publication, admission, claim and retirement
 // operations. Without reclaim, the first pass leaves old Ready slots 1 and 2 pinned.
 for(unsigned pass=0;pass<50;++pass){
  for(unsigned i=0;i<3;++i)publish(r,i,++next);
  auto selected=claim(r,2);assert(retireObsoleteReadySources(r,selected));
  assert(r.slots[0].state==Free&&r.slots[1].state==Free);
  assert(r.slots[2].state==Reading&&r.slots[2].frame==selected.frame&&r.admissions==1);
  done(r,selected);assert(r.admissions==0);
 }
 // Ready only: neither an in-flight producer copy nor another reader can be freed.
 publish(r,0,200);assert(transition(r.slots[0],Ready,Reading));
 assert(transition(r.slots[1],Free,Writing));r.slots[1].frame=201;
 publish(r,2,202);auto selected=claim(r,2);
 assert(retireObsoleteReadySources(r,selected));assert(r.slots[0].state==Reading&&r.slots[1].state==Writing);
 assert(retire(r,{17,2,200,0}));assert(transition(r.slots[1],Writing,Ready));
 done(r,selected);
 // A newer, equal, or invalid frame must be restored to Ready after inspection.
 publish(r,0,202);publish(r,2,201);selected=claim(r,2);
  assert(retireObsoleteReadySources(r,selected));assert(r.slots[0].state==Ready&&r.slots[1].state==Ready);
 r.slots[1].frame=0;assert(retireObsoleteReadySources(r,selected));assert(r.slots[1].state==Ready);r.slots[1].frame=201;
 for(auto bad:{FrameKey{18,2,201,2},FrameKey{17,3,201,2},FrameKey{17,2,200,2},FrameKey{17,2,201,3}}){assert(!retireObsoleteReadySources(r,bad));assert(r.admissions==1);}
 done(r,selected);
 // Closing rejects new cleanup admission; the existing selected lease still pins shutdown.
 selected=claim(r,0);assert(!closeAdmission(r));assert(retireObsoleteReadySources(r,selected));
 assert(r.slots[1].state==Ready&&r.admissions==(RingClosing|1));done(r,selected);assert(closeAdmission(r));
 // A producer can immediately reuse reclaimed capacity; stale keys cannot free that publication.
 SharedRing concurrent;concurrent.generation=9;publish(concurrent,0,1);publish(concurrent,2,3);selected=claim(concurrent,2);
 std::thread producer([&]{const auto end=std::chrono::steady_clock::now()+std::chrono::seconds(1);
  while(!transition(concurrent.slots[0],Free,Writing)){assert(std::chrono::steady_clock::now()<end);std::this_thread::yield();}
  concurrent.slots[0].frame=99;assert(transition(concurrent.slots[0],Writing,Ready));
 });
 assert(retireObsoleteReadySources(concurrent,selected));producer.join();
 assert(!retire(concurrent,{9,1,1,0}));assert(retireObsoleteReadySources(concurrent,selected));
 assert(concurrent.slots[0].state==Ready&&concurrent.slots[0].frame==99&&concurrent.admissions==1);done(concurrent,selected);
 std::cout<<"source Ready-slot retirement ownership checks passed\n";
}
