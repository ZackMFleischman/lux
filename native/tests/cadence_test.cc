#include "../../tools/gpu-spike/cadence.h"
#include <cassert>
#include <iostream>
using lux::probe::Cadence;
int main(){
 // Non-divisible frequency: deadline arithmetic must not accumulate period truncation.
 uint64_t now=100;Cadence c;
 auto clock=[&]{return now;};
 auto wait=[&](uint64_t units){now+=(units*1001+9999999)/10000000;return true;};
 assert(lux::probe::runCadence(c,1001,clock,wait,[]{return true;}));
 assert(c.calls==600&&c.start==100&&c.end==10110&&c.coverageEnd>=10110);
 assert(c.slots[1].due==116&&c.slots[59].due==1084&&c.slots[599].due==10093);
 for(const auto& s:c.slots)assert(s.success&&!s.missed&&s.before>=s.due);
 // An early wake rearms; a long callback skips elapsed slots instead of bursting.
 now=0;unsigned waits=0;Cadence slow;
 assert(lux::probe::runCadence(slow,600,clock,[&](uint64_t units){++waits;now+=waits==1?1:(units*600+9999999)/10000000;return true;},[&]{if(now==0)now=35;return true;}));
 assert(slow.slots[1].missed&&slow.slots[2].missed&&slow.slots[3].success&&slow.slots[3].before==35);
 // Rounded-up 100 ns waits plus the fake clock's tick granularity may overshoot one tick.
 assert(slow.slots[4].due==40&&slow.slots[4].before==41&&slow.calls==598&&waits>590);
 // Overshooting the endpoint retains every missed slot and never invokes another callback.
 now=0;Cadence end;
 assert(lux::probe::runCadence(end,600,clock,[&](uint64_t){now=6100;return true;},[]{return true;}));
 assert(end.calls==1&&end.coverageEnd==6100&&end.slots[599].missed);
 // Waiting or callback failure must not yield a complete success record.
 now=0;Cadence failed;
 assert(!lux::probe::runCadence(failed,600,clock,[](uint64_t){return false;},[]{return true;}));
 now=0;assert(!lux::probe::runCadence(failed,600,clock,wait,[]{return false;}));
 assert(failed.calls==1&&!failed.slots[0].success);
 assert(!lux::probe::runCadence(failed,0,clock,wait,[]{return true;}));
 now=UINT64_MAX-100;assert(!lux::probe::runCadence(failed,600,clock,wait,[]{return true;}));
 std::cout<<"cadence scheduling CPU checks passed\n";
}
