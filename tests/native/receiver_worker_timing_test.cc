#include "ReceiverWorkerTiming.h"
#include <iostream>
#include <sstream>
#define CHECK(x) do {if(!(x)){std::cerr<<"FAIL "<<__LINE__<<": " #x "\n";return 1;}}while(0)
static uint64_t tick=100,clockCalls=0;
static uint64_t clockNow() noexcept {++clockCalls;return tick;}
int main(){
 using namespace lux;
 ReceiverWorkerTiming<2> off;off.initialize(false);
 {ReceiverWorkerTimingSpan span(off,ReceiverWorkerStage::OuterSleep,{},clockNow);tick=150;span.finish(true);}
 CHECK(clockCalls==0&&!off.enabled()&&off.attempted()==0);std::ostringstream empty;off.write(empty,"instance",10000000,true);CHECK(empty.str().empty());
 ReceiverWorkerTiming<2> timing;timing.initialize(true);const ReceiverWorkerTimingKey key{7,8,9};
 {ReceiverWorkerTimingSpan span(timing,ReceiverWorkerStage::CopyQuery,key,clockNow);tick+=160000;span.finish(true);span.finish(true);}
 CHECK(timing.recorded()==1&&timing.attempted()==1&&timing.records()[0].end-timing.records()[0].start==160000);
 CHECK(timing.records()[0].key.generation==7&&timing.records()[0].key.outputGeneration==8&&timing.records()[0].key.frame==9);
 std::ostringstream valid;timing.write(valid,"instance",10000000,true);CHECK(valid.str().find("\"valid\":true")!=std::string::npos);
 {ReceiverWorkerTimingSpan span(timing,ReceiverWorkerStage::NvLock,key,clockNow);tick+=5;}
 CHECK(!timing.records()[1].complete&&timing.incomplete()==1);
 {ReceiverWorkerTimingSpan span(timing,ReceiverWorkerStage::OuterSleep,{},clockNow);++tick;span.finish(true);}
 CHECK(timing.recorded()==2&&timing.attempted()==3&&timing.lost()==1);
 std::ostringstream log;timing.write(log,"instance",10000000,false);CHECK(log.str().find("\"valid\":false")!=std::string::npos&&log.str().find("\"aborted\":true")!=std::string::npos&&log.str().find("\"lostRecords\":1")!=std::string::npos);
 ReceiverWorkerTiming<2> bad;bad.initialize(true);
 {ReceiverWorkerTimingSpan span(bad,ReceiverWorkerStage::LocalCopySleep,{},clockNow);tick=0;span.finish(true);}
 CHECK(bad.clockFailures()==1&&bad.recorded()==0);
 tick=100;{ReceiverWorkerTimingSpan span(bad,ReceiverWorkerStage::GlFenceReady,key,clockNow);tick=99;span.finish(true);}
 CHECK(bad.clockFailures()==2);
 std::cout<<"receiver worker timing bounds, disabled mode, identity, loss and failed spans passed\n";
}
