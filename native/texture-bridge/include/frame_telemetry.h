#pragma once
#include "host_control_snapshot_v4.h"
#include <atomic>
#include <array>
namespace lux {
// A producer claim is not proof that Electron's compositor texture is the
// acknowledged worker frame. Status 1 remains explicitly unverified.
struct FrameProvenanceV4 {
 uint32_t status=0,reserved=0;uint64_t workerFrame=0,controlSequence=0,receivedQpc=0;
 std::array<char,64> revisionHash{};ControlSchemaHashV4 schemaHash{};
 uint32_t count=0;std::array<float,32> normalized{};
};
struct HostOpportunity {
 uint64_t sequence=0,at=0,generation=0,frame=0,completedQpc=0;
 bool present=false;FrameProvenanceV4 provenance;
};
// One FFGL callback producer and one receiver-thread consumer. Never wait,
// allocate, log, or overwrite unread records on the host callback thread.
template<size_t Capacity=1024> class OpportunityQueue {
 std::array<HostOpportunity,Capacity> records{};std::atomic<uint64_t> head{0},tail{0};
 public:std::atomic<uint64_t> lost{0};
 bool push(const HostOpportunity& value){auto write=head.load(std::memory_order_relaxed);if(write-tail.load(std::memory_order_acquire)>=Capacity){++lost;return false;}records[write%Capacity]=value;head.store(write+1,std::memory_order_release);return true;}
 bool pop(HostOpportunity& value){auto read=tail.load(std::memory_order_relaxed);if(read==head.load(std::memory_order_acquire))return false;value=records[read%Capacity];tail.store(read+1,std::memory_order_release);return true;}
};
}
