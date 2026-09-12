#include "ContextHandoff.h"
#include <stdexcept>
#include <vector>
#include <string>
#include <iostream>
#define CHECK(x) do{if(!(x)){std::cerr<<"FAIL line "<<__LINE__<<": " #x "\n";return 1;}}while(0)
int main(){
 lux::WorkerLifecycle state;std::vector<std::string> calls;int resource=0;
 auto abandon=[&]{calls.push_back("abandon");resource=0;};
 CHECK(!lux::launchPreparedContext(state,[&]{calls.push_back("prepare");return false;},[&]{calls.push_back("launch");},abandon));
 CHECK(calls==std::vector<std::string>({"prepare","abandon"}));CHECK(state.phase()==lux::WorkerPhase::Stopped);
 calls.clear();
 CHECK(!lux::launchPreparedContext(state,[&]{resource=1;calls.push_back("prepare");return true;},[&]{calls.push_back("launch");throw std::runtime_error("thread unavailable");},abandon));
 CHECK(resource==0);CHECK(calls==std::vector<std::string>({"prepare","launch","abandon"}));CHECK(state.phase()==lux::WorkerPhase::Stopped);
 calls.clear();
 CHECK(lux::launchPreparedContext(state,[&]{resource=1;calls.push_back("prepare");return true;},[&]{calls.push_back("launch");},abandon));
 CHECK(resource==1);CHECK(calls==std::vector<std::string>({"prepare","launch"}));
 CHECK(!lux::launchPreparedContext(state,[]{return true;},[]{},abandon));CHECK(resource==1);
 state.finished();state.reaped();resource=0;
 // Preparation may fail after allocating (for example, diagnostic allocation).
 CHECK(!lux::launchPreparedContext(state,[&]() -> bool {resource=1;throw std::runtime_error("after create");},[]{},abandon));CHECK(resource==0);CHECK(state.phase()==lux::WorkerPhase::Stopped);
 // The worker already owns the handle when early logging allocation throws.
 resource=1;calls.clear();
 CHECK(!lux::initializeTransferredContext([]{throw std::bad_alloc();},abandon));
 CHECK(resource==0);CHECK(calls==std::vector<std::string>({"abandon"}));
 resource=1;calls.clear();
 CHECK(lux::initializeTransferredContext([]{},abandon));CHECK(resource==1);CHECK(calls.empty());
 CHECK(!lux::initializeTransferredContext([]{throw 7;},abandon));CHECK(resource==0);
}
