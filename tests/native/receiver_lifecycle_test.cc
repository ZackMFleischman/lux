#include "ReceiverLifecycle.h"
#include <iostream>
#include <string>
#include <vector>
#include <chrono>
#include <thread>
#include <future>
using namespace std::chrono_literals;
#define CHECK(x) do {if(!(x)){std::cerr<<"FAIL line "<<__LINE__<<": " #x "\n";return 1;}}while(0)
struct Fake {
 lux::Completion copy=lux::Completion::Complete,gl=lux::Completion::Complete;
 bool unlockOk=true,unregisterOk=true,retireOk=true;
 std::vector<std::string> calls;
 lux::Completion pollCopy(){calls.push_back("poll-copy");return copy;}
 lux::Completion pollGl(){calls.push_back("poll-gl");return gl;}
 bool retire(){calls.push_back("retire");return retireOk;}
 void endAdmission(){calls.push_back("end-admission");}
 bool unlock(){calls.push_back("unlock");return unlockOk;}
 bool unregister(){calls.push_back("unregister");return unregisterOk;}
 void release(){calls.push_back("release");}
};
int main(){
 // A copy timeout must retain the producer lease, registration and resources.
 lux::ImportOwnership pending{true,true,true,false,false,true};Fake copy;copy.copy=lux::Completion::Pending;
 CHECK(pending.cleanup(copy)==lux::Completion::Pending);
 CHECK(copy.calls==std::vector<std::string>{"poll-copy"});
 CHECK(pending.lease&&pending.admission&&pending.registered);
 copy.copy=lux::Completion::Complete;copy.calls.clear();
 CHECK(pending.cleanup(copy)==lux::Completion::Complete);
 CHECK(copy.calls==std::vector<std::string>({"poll-copy","retire","end-admission","unregister","release"}));
 // FBO/setup exception after lock, no GL commands pending: unlock before unregister.
 lux::ImportOwnership locked{false,false,false,false,true,true};Fake lock;
 CHECK(locked.cleanup(lock)==lux::Completion::Complete);
 CHECK(lock.calls==std::vector<std::string>({"unlock","unregister","release"}));
 // Pending GL read cannot unlock even during shutdown.
 lux::ImportOwnership gl{false,false,false,true,true,true};Fake gpu;gpu.gl=lux::Completion::Pending;
 CHECK(gl.cleanup(gpu)==lux::Completion::Pending);
 CHECK(gpu.calls==std::vector<std::string>{"poll-gl"});
 gpu.gl=lux::Completion::Complete;gpu.calls.clear();gpu.unlockOk=false;
 CHECK(gl.cleanup(gpu)==lux::Completion::Failed);
 CHECK(gpu.calls==std::vector<std::string>({"poll-gl","unlock"}));
 CHECK(gl.locked&&gl.registered);
 // Partial registration failure still retires the source and releases local objects.
 lux::ImportOwnership partial{true,true,false,false,false,false};Fake init;
 CHECK(partial.cleanup(init)==lux::Completion::Complete);
 CHECK(init.calls==std::vector<std::string>({"retire","end-admission","release"}));
 lux::ImportOwnership unregister{false,false,false,false,false,true};Fake unreg;unreg.unregisterOk=false;
 CHECK(unregister.cleanup(unreg)==lux::Completion::Failed);
 CHECK(unreg.calls==std::vector<std::string>{"unregister"});
 lux::ImportOwnership failedCopy{true,true,true,false,false,true};Fake failure;failure.copy=lux::Completion::Failed;
 CHECK(failedCopy.cleanup(failure)==lux::Completion::Failed);
 CHECK(failure.calls==std::vector<std::string>{"poll-copy"});
 // A worker cannot restart before its completed thread has actually been joined.
 lux::WorkerLifecycle worker;
 CHECK(worker.beginStart());CHECK(!worker.beginStart());
 CHECK(!worker.waitStarted(0ms));CHECK(worker.started());CHECK(worker.waitStarted(0ms));
 worker.requestStop();worker.requestStop();CHECK(worker.stopRequested());
 CHECK(!worker.waitFinished(0ms)); // deterministic stalled-operation deadline assessment
 CHECK(!worker.beginStart());worker.finished();CHECK(worker.waitFinished(0ms));
 CHECK(!worker.beginStart());worker.reaped();CHECK(worker.beginStart());
 // Failed initialization has no running phase; repeated stop and restart are defined.
 worker.finished();CHECK(!worker.waitStarted(0ms));CHECK(worker.waitFinished(0ms));worker.reaped();
 worker.requestStop();CHECK(worker.phase()==lux::WorkerPhase::Stopped);
 CHECK(worker.beginStart());worker.requestStop();CHECK(!worker.started());
 worker.finished();worker.reaped();CHECK(worker.beginStart());worker.started();worker.finished();worker.reaped();
 // Inject a genuinely stalled operation on a CPU thread. Assessing a stop
 // deadline neither releases its resources nor reports completion. The fake
 // operation is explicitly released before join, so this test cannot hang a GPU.
 lux::WorkerLifecycle stalled;std::promise<void> entered,release;
 auto permitted=release.get_future();CHECK(stalled.beginStart());
 auto thread=std::thread([&]{stalled.started();entered.set_value();permitted.wait();stalled.finished();});
 entered.get_future().wait();stalled.requestStop();
 const bool correctlyPending=!stalled.waitFinished(1ms)&&stalled.stopRequested();
 release.set_value();thread.join();CHECK(correctlyPending);CHECK(stalled.waitFinished(0ms));
 stalled.reaped();CHECK(stalled.beginStart());stalled.finished();stalled.reaped();
 std::cout<<"receiver lifecycle CPU checks passed\n";
}
