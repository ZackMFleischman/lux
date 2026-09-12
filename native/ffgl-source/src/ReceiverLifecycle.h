#pragma once
#include <chrono>
#include <condition_variable>
#include <mutex>
namespace lux {
enum class Completion { Complete, Pending, Failed };
// One ledger per imported slot, used on both normal and exceptional teardown.
// A pending/failed completion never licenses release of a GPU-owned resource.
struct ImportOwnership {
 bool admission=false, lease=false, copyPending=false, glPending=false, locked=false, registered=false;
 template<class Ops> Completion cleanup(Ops& ops) {
  if(copyPending){auto result=ops.pollCopy();if(result!=Completion::Complete)return result;copyPending=false;}
  if(lease){if(!ops.retire())return Completion::Failed;lease=false;}
  if(admission){ops.endAdmission();admission=false;}
  if(glPending){auto result=ops.pollGl();if(result!=Completion::Complete)return result;glPending=false;}
  if(locked){if(!ops.unlock())return Completion::Failed;locked=false;}
  if(registered){if(!ops.unregister())return Completion::Failed;registered=false;}
  ops.release();return Completion::Complete;
 }
};
enum class WorkerPhase { Stopped, Starting, Running, StopRequested, Finished };
class WorkerLifecycle {
 std::mutex mutex;std::condition_variable changed;WorkerPhase state=WorkerPhase::Stopped;
 public:
 bool beginStart(){std::lock_guard guard(mutex);if(state!=WorkerPhase::Stopped)return false;state=WorkerPhase::Starting;return true;}
 bool started(){std::lock_guard guard(mutex);if(state!=WorkerPhase::Starting)return false;state=WorkerPhase::Running;changed.notify_all();return true;}
 void requestStop(){std::lock_guard guard(mutex);if(state==WorkerPhase::Starting||state==WorkerPhase::Running)state=WorkerPhase::StopRequested;changed.notify_all();}
 bool stopRequested(){std::lock_guard guard(mutex);return state==WorkerPhase::StopRequested;}
 void finished(){std::lock_guard guard(mutex);state=WorkerPhase::Finished;changed.notify_all();}
 bool waitStarted(std::chrono::milliseconds budget){std::unique_lock guard(mutex);changed.wait_for(guard,budget,[&]{return state!=WorkerPhase::Starting;});return state==WorkerPhase::Running;}
 bool waitFinished(std::chrono::milliseconds budget){std::unique_lock guard(mutex);return changed.wait_for(guard,budget,[&]{return state==WorkerPhase::Finished||state==WorkerPhase::Stopped;});}
 void reaped(){std::lock_guard guard(mutex);if(state==WorkerPhase::Finished)state=WorkerPhase::Stopped;}
 WorkerPhase phase(){std::lock_guard guard(mutex);return state;}
};
}
