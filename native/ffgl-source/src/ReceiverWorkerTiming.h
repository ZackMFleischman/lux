#pragma once
#include "ReceiverRun.h"
#include <array>
#include <cstdint>
#include <limits>
#include <memory>
#include <new>
#include <ostream>
#include <optional>
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
// False on reaching saturation, as well as subsequent attempts. The caller
// retains this failure permanently instead of inferring complete totals.
inline bool receiverWorkerIncrement(uint64_t& value) noexcept {
 if(value==std::numeric_limits<uint64_t>::max())return false;
 ++value;return value!=std::numeric_limits<uint64_t>::max();
}
// One worker owns this fixed-capacity buffer. No allocations after initialize,
// no QPC calls while disabled, and no I/O until write after the measured loop.
template<size_t Capacity=32768> class ReceiverWorkerTiming {
 static_assert(Capacity>0&&Capacity<=32768);
 public:
  using Clock=uint64_t(*)() noexcept;
  using Allocator=ReceiverWorkerTimingRecord*(*)(size_t) noexcept;
  static ReceiverWorkerTimingRecord* allocate(size_t capacity) noexcept {return new(std::nothrow) ReceiverWorkerTimingRecord[capacity];}
  // Quiescent only: no live spans may reference the previous run.
  void initialize(bool requested,Allocator allocator=allocate) noexcept {
   records_.reset();requested_=requested;recorded_=0;
   attempted_=lost_=clockFailures_=incomplete_=lastEnd_=0;invalid_=false;
   if(requested)records_.reset(allocator(Capacity));
  }
  bool enabled()const noexcept{return bool(records_);}
  bool requested()const noexcept{return requested_;}
  uint64_t stamp(Clock clock)const noexcept{return enabled()?clock():0;}
  void append(ReceiverWorkerStage stage,ReceiverWorkerTimingKey key,uint64_t start,uint64_t end,bool complete) noexcept {
   if(!enabled())return;
   increment(attempted_);const auto sequence=attempted_;
   if(!complete)increment(incomplete_);
   constexpr uint64_t maxSafeGeneration=9007199254740991ULL;
   const bool sleep=stage==ReceiverWorkerStage::OuterSleep||stage==ReceiverWorkerStage::LocalCopySleep;
   if(stage<ReceiverWorkerStage::OuterSleep||stage>ReceiverWorkerStage::GlFenceReady||
      key.generation>maxSafeGeneration||key.outputGeneration>maxSafeGeneration||
      (!key.frame&&(!sleep||key.generation||key.outputGeneration)))invalid_=true;
   if(!start||end<start||end<lastEnd_){increment(clockFailures_);return;}
   lastEnd_=end;
   if(recorded_==Capacity){increment(lost_);return;}
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
   // Drain records before claiming a complete summary. A failed flush leaves
   // missing-summary evidence. A later transport failure after summary bytes
   // were delivered cannot be detected by a row-only consumer.
   out.flush();if(!out.good())return;
   out<<"{\"kind\":\"receiver-worker-timing-summary\",\"instanceId\":\""<<instance<<"\",\"domain\":\"qpc\",\"frequency\":\""<<frequency
    <<"\",\"metric\":\"worker CPU elapsed including queue/poll/wake delays, not GPU duration\",\"capacity\":"<<Capacity
    <<",\"recorded\":"<<recorded_<<",\"attempted\":"<<attempted_<<",\"lostRecords\":"<<lost_<<",\"clockFailures\":"<<clockFailures_
    <<",\"incompleteSpans\":"<<incomplete_<<",\"allocationFailed\":"<<(!enabled()?"true":"false")<<",\"aborted\":"<<(!completed?"true":"false")
    <<",\"valid\":"<<(enabled()&&recorded_&&frequency&&completed&&!invalid_&&!lost_&&!clockFailures_&&!incomplete_?"true":"false")<<"}\n";
  }
 private:
  std::unique_ptr<ReceiverWorkerTimingRecord[]> records_;bool requested_=false;
  void increment(uint64_t& counter) noexcept {if(!receiverWorkerIncrement(counter))invalid_=true;}
  size_t recorded_=0;uint64_t attempted_=0,lost_=0,clockFailures_=0,incomplete_=0,lastEnd_=0;bool invalid_=false;
};
template<size_t Capacity> class ReceiverWorkerTimingSpan {
 public:
  ReceiverWorkerTimingSpan(ReceiverWorkerTiming<Capacity>& timing,ReceiverWorkerStage stage,ReceiverWorkerTimingKey key,typename ReceiverWorkerTiming<Capacity>::Clock clock) noexcept
   :timing_(timing),stage_(stage),key_(key),clock_(clock),start_(timing.stamp(clock)){}
  ReceiverWorkerTimingSpan(const ReceiverWorkerTimingSpan&)=delete;
  ReceiverWorkerTimingSpan& operator=(const ReceiverWorkerTimingSpan&)=delete;
  ReceiverWorkerTimingSpan(ReceiverWorkerTimingSpan&&)=delete;
  ReceiverWorkerTimingSpan& operator=(ReceiverWorkerTimingSpan&&)=delete;
  ~ReceiverWorkerTimingSpan(){finish(false);}
  void finish(bool complete) noexcept {if(done_)return;done_=true;timing_.append(stage_,key_,start_,timing_.stamp(clock_),complete);}
 private:
  ReceiverWorkerTiming<Capacity>& timing_;ReceiverWorkerStage stage_;ReceiverWorkerTimingKey key_;
  typename ReceiverWorkerTiming<Capacity>::Clock clock_;uint64_t start_;bool done_=false;
};
// Only timing state crosses GPU cleanup. Copy the successful current-run ID
// into fixed owned storage before activation.end(), never retain its view.
class ReceiverWorkerTimingFinalization {
 public:
  void bodyCompleted() noexcept {completed_=true;}
  template<size_t Capacity>
  void prepare(bool beginSucceeded,std::string_view instance,std::optional<ReceiverWorkerTimingSpan<Capacity>>& pending) noexcept {
   pending.reset(); // Loop-exit pending work stays incomplete despite cleanup.
   attributed_=false;
   if(!beginSucceeded||instance.size()!=identity_.size())return;
   for(char c:instance)if(!((c>='0'&&c<='9')||(c>='a'&&c<='f')))return;
   for(size_t i=0;i<identity_.size();++i)identity_[i]=instance[i];
   attributed_=true;
  }
  // Caller invokes this exactly once, only after GPU/context cleanup returns.
  // A bad stream or flush gets no retry, and cannot escape into ownership code.
  template<size_t Capacity>
  bool drain(const ReceiverWorkerTiming<Capacity>& timing,std::ostream& out,uint64_t frequency) const noexcept {
   if(!timing.requested())return true;
   try {
    finalizeReceiverDiagnostics(attributed_,[&]{timing.write(out,std::string_view(identity_.data(),identity_.size()),frequency,completed_);},[&]{
     out<<"{\"kind\":\"receiver-worker-timing-unavailable\",\"reason\":\"activation initialization incomplete\"}\n";
    });
    out.flush();return out.good();
   }catch(...){return false;}
  }
 private:
  std::array<char,32> identity_{};bool attributed_=false,completed_=false;
};
}
