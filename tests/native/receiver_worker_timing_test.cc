#include "ReceiverWorkerTiming.h"
#include "ReceiverRun.h"
#include <cassert>
#include <iostream>
#include <optional>
#include <sstream>
#include <stdexcept>
#include <string>
#include <type_traits>
#include <vector>
#ifdef NDEBUG
#error Receiver timing CPU checks require active assertions in Release.
#endif
using namespace lux;
namespace {
uint64_t now=100, calls=0;
size_t allocationCalls=0,allocationCapacity=0;
uint64_t clockNow() noexcept {++calls;return now;}
ReceiverWorkerTimingRecord* nullStorage(size_t) noexcept {return nullptr;}
ReceiverWorkerTimingRecord* countedStorage(size_t capacity) noexcept {++allocationCalls;allocationCapacity=capacity;return ReceiverWorkerTiming<>::allocate(capacity);}
constexpr auto sampleInstance="aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
constexpr ReceiverWorkerTimingKey sampleKey{2,3,4};
template<size_t N> std::string output(const ReceiverWorkerTiming<N>& timing,uint64_t hz=1000,bool completed=true) {
 std::ostringstream out;timing.write(out,sampleInstance,hz,completed);return out.str();
}
void sample(ReceiverWorkerTiming<>& timing) {
 ReceiverWorkerTimingSpan span(timing,ReceiverWorkerStage::OuterSleep,{},clockNow);
 now+=16;span.finish(true);
}
void boundsAndClocks() {
 ReceiverWorkerTiming<> timing; timing.initialize(false); calls=0;
 {ReceiverWorkerTimingSpan span(timing,ReceiverWorkerStage::OuterSleep,{},clockNow);span.finish(true);}
 assert(calls==0&&timing.attempted()==0&&output(timing).empty());
 timing.initialize(true,nullStorage);assert(!timing.enabled()&&timing.requested());
 assert(output(timing).find("\"allocationFailed\":true")!=std::string::npos);
 assert(output(timing).find("\"valid\":false")!=std::string::npos);
 timing.initialize(true,countedStorage);sample(timing);assert(timing.recorded()==1);
 assert(allocationCalls==1&&allocationCapacity==32768);
 for(int i=0;i<10;++i)sample(timing);assert(allocationCalls==1);
 timing.initialize(false);assert(!timing.enabled()&&timing.recorded()==0&&timing.attempted()==0&&output(timing).empty());
 timing.initialize(true);assert(timing.recorded()==0&&timing.attempted()==0);sample(timing);
 assert(output(timing).find("\"valid\":true")!=std::string::npos);
 assert(output(timing,0).find("\"valid\":false")!=std::string::npos);
 ReceiverWorkerTiming<2> small;small.initialize(true);
 for(int i=0;i<12;++i)small.append(ReceiverWorkerStage::OuterSleep,{},100,101,true);
 assert(small.recorded()==2&&small.attempted()==12&&small.lost()==10);
 assert(output(small).find("\"valid\":false")!=std::string::npos);
 timing.initialize(true);
 for(size_t i=0;i<32768;++i)timing.append(ReceiverWorkerStage::OuterSleep,{},100,101,true);
 assert(timing.recorded()==32768&&timing.lost()==0&&output(timing).find("\"valid\":true")!=std::string::npos);
 timing.append(ReceiverWorkerStage::OuterSleep,{},100,101,true);
 assert(timing.recorded()==32768&&timing.lost()==1&&output(timing).find("\"valid\":false")!=std::string::npos);
 for(auto pair: {std::pair<uint64_t,uint64_t>{0,100},{100,0},{100,99}}) {
  timing.initialize(true);timing.append(ReceiverWorkerStage::NvLock,sampleKey,pair.first,pair.second,true);
  assert(timing.attempted()==1&&timing.recorded()==0&&timing.clockFailures()==1);
  assert(output(timing).find("\"valid\":false")!=std::string::npos);
 }
 timing.initialize(true);timing.append(ReceiverWorkerStage::NvLock,sampleKey,100,200,true);timing.append(ReceiverWorkerStage::NvLock,sampleKey,100,199,true);
 assert(timing.clockFailures()==1);
 for(auto invalidKey:{ReceiverWorkerTimingKey{9007199254740992ULL,3,4},ReceiverWorkerTimingKey{2,9007199254740992ULL,4},ReceiverWorkerTimingKey{2,3,0},ReceiverWorkerTimingKey{0,0,0}}){
  timing.initialize(true);timing.append(ReceiverWorkerStage::NvLock,invalidKey,100,101,true);
  assert(output(timing).find("\"valid\":false")!=std::string::npos);
 }
 timing.initialize(true);timing.append(static_cast<ReceiverWorkerStage>(100),sampleKey,100,101,true);
 assert(output(timing).find("\"valid\":false")!=std::string::npos);
 uint64_t count=UINT64_MAX-2;assert(receiverWorkerIncrement(count));assert(count==UINT64_MAX-1);
 assert(!receiverWorkerIncrement(count)&&count==UINT64_MAX);assert(!receiverWorkerIncrement(count)&&count==UINT64_MAX);
}
void spansAndJson() {
 static_assert(sizeof(ReceiverWorkerTimingRecord)<=64);
 static_assert(!std::is_copy_constructible_v<ReceiverWorkerTimingSpan<32768>>);
 static_assert(!std::is_move_constructible_v<ReceiverWorkerTimingSpan<32768>>);
 ReceiverWorkerTiming<> timing;timing.initialize(true);now=100;calls=0;
 {ReceiverWorkerTimingSpan outer(timing,ReceiverWorkerStage::CopyQuery,sampleKey,clockNow);
  now=101;{ReceiverWorkerTimingSpan inner(timing,ReceiverWorkerStage::LocalCopySleep,sampleKey,clockNow);now=117;inner.finish(true);inner.finish(false);}
  now=120;outer.finish(true);}
 assert(calls==4&&timing.recorded()==2&&timing.incomplete()==0);
 assert(timing.records()[0].start==101&&timing.records()[0].end==117&&timing.records()[1].start==100&&timing.records()[1].end==120);
 auto text=output(timing);
 assert(text.find("{\"kind\":\"receiver-worker-timing\",\"instanceId\":\"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\",\"sequence\":1,\"stage\":\"local-copy-poll-sleep\",\"start\":\"101\",\"end\":\"117\",\"generation\":2,\"outputGeneration\":3,\"frameId\":\"4\",\"boundFrame\":true,\"complete\":true,\"requestedSleepMs\":1}\n")==0);
 for(auto stage:{ReceiverWorkerStage::OuterSleep,ReceiverWorkerStage::LocalCopySleep,ReceiverWorkerStage::CopyQuery,ReceiverWorkerStage::NvLock,ReceiverWorkerStage::GlFenceReady}){
  timing.initialize(true);now=200;{ReceiverWorkerTimingSpan span(timing,stage,sampleKey,clockNow);now=201;span.finish(true);}
  assert(timing.records()[0].key.frame==4&&timing.records()[0].key.generation==2&&timing.records()[0].key.outputGeneration==3);
  assert(output(timing).find(receiverWorkerStageName(stage))!=std::string::npos);
 }
 for(bool explicitFinish:{true,false}){timing.initialize(true);{ReceiverWorkerTimingSpan span(timing,ReceiverWorkerStage::NvLock,sampleKey,clockNow);if(explicitFinish)span.finish(false);}
  assert(timing.incomplete()==1&&timing.attempted()==1&&output(timing).find("\"valid\":false")!=std::string::npos);}
 timing.initialize(true);now=0;{ReceiverWorkerTimingSpan span(timing,ReceiverWorkerStage::NvLock,sampleKey,clockNow);now=10;span.finish(true);}assert(timing.clockFailures()==1);
}
struct Ops {
 Completion copy=Completion::Pending;std::vector<std::string> order;
 Completion pollCopy(){return copy;}Completion pollGl(){return Completion::Complete;}
 bool retire(){order.push_back("retire");return true;}void endAdmission(){order.push_back("admission");}
 bool unlock(){order.push_back("unlock");return true;}bool unregister(){order.push_back("unregister");return true;}void release(){order.push_back("release");}
};
void lifecycleAndAttribution() {
 for(auto outcome:{CopyPollAction::Stop,CopyPollAction::Failed,CopyPollAction::Deadline}) {
  ReceiverWorkerTiming<> timing;timing.initialize(true);ReceiverWorkerTimingFinalization finalization;
  std::optional<ReceiverWorkerTimingSpan<32768>> pending;
  ImportOwnership ownership{true,true,true,false,true,true};Ops ops;int failures=0,summaries=0,cleanup=0;
  runReceiverBody([&]{ReceiverWorkerTimingSpan copy(timing,ReceiverWorkerStage::CopyQuery,sampleKey,clockNow);
   auto action=classifyCopyPoll(outcome==CopyPollAction::Failed?Completion::Failed:Completion::Pending,outcome==CopyPollAction::Stop,true);
   if(action==CopyPollAction::Stop)throw ReceiverStopRequested{};
   if(action==CopyPollAction::Failed||action==CopyPollAction::Deadline)throw std::runtime_error("copy failed");
   finalization.bodyCompleted();
  },[&](const char*){++failures;},[&]{++summaries;});
  finalization.prepare(true,sampleInstance,pending);
  assert(ownership.cleanup(ops)==Completion::Pending&&ops.order.empty()&&ownership.lease&&ownership.admission&&ownership.copyPending);
  ops.copy=Completion::Failed;assert(ownership.cleanup(ops)==Completion::Failed&&ops.order.empty()&&ownership.registered&&ownership.locked);
  ops.copy=Completion::Complete;assert(ownership.cleanup(ops)==Completion::Complete);++cleanup;
  assert((ops.order==std::vector<std::string>{"retire","admission","unlock","unregister","release"}));
  std::ostringstream out;assert(finalization.drain(timing,out,1000));
  assert(cleanup==1&&summaries==1&&failures==(outcome==CopyPollAction::Stop?0:1));
  assert(timing.incomplete()==1&&out.str().find("\"aborted\":true")!=std::string::npos&&out.str().find("\"valid\":false")!=std::string::npos);
 }
 for(int setup=0;setup<6;++setup){
  ReceiverWorkerTiming<> timing;timing.initialize(true);ReceiverWorkerTimingFinalization finalization;
  std::optional<ReceiverWorkerTimingSpan<32768>> pending;std::string id=sampleInstance;bool beginSucceeded=false;int hostSummary=0;
  runReceiverBody([&]{
   if(setup==0)return; // false current begin with old identity
   if(setup==1)throw std::runtime_error("begin before id");
   id="bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";
   if(setup==2)throw std::runtime_error("begin after id");
   beginSucceeded=true;sample(timing);
   if(setup==4)pending.emplace(timing,ReceiverWorkerStage::GlFenceReady,sampleKey,clockNow);
   if(setup==5)throw ReceiverStopRequested{};
   finalization.bodyCompleted();
  },[](const char*){},[&]{++hostSummary;});
  finalization.prepare(beginSucceeded,id,pending);id.clear(); // snapshot survives activation cleanup
  assert(!pending&&hostSummary==1);
  std::ostringstream out;assert(finalization.drain(timing,out,1000));
  if(setup<3){assert(out.str()=="{\"kind\":\"receiver-worker-timing-unavailable\",\"reason\":\"activation initialization incomplete\"}\n");}
  else {assert(out.str().find("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb")!=std::string::npos);assert((out.str().find("\"valid\":true")!=std::string::npos)==(setup==3));}
 }
}
struct BrokenBuffer:std::streambuf {
 std::string bytes;size_t limit;bool failFlush;int flushes=0,failAt=1;
 BrokenBuffer(size_t n,bool fail,int at=1):limit(n),failFlush(fail),failAt(at){}
 int_type overflow(int_type c) override {if(bytes.size()==limit)return traits_type::eof();if(!traits_type::eq_int_type(c,traits_type::eof()))bytes.push_back(traits_type::to_char_type(c));return c;}
 int sync() override {++flushes;return failFlush&&flushes==failAt?-1:0;}
};
void brokenOutput() {
 {
  ReceiverWorkerTiming<> disabled;disabled.initialize(false);ReceiverWorkerTimingFinalization finalization;
  BrokenBuffer buffer(0,true);std::ostream out(&buffer);assert(finalization.drain(disabled,out,0));assert(buffer.bytes.empty()&&buffer.flushes==0);
 }
 for(bool flush:{false,true})for(bool throws:{false,true}){
  ReceiverWorkerTiming<> timing;timing.initialize(true);sample(timing);ReceiverWorkerTimingFinalization finalization;finalization.bodyCompleted();
  std::optional<ReceiverWorkerTimingSpan<32768>> pending;finalization.prepare(true,sampleInstance,pending);
  BrokenBuffer buffer(flush?10000:12,flush);std::ostream out(&buffer);if(throws)out.exceptions(std::ios::badbit|std::ios::failbit);
  int cleanup=1;assert(!finalization.drain(timing,out,1000));assert(cleanup==1);
  if(!flush)assert(buffer.bytes.size()==12&&buffer.bytes.find('\n')==std::string::npos);
  else {assert(buffer.flushes==1);assert(buffer.bytes.find("receiver-worker-timing-summary")==std::string::npos);}
 }
 // Once the summary bytes have reached a consumer, a later transport failure
 // cannot be inferred from rows alone. Preserve false I/O status, never retry.
 ReceiverWorkerTiming<> timing;timing.initialize(true);sample(timing);ReceiverWorkerTimingFinalization finalization;finalization.bodyCompleted();
 std::optional<ReceiverWorkerTimingSpan<32768>> pending;finalization.prepare(true,sampleInstance,pending);
 BrokenBuffer buffer(10000,true,2);std::ostream out(&buffer);out.exceptions(std::ios::badbit|std::ios::failbit);
 assert(!finalization.drain(timing,out,1000));assert(buffer.flushes==2);
 assert(buffer.bytes.find("\"valid\":true")!=std::string::npos);
}
}
int main(int argc,char** argv) {
 if(argc>1&&std::string_view(argv[1])=="--failed-flush-fixture"){
  ReceiverWorkerTiming<> timing;timing.initialize(true);sample(timing);ReceiverWorkerTimingFinalization finalization;finalization.bodyCompleted();
  std::optional<ReceiverWorkerTimingSpan<32768>> pending;finalization.prepare(true,sampleInstance,pending);
  BrokenBuffer buffer(10000,true);std::ostream out(&buffer);out.exceptions(std::ios::badbit|std::ios::failbit);
  assert(!finalization.drain(timing,out,1000));std::cout<<buffer.bytes;return 0;
 }
 if(argc>1){ReceiverWorkerTiming<> timing;timing.initialize(true);now=100;sample(timing);timing.write(std::cout,sampleInstance,1000,true);return 0;}
 boundsAndClocks();spansAndJson();lifecycleAndAttribution();brokenOutput();
 std::cout<<"receiver timing CPU checks passed: bounds, clocks, spans, attribution, R1 ownership, post-cleanup output\n";
}
