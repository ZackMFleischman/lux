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
void selectedUnchanged(SharedRing& r,FrameKey key,LONG admissions){
 assert(r.generation==key.generation&&r.outputGeneration==key.outputGeneration);
 assert(r.slots[key.slot].state==Reading&&r.slots[key.slot].frame==key.frame);
 assert(r.admissions==admissions);
}
int main(){
 // Reclaiming nothing would exhaust capacity on the second iteration.
 {
  SharedRing r;r.generation=17;r.outputGeneration=2;uint64_t next=0;
  for(unsigned pass=0;pass<50;++pass){
   for(unsigned i=0;i<3;++i)publish(r,i,++next);
   auto selected=claim(r,2);assert(retireObsoleteReadySources(r,selected));
   assert(r.slots[0].state==Free&&r.slots[1].state==Free);
   selectedUnchanged(r,selected,1);done(r,selected);assert(r.admissions==0);
  }
 }
 // Actual reader admission and producer ownership must survive reclamation.
 {
  SharedRing r;r.generation=17;publish(r,0,1);auto other=claim(r,0);
  assert(transition(r.slots[1],Free,Writing));r.slots[1].frame=2;
  publish(r,2,3);auto selected=claim(r,2);assert(r.admissions==2);
  assert(retireObsoleteReadySources(r,selected));
  assert(r.slots[0].state==Reading&&r.slots[0].frame==other.frame);
  assert(r.slots[1].state==Writing&&r.slots[1].frame==2);
  selectedUnchanged(r,selected,2);done(r,other);done(r,selected);assert(r.admissions==0);
 }
 // Retiring equal, newer or zero publications would destroy retained images.
 for(uint64_t retained:{0ull,3ull,4ull}){
  SharedRing r;r.generation=17;publish(r,0,retained);publish(r,2,3);
  auto selected=claim(r,2);assert(retireObsoleteReadySources(r,selected));
  assert(r.slots[0].state==Ready&&r.slots[0].frame==retained&&r.slots[1].state==Free);
  selectedUnchanged(r,selected,1);done(r,selected);
 }
 // Every invalid selected key must leave candidates untouched and balance admission.
 for(auto bad:{FrameKey{18,1,3,2},FrameKey{17,2,3,2},FrameKey{17,1,2,2},FrameKey{17,1,3,3},FrameKey{17,1,0,2}}){
  SharedRing r;r.generation=17;publish(r,0,1);publish(r,2,3);
  auto selected=claim(r,2);assert(!retireObsoleteReadySources(r,bad));
  assert(r.slots[0].state==Ready&&r.slots[0].frame==1&&r.slots[1].state==Free);
  selectedUnchanged(r,selected,1);done(r,selected);
 }
 // A selected publication actually carrying frame zero is invalid too.
 {
  SharedRing r;r.generation=17;publish(r,0,1);publish(r,2,0);
  auto selected=claim(r,2);assert(!retireObsoleteReadySources(r,selected));
  assert(r.slots[0].state==Ready&&r.slots[0].frame==1&&r.slots[1].state==Free);
  selectedUnchanged(r,selected,1);done(r,selected);
 }
 // Reclamation must reject an unclaimed selected slot even with a read admission.
 for(LONG state:{Free,Writing,Ready}){
  SharedRing r;r.generation=17;publish(r,0,1);
  if(state!=Free){assert(transition(r.slots[2],Free,Writing));}
  r.slots[2].frame=3;
  if(state==Ready){assert(transition(r.slots[2],Writing,Ready));}
  assert(beginRead(r));assert(!retireObsoleteReadySources(r,{17,1,3,2}));
  assert(r.slots[0].state==Ready&&r.slots[0].frame==1&&r.slots[1].state==Free);
  assert(r.slots[2].state==state&&r.slots[2].frame==3&&r.admissions==1);
  endRead(r);assert(r.admissions==0);
 }
 // Refused temporary admission cannot alter any slots or consume caller admission.
 {
  SharedRing r;r.generation=17;publish(r,0,1);publish(r,2,3);
  auto selected=claim(r,2);assert(!closeAdmission(r));
  assert(retireObsoleteReadySources(r,selected));
  assert(r.slots[0].state==Ready&&r.slots[0].frame==1&&r.slots[1].state==Free);
  selectedUnchanged(r,selected,RingClosing|1);done(r,selected);assert(closeAdmission(r));
 }
 {
  SharedRing r;r.generation=17;publish(r,0,1);publish(r,2,3);
  auto selected=claim(r,2);InterlockedExchange(&r.admissions,RingClosing-1);
  assert(retireObsoleteReadySources(r,selected));
  assert(r.slots[0].state==Ready&&r.slots[0].frame==1&&r.slots[1].state==Free);
  selectedUnchanged(r,selected,RingClosing-1);
  // Isolated saturation fixture: restore its one real reader only after assertions.
  InterlockedExchange(&r.admissions,1);done(r,selected);assert(r.admissions==0);
 }
 // Producer reuse after Free must not be freed by an obsolete key or frame decision.
 {
  SharedRing r;r.generation=9;publish(r,0,1);publish(r,2,3);auto selected=claim(r,2);
  std::thread producer([&]{const auto end=std::chrono::steady_clock::now()+std::chrono::seconds(1);
   while(!transition(r.slots[0],Free,Writing)){assert(std::chrono::steady_clock::now()<end);std::this_thread::yield();}
   r.slots[0].frame=99;assert(transition(r.slots[0],Writing,Ready));
  });
  assert(retireObsoleteReadySources(r,selected));producer.join();
  selectedUnchanged(r,selected,1);assert(!retire(r,{9,1,1,0}));
  assert(retireObsoleteReadySources(r,selected));
  assert(r.slots[0].state==Ready&&r.slots[0].frame==99&&r.slots[1].state==Free);
  selectedUnchanged(r,selected,1);done(r,selected);assert(r.admissions==0);
 }
 std::cout<<"source Ready-slot retirement ownership checks passed\n";
}
