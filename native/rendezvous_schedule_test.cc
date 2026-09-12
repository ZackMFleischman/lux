#include "PollDeadline.h"
#include <chrono>
#include <iostream>
using namespace std::chrono_literals;
#define CHECK(x) do{if(!(x)){std::cerr<<"FAIL line "<<__LINE__<<": " #x "\n";return 1;}}while(0)
int main(){lux::PollDeadline poll;const auto origin=std::chrono::steady_clock::time_point{};
 CHECK(poll.due(origin));CHECK(!poll.due(origin+499ms));
 CHECK(poll.due(origin+500ms)); // independent of loop count / Windows timer resolution
 CHECK(!poll.due(origin+501ms));
 CHECK(poll.due(origin+8s)); // pending copy or scheduling delay does not miss the poll
 CHECK(!poll.due(origin+8s)); // no catch-up burst
 CHECK(!poll.due(origin+8499ms));CHECK(poll.due(origin+8500ms));
}
