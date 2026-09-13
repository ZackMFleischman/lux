#pragma once
#include <array>
#include <cstdint>
namespace lux::probe {
struct CadenceSlot { uint64_t due=0,before=0,after=0; unsigned sequence=0; bool missed=false,success=false; };
struct Cadence { uint64_t start=0,end=0,coverageEnd=0; unsigned calls=0; std::array<CadenceSlot,600> slots{}; };
// Wait takes a positive, rounded-up count of 100 ns units. It must block, never spin.
// A bounded frequency makes every product below fit uint64_t without float drift.
template<class Now,class Wait,class Call> bool runCadence(Cadence& c,uint64_t frequency,Now now,Wait wait,Call call){
 c={};if(frequency<60||frequency>1000000000)return false;
 c.start=now();if(c.start>UINT64_MAX-frequency*10)return false;c.end=c.start+frequency*10;
 for(unsigned i=0;i<600;++i)c.slots[i].due=c.start+(uint64_t(i)*frequency)/60;
 auto waitUntil=[&](uint64_t target){
  for(;;){const auto at=now();if(at<c.start)return false;if(at>=target)return true;
   const auto units=((target-at)*10000000+frequency-1)/frequency;
   if(!wait(units))return false;
  }
 };
 unsigned next=0;
 while(next<600){
  if(!waitUntil(c.slots[next].due))return false;
  const auto at=now();if(at>=c.end){while(next<600)c.slots[next++].missed=true;break;}
  while(next+1<600&&c.slots[next+1].due<=at)c.slots[next++].missed=true;
  // One admission sample selects the slot and starts its elapsed callback bracket.
  // Resampling here could relabel an obsolete slot after a scheduling interruption.
  auto& s=c.slots[next++];s.sequence=++c.calls;s.before=at;
  s.success=call();s.after=now();if(!s.success||s.after<s.before)return false;
 }
 if(!waitUntil(c.end))return false;c.coverageEnd=now();return c.coverageEnd>=c.end;
}
}
