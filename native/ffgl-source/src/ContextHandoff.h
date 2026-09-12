#pragma once
#include "ReceiverLifecycle.h"
namespace lux {
template<class Initialize,class Abandon>
bool initializeTransferredContext(Initialize initialize,Abandon abandon){
 try{initialize();return true;}catch(...){abandon();return false;}
}
// Prepare on the owner thread, then transfer the unused resource to a worker.
// Failed preparation/thread creation rolls back before lifecycle becomes reusable.
template<class Prepare,class Launch,class Abandon>
bool launchPreparedContext(WorkerLifecycle& lifecycle,Prepare prepare,Launch launch,Abandon abandon){
 if(!lifecycle.beginStart())return false;
 try{if(prepare()){launch();return true;}}catch(...){}
 abandon();lifecycle.finished();lifecycle.reaped();return false;
}
}
