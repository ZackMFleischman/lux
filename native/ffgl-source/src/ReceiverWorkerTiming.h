#pragma once
#include <cstdint>
#include <memory>
#include <new>
#include <ostream>
#include <string_view>

namespace lux {
enum class ReceiverWorkerStage { OuterSleep, LocalCopySleep, CopyQuery, NvLock, GlFenceReady };
inline const char* receiverWorkerStageName(ReceiverWorkerStage stage) noexcept {
 switch(stage){
  case ReceiverWorkerStage::OuterSleep:return "outer-sleep";
  case ReceiverWorkerStage::LocalCopySleep:return "local-copy-poll-sleep";
  case ReceiverWorkerStage::CopyQuery:return "copy-submit-to-query-done";
  case ReceiverWorkerStage::NvLock:return "nv-lock";
  case ReceiverWorkerStage::GlFenceReady:return "gl-fence-to-ready";
 }return "invalid";
}
struct ReceiverWorkerTimingKey {uint64_t generation=0,outputGeneration=0,frame=0;};
struct ReceiverWorkerTimingRecord {uint64_t sequence=0,start=0,end=0;ReceiverWorkerTimingKey key;ReceiverWorkerStage stage{};bool complete=false;};
static_assert(sizeof(ReceiverWorkerTimingRecord)<=64);
// One worker owns this fixed-capacity buffer. No allocations after initialize,
// no QPC calls while disabled, and no I/O until write after the measured loop.
template<size_t Capacity=32768> class ReceiverWorkerTiming {
 public:
  using Clock=uint64_t(*)() noexcept;
  void initialize(bool requested) noexcept {requested_=requested;if(requested)records_.reset(new(std::nothrow) ReceiverWorkerTimingRecord[Capacity]);}
  bool enabled()const noexcept{return bool(records_);}
  bool requested()const noexcept{return requested_;}
  uint64_t stamp(Clock clock)const noexcept{return enabled()?clock():0;}
  void append(ReceiverWorkerStage stage,ReceiverWorkerTimingKey key,uint64_t start,uint64_t end,bool complete) noexcept {
   if(!enabled())return;
   const auto sequence=++attempted_;
   if(!complete)++incomplete_;
   if(!start||end<start){++clockFailures_;return;}
   if(recorded_==Capacity){++lost_;return;}
   records_[recorded_++]={sequence,start,end,key,stage,complete};
  }
  size_t recorded()const noexcept{return recorded_;}
  uint64_t attempted()const noexcept{return attempted_;}
  uint64_t lost()const noexcept{return lost_;}
  uint64_t clockFailures()const noexcept{return clockFailures_;}
  uint64_t incomplete()const noexcept{return incomplete_;}
  const ReceiverWorkerTimingRecord* records()const noexcept{return records_.get();}
  void write(std::ostream& out,std::string_view instance,uint64_t frequency,bool completed)const {
   if(!requested_)return;
   for(size_t i=0;i<recorded_;++i){const auto& r=records_[i];
    out<<"{\"kind\":\"receiver-worker-timing\",\"instanceId\":\""<<instance<<"\",\"sequence\":"<<r.sequence
     <<",\"stage\":\""<<receiverWorkerStageName(r.stage)<<"\",\"start\":\""<<r.start<<"\",\"end\":\""<<r.end
     <<"\",\"generation\":"<<r.key.generation<<",\"outputGeneration\":"<<r.key.outputGeneration<<",\"frameId\":\""<<r.key.frame
     <<"\",\"boundFrame\":"<<(r.key.frame?"true":"false")<<",\"complete\":"<<(r.complete?"true":"false");
    if(r.stage==ReceiverWorkerStage::OuterSleep||r.stage==ReceiverWorkerStage::LocalCopySleep)out<<",\"requestedSleepMs\":1";
    out<<"}\n";
   }
   out<<"{\"kind\":\"receiver-worker-timing-summary\",\"instanceId\":\""<<instance<<"\",\"domain\":\"qpc\",\"frequency\":\""<<frequency
    <<"\",\"metric\":\"worker CPU elapsed including queue/poll/wake delays, not GPU duration\",\"capacity\":"<<Capacity
    <<",\"recorded\":"<<recorded_<<",\"attempted\":"<<attempted_<<",\"lostRecords\":"<<lost_<<",\"clockFailures\":"<<clockFailures_
    <<",\"incompleteSpans\":"<<incomplete_<<",\"allocationFailed\":"<<(!enabled()?"true":"false")<<",\"aborted\":"<<(!completed?"true":"false")
    <<",\"valid\":"<<(enabled()&&recorded_&&frequency&&completed&&!lost_&&!clockFailures_&&!incomplete_?"true":"false")<<"}\n";
  }
 private:
  std::unique_ptr<ReceiverWorkerTimingRecord[]> records_;bool requested_=false;
  size_t recorded_=0;uint64_t attempted_=0,lost_=0,clockFailures_=0,incomplete_=0;
};
template<size_t Capacity> class ReceiverWorkerTimingSpan {
 public:
  ReceiverWorkerTimingSpan(ReceiverWorkerTiming<Capacity>& timing,ReceiverWorkerStage stage,ReceiverWorkerTimingKey key,typename ReceiverWorkerTiming<Capacity>::Clock clock) noexcept
   :timing_(timing),stage_(stage),key_(key),clock_(clock),start_(timing.stamp(clock)){}
  ReceiverWorkerTimingSpan(const ReceiverWorkerTimingSpan&)=delete;
  ~ReceiverWorkerTimingSpan(){finish(false);}
  void finish(bool complete) noexcept {if(done_)return;done_=true;timing_.append(stage_,key_,start_,timing_.stamp(clock_),complete);}
 private:
  ReceiverWorkerTiming<Capacity>& timing_;ReceiverWorkerStage stage_;ReceiverWorkerTimingKey key_;
  typename ReceiverWorkerTiming<Capacity>::Clock clock_;uint64_t start_;bool done_=false;
};
}
